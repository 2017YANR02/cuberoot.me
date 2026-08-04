import { Hono } from 'hono';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/video — /timer 联机对战房间的视频通话(LiveKit SFU)。
 *
 *   GET  /video/config  — 视频功能是否可用(客户端据此决定要不要显示「开摄像头」入口)
 *   POST /video/token   — 换取 LiveKit 连接凭证:{code,pid} → {url,token,...}
 *
 * 媒体面完全由自建的 LiveKit 服务器承担(信令 + SFU 转发),本服务只做两件事:
 * **签发凭证** 和 **守带宽预算**。因此这里没有 WebSocket —— LiveKit 客户端拿到 token 后
 * 直连 LIVEKIT_URL,与本进程再无关系。
 *
 * 身份:复用 battle_rooms 的「房间码 + pid」。签 token 前必须回库确认该 pid 确实在该房间的
 * players 里 —— 房间码是 5 位可猜的,不校验就等于任何人都能挤进别人的摄像头。视频房名
 * `battle-<code>`,participant identity = pid,显示名取房间里的昵称(与对战 UI 同一个名字)。
 *
 * 带宽:实例峰值 200 Mbps,预算按 140 留出站点自身 HTTP 流量。SFU 要把每人的流转发给其余
 * n-1 人,故单房出向 ≈ n*(n-1)*单路码率 —— 二人 6、三人 18、四人 36 Mbps。签 token 前先
 * 向 LiveKit 查一遍在线房间算总占用,超预算直接拒发(而不是放进去把所有人一起拖卡)。
 * 房间数不写死:二人房便宜、四人房贵,按预算算出来的并发数自然随人数浮动。
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

/** 服务端出向带宽预算(Mbps):实例峰值 200,留 30% 给站点自身 HTTP 流量。 */
const BANDWIDTH_BUDGET_MBPS = 140;

/** 单个视频房人数上限(对战房本身允许 8 人,但视频只做小房间)。 */
const MAX_VIDEO_PARTICIPANTS = 4;

/** token 有效期:只用于建立连接,连上之后会话由 LiveKit 自己维持,不需要长 TTL。 */
const TOKEN_TTL = '10m';

const CODE_RE = /^[A-Z0-9]{4,12}$/;
const PID_RE = /^[a-z0-9]{6,16}$/;

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
function roomEgressMbps(n: number): number {
  return n <= 1 ? 0 : n * (n - 1) * PER_STREAM_MBPS;
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
  if (nextCount > MAX_VIDEO_PARTICIPANTS) return { ok: false, reason: 'full' };

  let total = 0;
  for (const r of rooms) {
    total += roomEgressMbps(r.name === targetRoom ? nextCount : r.numParticipants);
  }
  if (!rooms.some(r => r.name === targetRoom)) total += roomEgressMbps(nextCount);

  return total > BANDWIDTH_BUDGET_MBPS ? { ok: false, reason: 'bandwidth' } : { ok: true };
}

// GET /video/config — 客户端启动时问一次:这站开没开视频、单房上限几人、码率多少。
// 没配 LiveKit 时返回 enabled:false,客户端据此完全隐藏视频入口(而不是点了才报错)。
videoRoomsRoutes.get('/video/config', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({
    enabled: videoEnabled(),
    maxParticipants: MAX_VIDEO_PARTICIPANTS,
    maxBitrateMbps: PER_STREAM_MBPS,
  });
});

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
  const cap = await capacityCheck(roomName, pid);
  if (!cap.ok) {
    const status = cap.reason === 'unavailable' ? 503 : 429;
    return c.json({ error: cap.reason }, status);
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: pid,
    name: rows[0].name ?? pid,
    ttl: TOKEN_TTL,
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    // 数据通道用不上(对战状态走既有的 1s 轮询),关掉少一条可滥用的路径。
    canPublishData: false,
  });

  // v2 的 toJwt() 是 async —— 漏 await 会把一个 Promise 当 token 发出去。
  const token = await at.toJwt();

  return c.json({
    url: LIVEKIT_URL,
    token,
    identity: pid,
    room: roomName,
    maxParticipants: MAX_VIDEO_PARTICIPANTS,
    maxBitrateMbps: PER_STREAM_MBPS,
  });
});
