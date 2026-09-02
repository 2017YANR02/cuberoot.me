import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query, withTransaction } from '../db/connection.js';
import { checkRateLimit } from '../utils/recon_helpers.js';
import { generateRoomCode, ROOM_CODE_CREATE_ATTEMPTS } from '../utils/room_code.js';
import {
  NET_BATTLE_TOKEN_HEADER,
  OFFLINE_MS,
  isNetBattleEventId,
  isNetBattlePlayerId,
  isNetBattleRoomCode,
  isNetPenalty,
  isNetRoundParticipant,
  isNetWritablePhase,
  netPlayerEvent,
  netReadyRoster,
  pendingCount,
  settleNetRound,
  type NetBattleEventId,
  type NetPlayerEntry,
  type NetResult,
  type NetRoundHistory,
} from '@cuberoot/shared/timer';
import {
  battlePlayerTokenMatches,
  generateBattlePlayerId,
  generateBattlePlayerToken,
  hashBattlePlayerToken,
} from '../utils/battle_room_auth.js';
import { retireBattleVideoGeneration } from './video_rooms.js';
import {
  generateNetBattleScramble,
  generateNetBattleScrambleForSlot,
} from '../utils/battle_scramble.js';

/**
 * /v1/battle/rooms — /timer 联机对战房间(多设备,各自设备计时)。
 *
 * 项目模型:每人可选自己的项目(默认 = 建房项目),**同项目玩家共享同一条打乱**(公平),
 * 不同项目各持一条。房间用 `scrambles: {event: scramble}` 存当前轮各项目的打乱,谁先需要
 * 某项目的打乱由服务端复用 shared timer 生成器 lazy 生成并 set-if-absent 填进去。
 * 客户端只能选项目，不能上传有利打乱。胜负按「同项目分组」判,各组最快各计一胜。
 *
 *   POST /battle/rooms                    — 建房:{event,name} → {playerId, ...state}
 *   POST /battle/rooms/:code/join         — 加入:{name} → {playerId, ...state}(默认项目=房间项目)
 *   GET  /battle/rooms/:code?pid=X        — 房间状态(轮询;带 pid 时顺手刷新在线心跳)
 *   POST /battle/rooms/:code/status       — 实时状态:{pid,ph}(idle|ready|inspecting|solving)
 *   POST /battle/rooms/:code/name         — 改自己的名字/身份:{pid,name,wcaId?,iso2?}(重名同样加后缀)
 *   POST /battle/rooms/:code/event        — 改自己项目:{pid,event}(顺带 lazy 填该项目打乱)
 *   POST /battle/rooms/:code/scramble     — lazy 填某项目当前轮打乱:{pid,event}(set-if-absent)
 *   POST /battle/rooms/:code/result       — 交成绩:{pid,round,t,p};轮次落后 → {advanced,...state}
 *   POST /battle/rooms/:code/next         — 开下一轮(CAS 只第一个成功):{pid,round,force?}
 *                                           服务端按项目分组结算胜者进 scores + 压历史
 *   POST /battle/rooms/:code/settings     — 房主改房设:{pid,syncStart}
 *   POST /battle/rooms/:code/admin        — 房主转让:{pid,target}
 *   POST /battle/rooms/:code/kick         — 房主踢人:{pid,target}
 *   POST /battle/rooms/:code/leave        — 离开:{pid};房间空了即删
 *
 * 房主(admin):建房者是首任房主,可转让、可踢人、可改房设。房主离场后由「最早加入者」
 * 自动接任 —— 读时回落(effectiveAdmin),不写库,免竞态。所有房主操作都在服务端校验
 * 请求者 pid === 当前房主,客户端隐藏按钮只是装饰。
 *
 * 同时开始计时(sync_start):房主开启后,本轮「在线且未交卷」的玩家(≥2 人)全部点过
 * 准备(ph='ready'),服务端才落 start_at = now + 3s;各端用轮询估出的时钟偏移把它换算成
 * 本机时刻,倒计时归零同时起表。开下一轮 / 关掉开关即清 start_at。
 *
 * 无需账号登录 —— 房间码可公开分享;create/join 另发只属于该玩家的随机 capability token,
 * 数据库只存 SHA-256 摘要。所有心跳和写操作都必须同时给 pid + token,因此看见房间状态不能
 * 冒充其他玩家。成绩/状态都是单行 jsonb 原子合并(行锁串行化),实时性 = 客户端 1s 轮询
 * GET(no-store)。响应都带 now(服务器毫秒),客户端
 * 据此估时钟偏移,把对手 solving 的 at 换算成本地滚动计时。
 *
 * 注意:query() 会把 SQL 里所有 `?` 重写成 $n,jsonb 存在性判断必须用 jsonb_exists() 函数形式,
 * 不能写 `players ? pid` 操作符。::jsonb 参数一律传裸对象(postgres.js 自己序列化),禁预先
 * JSON.stringify(会双重编码成 jsonb 字符串标量)。
 */
export const battleRoomsRoutes = new Hono();

const MAX_PLAYERS = 8;
const NAME_MAX = 24;
/** 单轮历史上限:防 jsonb 无界膨胀(超过就丢最旧的)。 */
const MAX_HISTORY = 50;
/** 当前轮打乱表(scrambles)项目数上限:防恶意 /event 刷不同项目撑爆 jsonb。 */
const MAX_SCRAMBLE_EVENTS = 16;
/** 过期房间:24h 无活动惰性清理。 */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** 「同时开始」倒计时:全员准备到起表的提前量(> 轮询周期,慢的一端也来得及看到)。 */
const COUNTDOWN_MS = 3_000;
/** PostgreSQL INTEGER upper bound used by battle_rooms.round. */
const MAX_ROUND = 2_147_483_647;

const WCA_ID_RE = /^\d{4}[A-Z]{4}\d{2}$/;
const ISO2_RE = /^[A-Za-z]{2}$/;

function parseCode(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  return isNetBattleRoomCode(s) ? s : null;
}

function parseEvent(raw: unknown): NetBattleEventId | null {
  return isNetBattleEventId(raw) ? raw : null;
}

/** 玩家名:去首尾空白、压缩连续空白、截断;空的给默认名。 */
function sanitizeName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX) : '';
  return s || 'Cuber';
}

/** WCA ID(可选,登录/选了 WCA 选手时带);非法一律丢弃当访客处理。 */
function parseWcaId(raw: unknown): string | undefined {
  return typeof raw === 'string' && WCA_ID_RE.test(raw) ? raw : undefined;
}

