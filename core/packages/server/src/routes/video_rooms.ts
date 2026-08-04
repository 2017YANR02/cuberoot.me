import { Hono } from 'hono';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { checkRateLimit, requireAuth } from '../utils/recon_helpers.js';

/**
 * /v1/video — 全站视频通话的凭证签发(LiveKit SFU)。两种房,同一套带宽闸:
 *
 *   GET  /video/config      — 视频功能是否可用、两种房各自的人数上限
 *   POST /video/token       — 对战房(/timer 联机):{code,pid}      → {url,token,…}
 *   POST /video/meet/token  — 会议室(/meet):     {code,id,name} → {url,token,…}
 *
 * 媒体面完全由自建的 LiveKit 服务器承担(信令 + SFU 转发),本服务只做两件事:
 * **签发凭证** 和 **守带宽预算**。因此这里没有 WebSocket —— LiveKit 客户端拿到 token 后
 * 直连 LIVEKIT_URL,与本进程再无关系。
 *
 * 两种房的授权模型是**不同**的,这是本文件最要紧的一处区别:
 *
 *   对战房 `battle-<code>`  免登录。房间码只有 5 位(24 bit)且用户会当面念出来,可猜 ——
 *                           所以必须回库确认该 pid 此刻确实在 battle_rooms.players 里。
 *                           identity = pid,显示名取房里的昵称(不接受客户端自报)。
 *   会议室 `meet-<code>`    **必须登录**。没有在册名单可查,进哪一间由会议码决定(45 bit 熵,
 *                           见 MEET_CODE_RE),但「能不能用这个功能」由账号决定。identity 与
 *                           显示名一律取自 token 里的账号 —— 客户端只报会议码,报不了自己是谁,
 *                           所以会议里不可能出现顶着别人名字的画面。
 *
 * 带宽:实例峰值 200 Mbps,预算按 140 留出站点自身 HTTP 流量。SFU 要把每人的流转发给其余
 * n-1 人,故单房出向 ≈ n*(n-1)*单路码率 —— 二人 6、四人 36、六人 90 Mbps,会议室再加一路
 * 屏幕共享的 (n-1)*1.5。签 token 前先向 LiveKit 查一遍在线房间算总占用,超预算直接拒发
 * (而不是放进去把所有人一起拖卡)。房间数不写死:二人房便宜、六人房贵,按预算算出来的
 * 并发数自然随人数浮动。
 *
 * 注意:query() 会把 SQL 里所有 `?` 重写成 $n,jsonb 存在性判断必须用 jsonb_exists() 函数
 * 形式,不能写 `players ? pid` 操作符(与 battle_rooms 同一约束)。
 */
export const videoRoomsRoutes = new Hono();

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? '';

/**
 * 单路视频码率(Mbps)。1080p30 取 LiveKit h1080 预设的 3 Mbps。
 * **与客户端 lib/video-room-api.ts 的 VIDEO_MAX_BITRATE 同口径,改一处必须改两处** ——
 * 这里估低了会超卖带宽,估高了会白白拒掉本可以开的房间。
 */
const PER_STREAM_MBPS = 3;

/**
 * 屏幕共享的码率上限(Mbps)。只有会议室有这个功能,而且同一时刻通常只有一个人在共享 ——
 * 但它是**额外**的一路,不在 n*(n-1) 那个模型里,漏算就等于把预算悄悄超发。
 */
const SCREEN_SHARE_MBPS = 1.5;

/** 服务端出向带宽预算(Mbps):实例峰值 200,留 30% 给站点自身 HTTP 流量。 */
const BANDWIDTH_BUDGET_MBPS = 140;

/** 对战房视频人数上限(对战房本身允许 8 人,但视频只做小房间)。最坏 4*3*3 = 36 Mbps。 */
const MAX_VIDEO_PARTICIPANTS = 4;

/**
 * 会议室人数上限。最坏 6*5*3 + 5*1.5 = 97.5 Mbps(摄像头 + 一路屏幕共享),140 的预算里
 * 还剩得下一间四人对战房(36)。再放一档到 8 人光摄像头就是 8*7*3 = 168 —— 一间房吃穿
 * 整个预算。人数要再往上,只能同时降码率(PER_STREAM_MBPS 是二次项的系数),这两个数
 * 不能各调各的。
 */
const MAX_MEET_PARTICIPANTS = 6;

/** token 有效期:只用于建立连接,连上之后会话由 LiveKit 自己维持,不需要长 TTL。 */
const TOKEN_TTL = '10m';

const CODE_RE = /^[A-Z0-9]{4,12}$/;
const PID_RE = /^[a-z0-9]{6,16}$/;

