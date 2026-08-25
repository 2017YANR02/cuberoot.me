import { Hono } from 'hono';
import { RoomConfiguration } from '@livekit/protocol';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { checkRateLimit, requireAuth } from '../utils/recon_helpers.js';
import { pickAvailableRoomCode, ROOM_CODE_RE } from '../utils/room_code.js';

/**
 * /v1/video — 全站视频通话的凭证签发(LiveKit SFU)。两种房,同一套带宽闸:
 *
 *   GET  /video/config      — 视频功能是否可用、两种房各自的人数上限
 *   POST /video/token       — 对战房(/timer 联机):{code,pid}      → {url,token,…}
 *   POST /video/meet/code   — 会议室(/meet):     Bearer          → {code}
 *   POST /video/meet/token  — 会议室(/meet):     {code} + Bearer → {url,token,…}
 *
 * 媒体面完全由自建的 LiveKit 服务器承担(信令 + SFU 转发),本服务只做两件事:
 * **签发凭证** 和 **守带宽预算**。因此这里没有 WebSocket —— LiveKit 客户端拿到 token 后
 * 直连 LIVEKIT_URL,与本进程再无关系。
 *
 * 两种房的授权模型是**不同**的,这是本文件最要紧的一处区别:
 *
 *   对战房 `battle-<code>`  免登录。房间码只有 4 位数字且用户会当面念出来,可猜 ——
 *                           所以必须回库确认该 pid 此刻确实在 battle_rooms.players 里。
 *                           identity = pid,显示名取房里的昵称(不接受客户端自报)。
 *   会议室 `meet-<code>`    **必须登录**。进哪一间由 4 位数字会议码决定;新建时服务端会避开
 *                           活跃房与刚分配的码,但短码不是秘密。identity 与
 *                           显示名一律取自 token 里的账号 —— 客户端只报会议码,报不了自己是谁,
 *                           所以会议里不可能出现顶着别人名字的画面。
 *
 * 带宽:实例峰值 200 Mbps,预算按 140 留出站点自身 HTTP 流量。SFU 要把每人的流转发给其余
 * n-1 人,故单房出向 ≈ n*(n-1)*单路码率 —— 二人 6、四人 36、六人 90 Mbps,会议室再加一路
 * 屏幕共享的 (n-1)*1.5。签 token 前先向 LiveKit 查一遍在线房间算总占用,超预算直接拒发
 * (而不是放进去把所有人一起拖卡)。房间数不写死:二人房便宜、六人房贵,按预算算出来的
 * 并发数自然随人数浮动。
 *
 * 人数上限有两道:签 token 前的快照(为了给出「已满」这种能看懂的文案)和 token 里的
 * roomConfig.maxParticipants。后者才是真闸 —— LiveKit 在首个参与者真正连接、自动创建房间
 * 时原子应用配置,不会留下并发超编窗口,也不会让一次 HTTP 请求凭空制造无人房间。
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
 * 口径提醒:这个数以及整个预算算的是**出向**(SFU 转发给订阅者的那一侧),而 SFU 对每个
 * 订阅者只转一层,所以每路出向确实 ≤ 3 Mbps。入向是另一回事:simulcast 会额外推 180p 和
 * 540p 两层,每个发布者的上行约 3 + 0.8 + 0.16 ≈ 3.96 Mbps —— 六人满员时入向约 24 Mbps。
 * 两个方向各走各的,别把入向加进 BANDWIDTH_BUDGET_MBPS 里重复计算。
 */

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

/** 房间在最后一个人离开后保留多久(秒),方便短暂断线后回到原房。 */
const ROOM_EMPTY_TIMEOUT = 300;

const PID_RE = /^[a-z0-9]{6,16}$/;

/**
 * 会议码固定为 4 位数字。客户端也持有同一格式用于粘贴归一与入会前校验，守卫见
 * client tests/meet-code-format.test.ts。
 */
const MEET_CODE_RE = /^\d{4}$/;

const RATE = {
  token: { bucket: 'video-token', max: 60 },
  meetCode: { bucket: 'video-meet-code', max: 20 },
} as const;