/** 国家 iso2(可选,给玩家条国旗用);统一大写。 */
function parseIso2(raw: unknown): string | undefined {
  return typeof raw === 'string' && ISO2_RE.test(raw) ? raw.toUpperCase() : undefined;
}

/**
 * 重名去重:名已被占用则依次尝试「名 (2)」「名 (3)」…(大小写不敏感,截断保 NAME_MAX)。
 * 同一 WCA ID 两台设备也能同房对战,靠这个加后缀区分,而不是拒绝加入。
 */
function uniqueName(base: string, takenLower: Set<string>): string {
  if (!takenLower.has(base.toLowerCase())) return base;
  for (let n = 2; n < 100; n++) {
    const suffix = ` (${n})`;
    const head = base.slice(0, Math.max(1, NAME_MAX - suffix.length));
    const cand = head + suffix;
    if (!takenLower.has(cand.toLowerCase())) return cand;
  }
  return base; // 兜底(几乎不可能:玩家数 ≤ MAX_PLAYERS)
}

type PlayerEntry = NetPlayerEntry & { event: NetBattleEventId };
type RoomResult = NetResult;
type RoomHistoryEntry = NetRoundHistory;
interface RoomRow {
  code: string;
  revision: number;
  video_generation: string;
  round_roster: string[];
  event: NetBattleEventId;                         // 房间默认项目(新加入者的默认)
  round: number;
  scrambles: Record<string, string>;               // 当前轮各项目打乱 {event: scramble}
  players: Record<string, PlayerEntry>;
  results: Record<string, Record<string, RoomResult>>;
  history: RoomHistoryEntry[];
  scores: Record<string, number>;
  player_auth: Record<string, string>;              // {pid: sha256(capability token)}; never serialized
  admin: string | null;                            // 房主 pid(不在房里则读时回落最早加入者)
  sync_start: boolean;                             // 是否要求全员同时起表
  start_at: string | number | null;                // 本轮同时起表时刻(BIGINT,driver 可能给字符串)
}

const ROOM_COLS = 'code, revision, video_generation, round_roster, event, round, scrambles, players, results, history, scores, player_auth, admin, sync_start, start_at';

/**
 * 当前房主:admin 仍在房里就是他;否则最早加入者接任(加入时刻相同按 pid 定序)。
 * 读时回落而非写库 —— 房主掉线/离场无需额外一次 UPDATE,也没有并发改写竞态。
 */
function effectiveAdmin(r: RoomRow): string {
  if (r.admin && r.players[r.admin]) return r.admin;
  let best = '';
  for (const [id, p] of Object.entries(r.players)) {
    if (!best) { best = id; continue; }
    const cur = r.players[best];
    if (p.joined < cur.joined || (p.joined === cur.joined && id < best)) best = id;
  }
  return best;
}

/** 统一的状态响应(轮询/各写操作都回它,客户端一把同步)。 */
function stateJson(r: RoomRow) {
  return {
    code: r.code, revision: Number(r.revision), videoGeneration: r.video_generation,
    roundRoster: r.round_roster ?? [],
    event: r.event, round: r.round, scrambles: r.scrambles ?? {},
    players: r.players, results: r.results, history: r.history ?? [], scores: r.scores,
    admin: effectiveAdmin(r), syncStart: !!r.sync_start,
    startAt: r.start_at == null ? null : Number(r.start_at),
    now: Date.now(),
  };
}

/**
 * 「同时开始」的开表条件:本轮在线且未交卷的玩家 ≥2 人且全部已准备。
 * 少于 2 人不设门(一个人还要等谁),离线者不阻塞(AFK 的人不该卡住全房)。
 */
async function getRoomRow(code: string): Promise<RoomRow | null> {
  // Pre-token rooms intentionally become inaccessible and expire naturally in 24h. There is no
  // safe way to mint the old browser a secret after the fact, and a compatibility bypass would
  // preserve the impersonation vulnerability this column closes.
  const rows = await query<RoomRow>(
    `SELECT ${ROOM_COLS} FROM battle_rooms
     WHERE code = ?
       AND (SELECT count(*) FROM jsonb_object_keys(player_auth))
         = (SELECT count(*) FROM jsonb_object_keys(players))`,
    [code],
  );
  return rows[0] ?? null;
}

function requestPlayerToken(c: { req: { header(name: string): string | undefined } }): string | undefined {
  return c.req.header(NET_BATTLE_TOKEN_HEADER);
}

function authorizedPlayer(room: RoomRow, pid: string, token: unknown): boolean {
  return !!room.players[pid] && battlePlayerTokenMatches(room.player_auth, pid, token);
}

async function requirePlayer(code: string, pid: string | null, token: unknown): Promise<
  { room: RoomRow; pid: string; tokenHash: string } | { error: string; status: 400 | 403 | 404 }
> {
  if (!pid) return { error: 'invalid pid', status: 400 };
  const room = await getRoomRow(code);
  if (!room) return { error: 'room not found', status: 404 };
  if (!authorizedPlayer(room, pid, token)) return { error: 'invalid player capability', status: 403 };
  return { room, pid, tokenHash: hashBattlePlayerToken(token as string) };
}

/** SQL form of effectiveAdmin(); used inside UPDATE so admin races cannot pass a stale read check. */
const EFFECTIVE_ADMIN_SQL = `COALESCE(
  CASE WHEN admin IS NOT NULL AND jsonb_exists(players, admin) THEN admin END,
  (SELECT e.key FROM jsonb_each(players) AS e(key, value)
   ORDER BY (e.value ->> 'joined')::bigint, e.key LIMIT 1)
)`;

/** Adapt PostgreSQL snake_case to the shared round-eligibility contract. */
function isRoomRoundParticipant(room: RoomRow, pid: string): boolean {
  return isNetRoundParticipant({
    startAt: room.start_at == null ? null : Number(room.start_at),
    roundRoster: room.round_roster,
  }, pid);
}