/**
 * 会议码:32 字符表(去掉 0/1/I/O 这些会抄错的)取 9 位 = 45 bit。
 *
 * 登录只解决「谁能用这个功能」,**进哪一间会议仍然只由这个码决定** —— 没有在册名单可查,
 * 任何登录用户拿到码就能进。所以熵仍是房间层面唯一的防线:45 bit 配上 60 次/分钟的限流,
 * 扫穿要 10^7 年量级;对战房那个 5 位码(24 bit)之所以必须回库校验,正因为它只有一千万种、
 * 还会被人当面念出来。
 * 客户端 lib/video-room-api.ts 按同一张表生成,两处必须一致 —— 守卫见
 * client tests/meet-code-format.test.ts(不一致的话每一次「新建会议」都会 400)。
 */
const MEET_CODE_RE = /^[2-9A-HJ-NP-Z]{9}$/;

const RATE = { bucket: 'video-token', max: 60 } as const;

/** 视频功能是否配置齐全。缺任一项就整体关掉(而不是运行到一半才报错)。 */
function videoEnabled(): boolean {
  return !!(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

/**
 * RoomServiceClient 要的是 http(s) 主机,而客户端连的是 wss:// —— 同一个服务,两种 scheme。
 * 只让运维配一个 LIVEKIT_URL,这里换算,免得两个 env 配不一致时出玄学问题。
 */
function httpHost(): string {
  return LIVEKIT_URL.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
}

let svcClient: RoomServiceClient | null = null;
function svc(): RoomServiceClient {
  svcClient ??= new RoomServiceClient(httpHost(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  return svcClient;
}

/**
 * 房间出向带宽估算(Mbps)。n 人各发一路,服务端把每路转发给其余 n-1 人 ⟹ n*(n-1) 路。
 *
 * 这是**最坏情况**:所有人都在全屏看别人的 1080p。开了 simulcast + adaptiveStream 之后,
 * 宫格里的小窗会自动订阅低分辨率层,实际占用通常只有三分之一到一半。故意按最坏算 ——
 * 少开一个房只是少一个房,超卖带宽是所有房间一起卡。
 */
function roomEgressMbps(n: number, screenShare: boolean): number {
  if (n <= 1) return 0;
  const camera = n * (n - 1) * PER_STREAM_MBPS;
  // 屏幕共享:同一时刻按一路算(会议里通常只有一个人在讲),同样要转发给其余 n-1 人。
  return camera + (screenShare ? (n - 1) * SCREEN_SHARE_MBPS : 0);
}

/** 房名前缀决定这间房有没有屏幕共享 —— 对战房没有这个功能,不该替它多留带宽。 */
function isMeetRoom(name: string): boolean {
  return name.startsWith('meet-');
}

/**
 * 带宽准入:把「该 pid 加入 targetRoom 之后」的全局出向算出来,超预算则拒。
 *
 * 已在房里的人重连(刷新页面 / 断线重连)不该被算成新增一人,故先看 targetRoom 现有人数
 * 里是否已含此人 —— 但 listRooms 只给人数不给名单,所以用 listParticipants 单查目标房。
 * 一次 token 签发最多两个 LiveKit RPC,而签发只发生在进房那一刻,开销可以忽略。
 */
async function capacityCheck(
  targetRoom: string,
  pid: string,
  maxParticipants: number,
): Promise<{ ok: true } | { ok: false; reason: 'full' | 'bandwidth' | 'unavailable' }> {
  let rooms: Awaited<ReturnType<RoomServiceClient['listRooms']>>;
  let alreadyIn = false;
  let targetCount = 0;
  try {
    rooms = await svc().listRooms();
    const target = rooms.find(r => r.name === targetRoom);
    targetCount = target?.numParticipants ?? 0;
    if (target) {
      const parts = await svc().listParticipants(targetRoom);
      alreadyIn = parts.some(p => p.identity === pid);
    }
  } catch {
    // LiveKit 连不上 ⟹ 算不出占用。这里**故意 fail closed**:算不准就不发 token。
    // 反正 LiveKit 挂了客户端也连不上,提前给个明确错误比让它连超时强。
    return { ok: false, reason: 'unavailable' };
  }

  const nextCount = alreadyIn ? targetCount : targetCount + 1;
  if (nextCount > maxParticipants) return { ok: false, reason: 'full' };

  let total = 0;
  for (const r of rooms) {
    total += roomEgressMbps(r.name === targetRoom ? nextCount : r.numParticipants, isMeetRoom(r.name));
  }
  if (!rooms.some(r => r.name === targetRoom)) total += roomEgressMbps(nextCount, isMeetRoom(targetRoom));

  return total > BANDWIDTH_BUDGET_MBPS ? { ok: false, reason: 'bandwidth' } : { ok: true };
}

// GET /video/config — 客户端启动时问一次:这站开没开视频、单房上限几人、码率多少。
// 没配 LiveKit 时返回 enabled:false,客户端据此完全隐藏视频入口(而不是点了才报错)。
videoRoomsRoutes.get('/video/config', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({
    enabled: videoEnabled(),
    // maxParticipants 是**对战房**的上限(先有的字段,保持原义);会议室另给一个,
    // 免得某天两者不同还得靠调用方记住哪个是哪个。
    maxParticipants: MAX_VIDEO_PARTICIPANTS,
    meetMaxParticipants: MAX_MEET_PARTICIPANTS,
    maxBitrateMbps: PER_STREAM_MBPS,
  });
});

/**
 * 签发 LiveKit JWT。两个端点的差别全在它们各自的授权那一段,凭证本身是同一套,
 * 所以在这里合流 —— 分成两份写,迟早会一边加了 grant 另一边忘了。
 */
async function mintToken(room: string, identity: string, name: string, maxParticipants: number) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name, ttl: TOKEN_TTL });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    // 数据通道只有会议室要(文字聊天走它)。对战房用不上 —— 对战状态走既有的 1s 轮询 ——
    // 那就别开,少一条可滥用的路径。
    canPublishData: isMeetRoom(room),
  });

  return {
    url: LIVEKIT_URL,
    // v2 的 toJwt() 是 async —— 漏 await 会把一个 Promise 当 token 发出去。
    token: await at.toJwt(),
    identity,
    room,
    maxParticipants,
    maxBitrateMbps: PER_STREAM_MBPS,
  };
}