/** 刚分配但尚未连上 LiveKit 的码也短暂占位，封住两个「新建」同时拿到同一码的窗口。 */
const MEET_CODE_RESERVATION_MS = 10 * 60 * 1000;
const pendingMeetCodes = new Map<string, number>();

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
function roomEgressMbps(n: number, screenShares: number): number {
  if (n <= 1) return 0;
  const camera = n * (n - 1) * PER_STREAM_MBPS;
  // 屏幕共享每一路都要转发给其余 n-1 人。会议室**至少**按一路预留(随时可能有人开始讲),
  // 真开了更多路就照实算 —— 界面上已经限制同时只有一个人共享,但那是客户端的事,
  // 预算不能建立在「客户端不会乱来」上。
  return camera + screenShares * (n - 1) * SCREEN_SHARE_MBPS;
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
  /** 目标房此刻真在推的屏幕共享路数(其余房拿不到名单,只能按模型的一路算)。 */
  let targetShares = 0;
  try {
    rooms = await svc().listRooms();
    const target = rooms.find(r => r.name === targetRoom);
    targetCount = target?.numParticipants ?? 0;
    if (target) {
      const parts = await svc().listParticipants(targetRoom);
      alreadyIn = parts.some(p => p.identity === pid);
      targetShares = parts
        .flatMap(p => p.tracks)
        .filter(t => t.source === TrackSource.SCREEN_SHARE).length;
    }
  } catch (error) {
    // LiveKit 连不上 ⟹ 算不出占用。这里**故意 fail closed**:算不准就不发 token。
    // 反正 LiveKit 挂了客户端也连不上,提前给个明确错误比让它连超时强。
    console.error('[video] LiveKit capacity check failed', { targetRoom, error });
    return { ok: false, reason: 'unavailable' };
  }

  const nextCount = alreadyIn ? targetCount : targetCount + 1;
  if (nextCount > maxParticipants) return { ok: false, reason: 'full' };

  // 会议室至少预留一路共享;目标房实际开了几路是查得到的,取两者的大者。
  const shares = (room: string, actual = 0) => (isMeetRoom(room) ? Math.max(1, actual) : 0);

  let total = 0;
  for (const r of rooms) {
    total += r.name === targetRoom
      ? roomEgressMbps(nextCount, shares(r.name, targetShares))
      : roomEgressMbps(r.numParticipants, shares(r.name));
  }
  if (!rooms.some(r => r.name === targetRoom)) total += roomEgressMbps(nextCount, shares(targetRoom));

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
  /**
   * 不在 HTTP 路由里 createRoom:只拿 token 却从不连接的请求不应在 LiveKit 停放空房。
   * roomConfig 会在首个参与者真正连接、LiveKit 自动创建房间时原子应用,同时解决两件事:
   * 人数上限没有快照竞态,恶意请求也不能用零带宽成本堆出成百上千间空房。
   */
  at.roomConfig = new RoomConfiguration({
    name: room,
    maxParticipants,
    emptyTimeout: ROOM_EMPTY_TIMEOUT,
    departureTimeout: ROOM_EMPTY_TIMEOUT,
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    // 能发哪几路必须和 roomEgressMbps 的模型一致 —— 不写 canPublishSources 等于「什么都能发」,
    // 于是对战房里任何人在控制台敲一行就能推屏幕共享,而带宽闸压根没给对战房留这笔钱
    // (isMeetRoom 为假时不加那 (n-1)*1.5)。权限和模型分叉就是悄悄超发。
    canPublishSources: isMeetRoom(room)
      ? [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
      : [TrackSource.CAMERA, TrackSource.MICROPHONE],
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
  checkRateLimit(getIp(c), RATE.token);

  if (!videoEnabled()) return c.json({ error: 'video not configured' }, 503);

  let body: { code?: unknown; pid?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid body' }, 400); }

  const code = typeof body.code === 'string' ? body.code : '';
  const pid = typeof body.pid === 'string' ? body.pid : '';
  if (!ROOM_CODE_RE.test(code) || !PID_RE.test(pid)) {
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

// POST /video/meet/code — 给「新建会议」分配一个当前未占用的四位数字码。
// 不预建 LiveKit 房间:用户可能点完不入会，空房不应污染服务端状态。
videoRoomsRoutes.post('/video/meet/code', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c), RATE.meetCode);

  if (!videoEnabled()) return c.json({ error: 'video not configured' }, 503);
  await requireAuth(c);

  let rooms: Awaited<ReturnType<RoomServiceClient['listRooms']>>;
  try {
    rooms = await svc().listRooms();
  } catch {
    return c.json({ error: 'unavailable' }, 503);
  }

  const now = Date.now();
  for (const [code, expiresAt] of pendingMeetCodes) {
    if (expiresAt <= now) pendingMeetCodes.delete(code);
  }

  const occupied = new Set<string>(pendingMeetCodes.keys());
  for (const room of rooms) {
    const match = /^meet-(\d{4})$/.exec(room.name);
    if (match) occupied.add(match[1]!);
  }

  const code = pickAvailableRoomCode(occupied);
  if (!code) return c.json({ error: 'unavailable' }, 503);
  pendingMeetCodes.set(code, now + MEET_CODE_RESERVATION_MS);
  return c.json({ code });
});

// POST /video/meet/token — 会议室凭证。**必须登录**:requireAuth 抛的
// 'Authentication required' 由全局 onError 转成 401。
//
// 身份完全取自 token,客户端只报会议码 —— 它报不了自己是谁,所以会议里不可能出现顶着
// 别人名字的画面(这也是「登录」在这里买到的东西:免登录时显示名只能靠客户端自报)。
// 房由第一个拿到 token 且真正连接的人自动创建,没人了自动关。只拿 token 不连接不会留空房;
// 本站仍不存任何会议记录,也就没有「会议列表」可以被人翻。
videoRoomsRoutes.post('/video/meet/token', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c), RATE.token);

  if (!videoEnabled()) return c.json({ error: 'video not configured' }, 503);

  const user = await requireAuth(c);

  let body: { code?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid body' }, 400); }

  const code = typeof body.code === 'string' ? body.code : '';
  if (!MEET_CODE_RE.test(code)) return c.json({ error: 'invalid code' }, 400);

  // identity 用归属键(绑了 WCA 是真 wca_id,否则 u<uid>)—— 同一个人刷新页面重连会被认成
  // 同一个参与者而不是新增一人,带宽准入才算得准。
  //
  // 代价是**一个账号只占一个席位**:同一账号从第二台设备进来时,LiveKit 会以
  // DUPLICATE_IDENTITY 把先前那条连接关掉。这是有意的 —— 六人的房本来就是按带宽算出来的,
  // 一个人开三台设备就等于挤掉两个人。客户端会把这个 reason 翻成人话(见 meet/page.tsx),
  // 不能让它静默掉线。
  const roomName = `meet-${code}`;
  const cap = await capacityCheck(roomName, user.wcaId, MAX_MEET_PARTICIPANTS);
  if (!cap.ok) {
    const status = cap.reason === 'unavailable' ? 503 : 429;
    return c.json({ error: cap.reason }, status);
  }
  return c.json(await mintToken(roomName, user.wcaId, user.name || user.wcaId, MAX_MEET_PARTICIPANTS));
});