// POST /battle/rooms — 建房(建房者即首位玩家,项目 = 建房项目)
battleRoomsRoutes.post('/battle/rooms', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));

  let body: { event?: unknown; name?: unknown; wcaId?: unknown; iso2?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid body' }, 400); }

  const event = parseEvent(body.event);
  if (!event) return c.json({ error: 'invalid event' }, 400);
  const name = sanitizeName(body.name);
  const wcaId = parseWcaId(body.wcaId);
  const iso2 = parseIso2(body.iso2);
  let scramble: string;
  try { scramble = await generateNetBattleScramble(event); }
  catch { return c.json({ error: 'scramble unavailable' }, 503); }

  const now = Date.now();
  // 惰性清理:顺手删掉过期房间(不阻塞主流程)
  query('DELETE FROM battle_rooms WHERE updated_at < ?', [now - ROOM_TTL_MS]).catch(() => {});

  const pid = generateBattlePlayerId();
  const playerToken = generateBattlePlayerToken();
  const playerAuth = { [pid]: hashBattlePlayerToken(playerToken) };
  const players: Record<string, PlayerEntry> = {
    [pid]: { name, ...(wcaId ? { wcaId } : {}), ...(iso2 ? { iso2 } : {}), joined: now, seen: now, ph: 'idle', at: now, event },
  };
  const scrambles: Record<string, string> = { [event]: scramble };

  for (let attempt = 0; attempt < ROOM_CODE_CREATE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    try {
      const rows = await query<RoomRow>(
        `INSERT INTO battle_rooms (code, revision, event, round, scrambles, players, results, history, scores, player_auth, admin, created_at, updated_at)
         VALUES (?, 1, ?, 1, ?::jsonb, ?::jsonb, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, ?::jsonb, ?, ?, ?)
         RETURNING ${ROOM_COLS}`,
        [code, event, scrambles, players, playerAuth, pid, now, now],
      );
      if (!rows[0]) throw new Error('room insert returned no row');
      return c.json({ playerId: pid, playerToken, ...stateJson(rows[0]) });
    } catch (e) {
      if (String((e as Error).message).includes('duplicate') || String((e as Error).message).includes('unique')) continue;
      throw e;
    }
  }
  return c.json({ error: 'could not allocate room code' }, 500);
});

// POST /battle/rooms/:code/join — 加入房间(默认项目 = 房间项目)
battleRoomsRoutes.post('/battle/rooms/:code/join', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { name?: unknown; wcaId?: unknown; iso2?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const name = sanitizeName(body.name);
  const wcaId = parseWcaId(body.wcaId);
  const iso2 = parseIso2(body.iso2);

  const now = Date.now();
  // 重名不拒绝,自动加后缀去重:同一 WCA ID 两台设备也能同房对战,名字用「名 (2)」区分。
  // 每次算出的唯一名再用 NOT EXISTS 原子写入(行锁下),并发抢到同名则重读重算,最多试几次。
  for (let attempt = 0; attempt < MAX_PLAYERS + 4; attempt++) {
    const pid = generateBattlePlayerId();
    const playerToken = generateBattlePlayerToken();
    const playerTokenHash = hashBattlePlayerToken(playerToken);
    const cur = await getRoomRow(code);
    if (!cur) return c.json({ error: 'room not found' }, 404);
    // A synchronized countdown/round has a fixed roster. Joining midway would make the new
    // player auto-start from an old start_at and then block completion; wait for /next instead.
    if (cur.start_at != null) return c.json({ error: 'round in progress' }, 409);
    // 软上限:并发同时挤进来可能略过 8,无伤大雅
    if (Object.keys(cur.players).length >= MAX_PLAYERS) return c.json({ error: 'room full' }, 409);

    const takenLower = new Set(Object.values(cur.players).map((p) => (p.name || '').toLowerCase()));
    const finalName = uniqueName(name, takenLower);
    const entry: PlayerEntry = {
      name: finalName, ...(wcaId ? { wcaId } : {}), ...(iso2 ? { iso2 } : {}),
      joined: now, seen: now, ph: 'idle', at: now, event: cur.event,
    };
    // 仅当选定名此刻仍无人占用时才写入(行锁下原子);抢名失败 → 0 行 → 循环重算。
    const rows = await query<RoomRow>(
      `UPDATE battle_rooms b
       SET players = players || jsonb_build_object(?::text, ?::jsonb),
           player_auth = player_auth || jsonb_build_object(?::text, ?::jsonb),
           revision = revision + 1, updated_at = ?
       WHERE code = ?
         AND (SELECT count(*) FROM jsonb_object_keys(players)) < ?
         AND (SELECT count(*) FROM jsonb_object_keys(player_auth))
           = (SELECT count(*) FROM jsonb_object_keys(players))
         AND NOT jsonb_exists(players, ?)
         AND start_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_each(b.players) AS e(k, v)
           WHERE lower(v ->> 'name') = lower(?)
         )
       RETURNING ${ROOM_COLS}`,
      [pid, entry, pid, playerTokenHash, now, code, MAX_PLAYERS, pid, finalName],
    );
    if (rows[0]) return c.json({ playerId: pid, playerToken, ...stateJson(rows[0]) });
  }
  // 极端并发下反复抢名失败(几乎不可能:玩家数 ≤ MAX_PLAYERS)
  return c.json({ error: 'name taken' }, 409);
});

// GET /battle/rooms/:code?pid=X — 状态轮询;带 pid 时刷新该玩家在线心跳(seen)
battleRoomsRoutes.get('/battle/rooms/:code', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);
  const pidRaw = c.req.query('pid') ?? '';
  const pid = isNetBattlePlayerId(pidRaw) ? pidRaw : null;

  if (pid) {
    const gate = await requirePlayer(code, pid, requestPlayerToken(c));
    if ('error' in gate) return c.json({ error: gate.error }, gate.status);
    const now = Date.now();
    // SQL 再验 capability，避免校验后恰好被踢/离开的 TOCTOU。
    const rows = await query<RoomRow>(
      `UPDATE battle_rooms
       SET players = players || jsonb_build_object(
             ?::text,
             (players -> ?)
               || jsonb_build_object('seen', ?::bigint)
               || CASE
                    WHEN COALESCE((players -> ? ->> 'seen')::bigint, 0) < ?
                      THEN jsonb_build_object('ph', 'idle', 'at', ?::bigint)
                    ELSE '{}'::jsonb
                  END
           ),
           revision = revision + 1, updated_at = ?
       WHERE code = ? AND jsonb_exists(players, ?) AND player_auth ->> ? = ?
       RETURNING ${ROOM_COLS}`,
      [
        pid, pid, now, pid, now - OFFLINE_MS, now,
        now, code, pid, pid, gate.tokenHash,
      ],
    );
    if (rows[0]) return c.json(stateJson(rows[0]));
    return c.json({ error: 'invalid player capability' }, 403);
  }

  const room = await getRoomRow(code);
  if (!room) return c.json({ error: 'room not found' }, 404);
  return c.json(stateJson(room));
});