// POST /video/token — 校验 {code,pid} 确实是该房间的在册玩家,过带宽闸,签 LiveKit JWT。
videoRoomsRoutes.post('/video/token', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c), RATE);

  if (!videoEnabled()) return c.json({ error: 'video not configured' }, 503);

  let body: { code?: unknown; pid?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid body' }, 400); }

  const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
  const pid = typeof body.pid === 'string' ? body.pid : '';
  if (!CODE_RE.test(code) || !PID_RE.test(pid)) {
    return c.json({ error: 'invalid code/pid' }, 400);
  }

  // 授权的唯一依据:该 pid 此刻确实在该房间的 players 里。房间码可猜,不查库等于不设防。
  const rows = await query<{ name: string | null }>(
    `SELECT players -> ? ->> 'name' AS name
       FROM battle_rooms
      WHERE code = ? AND jsonb_exists(players, ?)`,
    [pid, code, pid],
  );
  if (!rows[0]) return c.json({ error: 'not in room' }, 403);

  const roomName = `battle-${code}`;
  const cap = await capacityCheck(roomName, pid, MAX_VIDEO_PARTICIPANTS);
  if (!cap.ok) {
    const status = cap.reason === 'unavailable' ? 503 : 429;
    return c.json({ error: cap.reason }, status);
  }

  return c.json(await mintToken(roomName, pid, rows[0].name ?? pid, MAX_VIDEO_PARTICIPANTS));
});

// POST /video/meet/token — 会议室凭证。**必须登录**:requireAuth 抛的
// 'Authentication required' 由全局 onError 转成 401。
//
// 身份完全取自 token,客户端只报会议码 —— 它报不了自己是谁,所以会议里不可能出现顶着
// 别人名字的画面(这也是「登录」在这里买到的东西:免登录时显示名只能靠客户端自报)。
// 会议室不需要预先创建:LiveKit 在第一个人进来时自动建房,没人了自动关 —— 因此本站不存
// 任何会议记录,也就没有「会议列表」可以被人翻。
videoRoomsRoutes.post('/video/meet/token', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c), RATE);

  if (!videoEnabled()) return c.json({ error: 'video not configured' }, 503);

  const user = await requireAuth(c);

  let body: { code?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid body' }, 400); }

  const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
  if (!MEET_CODE_RE.test(code)) return c.json({ error: 'invalid code' }, 400);

  // identity 用归属键(绑了 WCA 是真 wca_id,否则 u<uid>)—— 同一个人刷新页面重连会被认成
  // 同一个参与者而不是新增一人,带宽准入才算得准。
  const roomName = `meet-${code}`;
  const cap = await capacityCheck(roomName, user.wcaId, MAX_MEET_PARTICIPANTS);
  if (!cap.ok) {
    const status = cap.reason === 'unavailable' ? 503 : 429;
    return c.json({ error: cap.reason }, status);
  }

  return c.json(await mintToken(roomName, user.wcaId, user.name || user.wcaId, MAX_MEET_PARTICIPANTS));
});