// POST /battle/rooms/:code/status — 实时状态(准备/开始观察/开始计时/回到空闲)
// 不限流:每次 solve 至多两三次,且同一 WiFi 下多名玩家共享出口 IP,全局限流会误伤。
battleRoomsRoutes.post('/battle/rooms/:code/status', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; ph?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = isNetBattlePlayerId(body.pid) ? body.pid : null;
  const ph = isNetWritablePhase(body.ph) ? body.ph : null;
  if (!pid || !ph) return c.json({ error: 'invalid pid/ph' }, 400);

  const playerToken = requestPlayerToken(c);
  const outcome = await withTransaction<
    { room: RoomRow } | { error: string; status: 403 | 404 | 409 }
  >(async (transactionQuery) => {
    // Lock across both the player phase transition and the all-ready decision. A concurrent
    // settings update must happen wholly before or after this transaction, so sync_start=false
    // can never be paired with a stale start_at written by this request.
    const locked = await transactionQuery<RoomRow>(
      `SELECT ${ROOM_COLS} FROM battle_rooms
       WHERE code = ?
         AND (SELECT count(*) FROM jsonb_object_keys(player_auth))
           = (SELECT count(*) FROM jsonb_object_keys(players))
       FOR UPDATE`,
      [code],
    );
    const room = locked[0];
    if (!room) return { error: 'room not found', status: 404 };
    if (!authorizedPlayer(room, pid, playerToken)) {
      return { error: 'invalid player capability', status: 403 };
    }
    // Take the application timestamp only after the row lock. A request can wait behind another
    // transaction across the countdown boundary; a pre-lock timestamp would start in the past.
    const now = Date.now();
    if (!isRoomRoundParticipant(room, pid)) {
      return { error: 'wait for next round', status: 409 };
    }
    const hasResult = !!room.results[String(room.round)]?.[pid];
    if (hasResult && ph !== 'idle') {
      return { error: 'round already submitted', status: 409 };
    }
    const startsTimer = ph === 'inspecting' || ph === 'solving';
    if (room.sync_start && startsTimer
      && (room.start_at == null || Number(room.start_at) > now || !room.round_roster.includes(pid))) {
      // In synchronized rooms the server owns the start boundary. A modified client must not
      // publish an early active phase, cancel the shared countdown, or leave a permanent fake
      // "solving" badge while its eventual result would be rejected.
      return { error: 'wait for synchronized start', status: 409 };
    }

    const players = {
      ...room.players,
      [pid]: { ...room.players[pid], ph, at: now, seen: now },
    };
    const candidate = { ...room, players };
    let startAt = candidate.start_at;
    let roundRoster = candidate.round_roster;
    if (startAt != null && Number(startAt) > now && ph !== 'ready') {
      startAt = null;
      roundRoster = [];
    } else if (ph === 'ready'
      && candidate.sync_start
      && candidate.start_at == null) {
      const ready = netReadyRoster({
        players: candidate.players,
        results: candidate.results,
        round: candidate.round,
        now,
      });
      if (ready) {
        startAt = now + COUNTDOWN_MS;
        roundRoster = ready;
      }
    }
    const rows = await transactionQuery<RoomRow>(
      `UPDATE battle_rooms
       SET players = ?::jsonb, start_at = ?, round_roster = ?::jsonb,
           revision = revision + 1, updated_at = ?
       WHERE code = ? AND jsonb_exists(players, ?) AND player_auth ->> ? = ?
       RETURNING ${ROOM_COLS}`,
      [players, startAt, roundRoster, now, code, pid, pid, hashBattlePlayerToken(playerToken as string)],
    );
    return rows[0]
      ? { room: rows[0] }
      : { error: 'invalid player capability', status: 403 };
  });

  if ('error' in outcome) return c.json({ error: outcome.error }, outcome.status);
  return c.json(stateJson(outcome.room));
});

// POST /battle/rooms/:code/name — 玩家改自己的名字(顺带可换 WCA 身份:国旗 / WCA ID)
// 只改自己:pid 选定玩家、私有 capability 授权。不限流,理由同 /status(同一 WiFi 共享出口 IP)。
battleRoomsRoutes.post('/battle/rooms/:code/name', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; name?: unknown; wcaId?: unknown; iso2?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = isNetBattlePlayerId(body.pid) ? body.pid : null;
  if (!pid) return c.json({ error: 'invalid pid' }, 400);
  const name = sanitizeName(body.name);
  const wcaId = parseWcaId(body.wcaId);
  const iso2 = parseIso2(body.iso2);
  const gate = await requirePlayer(code, pid, requestPlayerToken(c));
  if ('error' in gate) return c.json({ error: gate.error }, gate.status);

  const now = Date.now();
  // 与 join 同一套抢名循环:算唯一名(**排除自己**,否则改成自己现在的名字会被自己挡成
  // 「名 (2)」)→ NOT EXISTS 原子写 → 抢输就重读重算。
  for (let attempt = 0; attempt < MAX_PLAYERS + 4; attempt++) {
    const cur = await getRoomRow(code);
    if (!cur) return c.json({ error: 'room not found' }, 404);
    if (!cur.players[pid]) return c.json({ error: 'player not in room' }, 404);

    const takenLower = new Set(
      Object.entries(cur.players)
        .filter(([id]) => id !== pid)
        .map(([, p]) => (p.name || '').toLowerCase()),
    );
    const finalName = uniqueName(name, takenLower);
    // 身份三件套整体替换:访客把选中的 WCA 选手清掉后,国旗 / WCA ID 也要跟着消失,
    // 留着上一次的就成了「名字是甲、国旗还是乙」。
    const identityPatch = {
      name: finalName,
      seen: now,
      ...(wcaId ? { wcaId } : {}),
      ...(iso2 ? { iso2 } : {}),
    };

    const rows = await query<RoomRow>(
      `UPDATE battle_rooms b
       SET players = players || jsonb_build_object(
             ?::text,
             ((players -> ?) - 'wcaId' - 'iso2') || ?::jsonb
           ),
           revision = revision + 1, updated_at = ?
       WHERE code = ?
         AND jsonb_exists(b.players, ?)
         AND b.player_auth ->> ? = ?
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_each(b.players) AS e(k, v)
           WHERE e.k <> ?::text AND lower(v ->> 'name') = lower(?)
         )
       RETURNING ${ROOM_COLS}`,
      [pid, pid, identityPatch, now, code, pid, pid, gate.tokenHash, pid, finalName],
    );
    if (rows[0]) return c.json(stateJson(rows[0]));
  }
  return c.json({ error: 'name taken' }, 409);
});

// POST /battle/rooms/:code/event — 玩家改自己项目 + lazy 填该项目当前轮打乱
battleRoomsRoutes.post('/battle/rooms/:code/event', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; event?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = isNetBattlePlayerId(body.pid) ? body.pid : null;
  const event = parseEvent(body.event);
  if (!pid || !event) return c.json({ error: 'invalid body' }, 400);

  const gate = await requirePlayer(code, pid, requestPlayerToken(c));
  if ('error' in gate) return c.json({ error: gate.error }, gate.status);
  if (!isRoomRoundParticipant(gate.room, pid)) return c.json({ error: 'wait for next round' }, 409);
  if (gate.room.results[String(gate.room.round)]?.[pid]) return c.json({ error: 'round already submitted' }, 409);
  if (gate.room.players[pid]?.ph === 'solving' || gate.room.players[pid]?.ph === 'inspecting') {
    return c.json({ error: 'player is timing' }, 409);
  }
  if (gate.room.start_at != null) return c.json({ error: 'round in progress' }, 409);
  if (netPlayerEvent(gate.room.players[pid], gate.room.event) === event) return c.json(stateJson(gate.room));
  let scramble: string;
  try {
    scramble = gate.room.scrambles[event]
      ?? await generateNetBattleScrambleForSlot(`${code}:${gate.room.round}:${event}`, event);
  }
  catch { return c.json({ error: 'scramble unavailable' }, 503); }
  const now = Date.now();

  const rows = await query<RoomRow>(
    `UPDATE battle_rooms
     SET players = players || jsonb_build_object(
           ?::text,
           (players -> ?) || jsonb_build_object(
             'event', ?::text, 'seen', ?::bigint, 'ph', 'idle', 'at', ?::bigint
           )
         ),
         scrambles = CASE
           WHEN jsonb_exists(scrambles, ?) OR (SELECT count(*) FROM jsonb_object_keys(scrambles)) >= ?
             THEN scrambles
           ELSE scrambles || jsonb_build_object(?::text, ?::jsonb)
         END,
         start_at = CASE WHEN start_at > ? THEN NULL ELSE start_at END,
         revision = revision + 1, updated_at = ?
     WHERE code = ? AND round = ?
       AND jsonb_exists(players, ?)
       AND player_auth ->> ? = ?
       AND NOT jsonb_exists(COALESCE(results -> round::text, '{}'::jsonb), ?)
       AND players -> ? ->> 'ph' IN ('idle', 'ready')
       AND start_at IS NULL
     RETURNING ${ROOM_COLS}`,
    [
      pid, pid, event, now, now,
      event, MAX_SCRAMBLE_EVENTS, event, scramble,
      now, now, code, gate.room.round, pid, pid, gate.tokenHash, pid, pid,
    ],
  );
  if (!rows[0]) {
    const current = await getRoomRow(code);
    if (!current) return c.json({ error: 'room not found' }, 404);
    if (!authorizedPlayer(current, pid, requestPlayerToken(c))) return c.json({ error: 'invalid player capability' }, 403);
    // A slow generator may finish after another request advances the room. The round CAS above
    // deliberately discards that old scramble; return the authoritative new state and let the
    // current-round UI retry its intent instead of misreporting a missing player.
    if (current.round !== gate.room.round) return c.json(stateJson(current));
    if (!isRoomRoundParticipant(current, pid)) return c.json({ error: 'wait for next round' }, 409);
    if (current.results[String(current.round)]?.[pid]) return c.json({ error: 'round already submitted' }, 409);
    if (current.players[pid]?.ph === 'solving' || current.players[pid]?.ph === 'inspecting') {
      return c.json({ error: 'player is timing' }, 409);
    }
    return c.json({ error: 'player not in room' }, 404);
  }
  return c.json(stateJson(rows[0]));
});

// POST /battle/rooms/:code/scramble — lazy 填某项目当前轮打乱(set-if-absent,同项目玩家共享)
battleRoomsRoutes.post('/battle/rooms/:code/scramble', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; event?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = isNetBattlePlayerId(body.pid) ? body.pid : null;
  const event = parseEvent(body.event);
  if (!pid || !event) return c.json({ error: 'invalid event' }, 400);

  const gate = await requirePlayer(code, pid, requestPlayerToken(c));
  if ('error' in gate) return c.json({ error: gate.error }, gate.status);
  if (!isRoomRoundParticipant(gate.room, pid)) return c.json({ error: 'wait for next round' }, 409);
  if (netPlayerEvent(gate.room.players[pid], gate.room.event) !== event) {
    return c.json({ error: 'event does not match player' }, 409);
  }
  if (gate.room.scrambles[event]) return c.json(stateJson(gate.room));
  let scramble: string;
  try { scramble = await generateNetBattleScrambleForSlot(`${code}:${gate.room.round}:${event}`, event); }
  catch { return c.json({ error: 'scramble unavailable' }, 503); }

  const now = Date.now();
  // set-if-absent:仅当该项目当前轮尚无打乱且未超上限时写入(行锁下原子,并发只一个生效)。
  const rows = await query<RoomRow>(
    `UPDATE battle_rooms
     SET scrambles = scrambles || jsonb_build_object(?::text, ?::jsonb),
         revision = revision + 1, updated_at = ?
     WHERE code = ? AND round = ?
       AND NOT jsonb_exists(scrambles, ?)
       AND (SELECT count(*) FROM jsonb_object_keys(scrambles)) < ?
       AND COALESCE(players -> ? ->> 'event', event) = ?
       AND player_auth ->> ? = ?
       AND (start_at IS NULL OR jsonb_exists(round_roster, ?))
     RETURNING ${ROOM_COLS}`,
    [event, scramble, now, code, gate.room.round, event, MAX_SCRAMBLE_EVENTS, pid, event, pid, gate.tokenHash, pid],
  );
  if (rows[0]) return c.json(stateJson(rows[0]));

  // 已被别人填了 / 超上限 / 房间不存在 —— 读当前状态返回(客户端自会采用已有的那条)
  const room = await getRoomRow(code);
  if (!room) return c.json({ error: 'room not found' }, 404);
  if (!authorizedPlayer(room, pid, requestPlayerToken(c))) return c.json({ error: 'invalid player capability' }, 403);
  if (!isRoomRoundParticipant(room, pid)) return c.json({ error: 'wait for next round' }, 409);
  if (netPlayerEvent(room.players[pid], room.event) !== event) return c.json({ error: 'event does not match player' }, 409);
  return c.json(stateJson(room));
});

// POST /battle/rooms/:code/result — 交本轮成绩(允许重复交 = 改罚时)
battleRoomsRoutes.post('/battle/rooms/:code/result', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; round?: unknown; t?: unknown; p?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = isNetBattlePlayerId(body.pid) ? body.pid : null;
  const reqRound = Number.isSafeInteger(body.round)
    && (body.round as number) >= 1
    && (body.round as number) <= MAX_ROUND
    ? (body.round as number)
    : null;
  const t = Number.isFinite(body.t) && (body.t as number) >= 0 && (body.t as number) < 24 * 3600_000
    ? Math.round(body.t as number) : null;
  const p = isNetPenalty(body.p) ? body.p : null;
  if (!pid || !reqRound || t == null || !p) return c.json({ error: 'invalid body' }, 400);

  const gate = await requirePlayer(code, pid, requestPlayerToken(c));
  if ('error' in gate) return c.json({ error: gate.error }, gate.status);

  const now = Date.now();
  const roundKey = String(reqRound);
  // 只在轮次仍是 reqRound 时合并(行锁下原子);合并同时把该玩家 ph 置 done。
  const rows = await query<RoomRow>(
    `UPDATE battle_rooms
     SET results = results || jsonb_build_object(
           ?::text,
           COALESCE(results -> ?, '{}'::jsonb) || jsonb_build_object(
             ?::text,
             CASE
               WHEN jsonb_exists(COALESCE(results -> ?, '{}'::jsonb), ?)
                 THEN (results -> ? -> ?) || jsonb_build_object('p', ?::text)
               ELSE ?::jsonb
             END
           )
         ),
         players = players || jsonb_build_object(?::text, (players -> ?) || ?::jsonb),
         revision = revision + 1, updated_at = ?
     WHERE code = ? AND round = ? AND jsonb_exists(players, ?) AND player_auth ->> ? = ?
       AND (
         jsonb_exists(COALESCE(results -> round::text, '{}'::jsonb), ?)
         OR (
           (NOT sync_start OR start_at IS NOT NULL)
           AND (start_at IS NULL OR jsonb_exists(round_roster, ?))
         )
       )
     RETURNING ${ROOM_COLS}`,
    [
      roundKey, roundKey, pid,
      roundKey, pid, roundKey, pid, p, { t, p },
      pid, pid, { ph: 'done', at: now, seen: now },
      now, code, reqRound, pid, pid, gate.tokenHash, pid, pid,
    ],
  );
  if (rows[0]) return c.json(stateJson(rows[0]));

  // 没写进去:房间没了 / 玩家没了 / 轮次已被别人推进 —— 复查区分
  const room = await getRoomRow(code);
  if (!room) return c.json({ error: 'room not found' }, 404);
  if (!authorizedPlayer(room, pid, requestPlayerToken(c))) return c.json({ error: 'invalid player capability' }, 403);
  if (reqRound < room.round) return c.json({ advanced: true, ...stateJson(room) });
  if (reqRound > room.round) return c.json({ error: 'round is ahead of room' }, 409);
  if (!isRoomRoundParticipant(room, pid)) return c.json({ error: 'wait for next round' }, 409);
  if (room.sync_start && room.start_at == null && !room.results[String(reqRound)]?.[pid]) {
    return c.json({ error: 'wait for synchronized start' }, 409);
  }
  return c.json({ error: 'result rejected' }, 409);
});

// POST /battle/rooms/:code/next — 开下一轮(CAS 只第一个成功);按项目分组结算胜者
battleRoomsRoutes.post('/battle/rooms/:code/next', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; round?: unknown; force?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = isNetBattlePlayerId(body.pid) ? body.pid : null;
  const reqRound = Number.isSafeInteger(body.round)
    && (body.round as number) >= 1
    && (body.round as number) <= MAX_ROUND
    ? (body.round as number)
    : null;
  const force = body.force === true;
  if (!pid || !reqRound) return c.json({ error: 'invalid body' }, 400);

  const playerToken = requestPlayerToken(c);
  const preflight = await requirePlayer(code, pid, playerToken);
  if ('error' in preflight) return c.json({ error: preflight.error }, preflight.status);
  if (reqRound < preflight.room.round) return c.json(stateJson(preflight.room));
  if (reqRound > preflight.room.round) return c.json({ error: 'round is ahead of room' }, 409);
  if (!isRoomRoundParticipant(preflight.room, pid)) return c.json({ error: 'wait for next round' }, 409);
  if (preflight.room.round >= MAX_ROUND) return c.json({ error: 'round limit reached' }, 409);
  if (!preflight.room.results[String(reqRound)]?.[pid]) {
    return c.json({ error: 'submit a result before advancing' }, 409);
  }
  if (!force && pendingCount(stateJson(preflight.room)) !== 0) {
    return c.json({ error: 'players are still solving' }, 409);
  }
  let scramble: string;
  try {
    const event = netPlayerEvent(preflight.room.players[pid], preflight.room.event);
    scramble = await generateNetBattleScrambleForSlot(`${code}:${reqRound + 1}:${event}`, event);
  } catch {
    return c.json({ error: 'scramble unavailable' }, 503);
  }
  const outcome = await withTransaction<
    { room: RoomRow } | { error: string; status: 403 | 404 | 409 }
  >(async (transactionQuery) => {
    // The room row must stay locked while the full JSON snapshots are derived and replaced.
    // Otherwise a concurrent join/kick/leave can be silently overwritten or resurrected.
    const locked = await transactionQuery<RoomRow>(
      `SELECT ${ROOM_COLS} FROM battle_rooms
       WHERE code = ?
         AND (SELECT count(*) FROM jsonb_object_keys(player_auth))
           = (SELECT count(*) FROM jsonb_object_keys(players))
       FOR UPDATE`,
      [code],
    );
    const room = locked[0];
    if (!room) return { error: 'room not found', status: 404 };
    if (!authorizedPlayer(room, pid, playerToken)) {
      return { error: 'invalid player capability', status: 403 };
    }
    // 已被别人推进 → 幂等返回当前状态(客户端直接用房间里的新打乱)
    if (reqRound < room.round) return { room };
    if (reqRound > room.round) return { error: 'round is ahead of room', status: 409 };
    if (!isRoomRoundParticipant(room, pid)) return { error: 'wait for next round', status: 409 };
    if (room.round >= MAX_ROUND) return { error: 'round limit reached', status: 409 };
    if (!room.results[String(reqRound)]?.[pid]) {
      return { error: 'submit a result before advancing', status: 409 };
    }
    // Web 的 waiting===0 只是交互门；服务端必须用同一个 shared 规则强制执行，
    // 否则持有合法 capability 的客户端仍可在别人计时中清空整轮。
    if (!force && pendingCount(stateJson(room)) !== 0) {
      return { error: 'players are still solving', status: 409 };
    }

    // 该轮各玩家项目快照(玩家可能中途改项目,历史与结算都按当轮记)。
    const participantIds = new Set(room.start_at == null ? Object.keys(room.players) : room.round_roster);
    const playerEvents: Record<string, NetBattleEventId> = {};
    for (const [id, pl] of Object.entries(room.players)) {
      if (participantIds.has(id)) playerEvents[id] = netPlayerEvent(pl, room.event);
    }

    // 按项目分组结算:各组最快计胜场(仅 ≥2 人的组)。winners 全存历史供展示。
    const roundResults = Object.fromEntries(
      Object.entries(room.results[String(reqRound)] ?? {}).filter(([id]) => participantIds.has(id)),
    );
    const { winners, scored } = settleNetRound(roundResults, playerEvents);
    const scores = { ...room.scores };
    for (const id of scored) scores[id] = (scores[id] ?? 0) + 1;

    // 把刚结束的一轮 {各项目打乱, 各人项目, 成绩, 胜者} 压进 history;超上限丢最旧。
    const historyEntry: RoomHistoryEntry = {
      round: reqRound, scrambles: room.scrambles ?? {}, playerEvents, results: roundResults, winners,
    };
    const history = [...(room.history ?? []), historyEntry].slice(-MAX_HISTORY);

    // 新一轮:results 清空,scrambles 只保留开轮者项目的新打乱(其余项目由各自玩家 lazy 填);
    // 全员 ph 重置回 idle,免得上一轮徽章串到新一轮。
    const now = Date.now();
    const advancerEvent = netPlayerEvent(room.players[pid], room.event);
    const scrambles: Record<string, string> = { [advancerEvent]: scramble };
    const players: Record<string, PlayerEntry> = {};
    for (const [id, pl] of Object.entries(room.players)) players[id] = { ...pl, ph: 'idle', at: now };

    const updated = await transactionQuery<RoomRow>(
      `UPDATE battle_rooms
       SET round = round + 1, scrambles = ?::jsonb, results = '{}'::jsonb, history = ?::jsonb,
           scores = ?::jsonb, players = ?::jsonb, start_at = NULL, round_roster = '[]'::jsonb,
           revision = revision + 1, updated_at = ?
       WHERE code = ? AND round = ? AND player_auth ->> ? = ?
       RETURNING ${ROOM_COLS}`,
      [scrambles, history, scores, players, now, code, reqRound, pid, hashBattlePlayerToken(playerToken as string)],
    );
    if (!updated[0]) return { error: 'invalid player capability', status: 403 };
    return { room: updated[0] };
  });

  if ('error' in outcome) return c.json({ error: outcome.error }, outcome.status);
  return c.json(stateJson(outcome.room));
});

/**
 * 房主操作的公共前置:取房 + 校验请求者就是当前房主。
 * 客户端隐藏按钮只是装饰,授权一律在这里做。
 */
async function requireAdmin(code: string, pid: string | null, token: unknown): Promise<
  { room: RoomRow; pid: string; tokenHash: string } | { error: string; status: 400 | 403 | 404 }
> {
  const gate = await requirePlayer(code, pid, token);
  if ('error' in gate) return gate;
  if (effectiveAdmin(gate.room) !== gate.pid) return { error: 'not admin', status: 403 };
  return gate;
}

// POST /battle/rooms/:code/settings — 房主改房设(目前只有「同时开始计时」)
battleRoomsRoutes.post('/battle/rooms/:code/settings', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; syncStart?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = isNetBattlePlayerId(body.pid) ? body.pid : null;
  if (typeof body.syncStart !== 'boolean') return c.json({ error: 'invalid body' }, 400);
  const syncStart = body.syncStart;

  const gate = await requireAdmin(code, pid, requestPlayerToken(c));
  if ('error' in gate) return c.json({ error: gate.error }, gate.status);
  const currentResults = gate.room.results[String(gate.room.round)] ?? {};
  const hasActivePlayer = Object.values(gate.room.players)
    .some((player) => player.ph === 'inspecting' || player.ph === 'solving');
  if (syncStart && !gate.room.sync_start
    && (gate.room.start_at != null || hasActivePlayer || Object.keys(currentResults).length > 0)) {
    return c.json({ error: 'round already active' }, 409);
  }

  // 关掉开关只取消尚未到点的倒计时。已经起表的本轮继续保留 roster，
  // 否则非本轮玩家会在中途突然获得交卷权。
  const now = Date.now();
  const rows = await query<RoomRow>(
    `UPDATE battle_rooms
     SET sync_start = ?,
         start_at = CASE
           WHEN NOT ? AND start_at > (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint THEN NULL
           ELSE start_at
         END,
         round_roster = CASE
           WHEN NOT ? AND start_at > (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint THEN '[]'::jsonb
           ELSE round_roster
         END,
         revision = revision + 1, updated_at = ?
     WHERE code = ? AND player_auth ->> ? = ? AND ${EFFECTIVE_ADMIN_SQL} = ?
       AND (
         NOT ? OR sync_start OR (
           start_at IS NULL
           AND (SELECT count(*) FROM jsonb_object_keys(COALESCE(results -> round::text, '{}'::jsonb))) = 0
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_each(players) AS e(key, value)
             WHERE e.value ->> 'ph' IN ('inspecting', 'solving')
           )
         )
       )
     RETURNING ${ROOM_COLS}`,
    [syncStart, syncStart, syncStart, now, code, gate.pid, gate.tokenHash, gate.pid, syncStart],
  );
  if (!rows[0]) {
    return syncStart
      ? c.json({ error: 'round already active' }, 409)
      : c.json({ error: 'not admin' }, 403);
  }
  return c.json(stateJson(rows[0]));
});

// POST /battle/rooms/:code/admin — 转让房主给房里另一位玩家
battleRoomsRoutes.post('/battle/rooms/:code/admin', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; target?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = isNetBattlePlayerId(body.pid) ? body.pid : null;
  const target = isNetBattlePlayerId(body.target) ? body.target : null;
  if (!pid) return c.json({ error: 'invalid pid' }, 400);
  if (!target) return c.json({ error: 'invalid target' }, 400);

  const gate = await requireAdmin(code, pid, requestPlayerToken(c));
  if ('error' in gate) return c.json({ error: gate.error }, gate.status);
  if (!gate.room.players[target]) return c.json({ error: 'player not in room' }, 404);

  const rows = await query<RoomRow>(
    `UPDATE battle_rooms SET admin = ?, revision = revision + 1, updated_at = ?
     WHERE code = ? AND jsonb_exists(players, ?)
       AND player_auth ->> ? = ? AND ${EFFECTIVE_ADMIN_SQL} = ?
     RETURNING ${ROOM_COLS}`,
    [target, Date.now(), code, target, gate.pid, gate.tokenHash, gate.pid],
  );
  if (!rows[0]) return c.json({ error: 'player not in room' }, 404);
  return c.json(stateJson(rows[0]));
});

// POST /battle/rooms/:code/kick — 房主把某位玩家移出房间(不能踢自己)
battleRoomsRoutes.post('/battle/rooms/:code/kick', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; target?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = isNetBattlePlayerId(body.pid) ? body.pid : null;
  const target = isNetBattlePlayerId(body.target) ? body.target : null;
  if (!pid) return c.json({ error: 'invalid pid' }, 400);
  if (!target) return c.json({ error: 'invalid target' }, 400);
  if (target === pid) return c.json({ error: 'cannot kick yourself' }, 400);

  const playerToken = requestPlayerToken(c);
  const outcome = await withTransaction<
    | { room: RoomRow; previousVideoGeneration: string }
    | { error: string; status: 403 | 404 }
  >(async (transactionQuery) => {
    const locked = await transactionQuery<RoomRow>(
      `SELECT ${ROOM_COLS} FROM battle_rooms
       WHERE code = ?
         AND (SELECT count(*) FROM jsonb_object_keys(player_auth))
           = (SELECT count(*) FROM jsonb_object_keys(players))
       FOR UPDATE`,
      [code],
    );
    const room = locked[0];
    if (!room) return { error: 'room not found', status: 404 };
    if (!authorizedPlayer(room, pid, playerToken) || effectiveAdmin(room) !== pid) {
      return { error: 'not admin', status: 403 };
    }
    if (!room.players[target]) return { error: 'player not in room', status: 404 };
    const rows = await transactionQuery<RoomRow>(
      `UPDATE battle_rooms
       SET players = players - ?, scores = scores - ?, player_auth = player_auth - ?,
           start_at = CASE WHEN start_at IS NOT NULL AND jsonb_array_length(round_roster - ?) = 0 THEN NULL ELSE start_at END,
           results = CASE WHEN start_at IS NOT NULL AND jsonb_array_length(round_roster - ?) = 0 THEN '{}'::jsonb ELSE results END,
           round_roster = round_roster - ?, video_generation = gen_random_uuid(),
           revision = revision + 1, updated_at = ?
       WHERE code = ? AND jsonb_exists(players, ?) AND player_auth ->> ? = ?
       RETURNING ${ROOM_COLS}`,
      [target, target, target, target, target, target, Date.now(), code, target, pid, hashBattlePlayerToken(playerToken as string)],
    );
    return rows[0]
      ? { room: rows[0], previousVideoGeneration: room.video_generation }
      : { error: 'not admin', status: 403 };
  });
  if ('error' in outcome) return c.json({ error: outcome.error }, outcome.status);
  await retireBattleVideoGeneration(code, outcome.previousVideoGeneration);
  return c.json(stateJson(outcome.room));
});

// POST /battle/rooms/:code/leave — 离开;房间空了即删
battleRoomsRoutes.post('/battle/rooms/:code/leave', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = isNetBattlePlayerId(body.pid) ? body.pid : null;
  if (!pid) return c.json({ error: 'invalid pid' }, 400);

  const playerToken = requestPlayerToken(c);
  const outcome = await withTransaction<
    | { players: Record<string, PlayerEntry>; previousVideoGeneration: string }
    | { error: string; status: 403 | 404 }
  >(async (transactionQuery) => {
    const locked = await transactionQuery<RoomRow>(
      `SELECT ${ROOM_COLS} FROM battle_rooms
       WHERE code = ?
         AND (SELECT count(*) FROM jsonb_object_keys(player_auth))
           = (SELECT count(*) FROM jsonb_object_keys(players))
       FOR UPDATE`,
      [code],
    );
    const room = locked[0];
    if (!room) return { error: 'room not found', status: 404 };
    if (!authorizedPlayer(room, pid, playerToken)) {
      return { error: 'invalid player capability', status: 403 };
    }
    const rows = await transactionQuery<{ players: Record<string, PlayerEntry> }>(
      `UPDATE battle_rooms
       SET players = players - ?, scores = scores - ?, player_auth = player_auth - ?,
           start_at = CASE WHEN start_at IS NOT NULL AND jsonb_array_length(round_roster - ?) = 0 THEN NULL ELSE start_at END,
           results = CASE WHEN start_at IS NOT NULL AND jsonb_array_length(round_roster - ?) = 0 THEN '{}'::jsonb ELSE results END,
           round_roster = round_roster - ?, video_generation = gen_random_uuid(),
           revision = revision + 1, updated_at = ?
       WHERE code = ? AND jsonb_exists(players, ?) AND player_auth ->> ? = ?
       RETURNING players`,
      [pid, pid, pid, pid, pid, pid, Date.now(), code, pid, pid, hashBattlePlayerToken(playerToken as string)],
    );
    return rows[0]
      ? { players: rows[0].players, previousVideoGeneration: room.video_generation }
      : { error: 'invalid player capability', status: 403 };
  });
  if ('error' in outcome) return c.json({ error: outcome.error }, outcome.status);
  if (Object.keys(outcome.players).length === 0) {
    await query(`DELETE FROM battle_rooms WHERE code = ? AND players = '{}'::jsonb`, [code]);
  }
  await retireBattleVideoGeneration(code, outcome.previousVideoGeneration);
  return c.json({ ok: true });
});
