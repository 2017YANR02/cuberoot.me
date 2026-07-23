import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/battle/rooms — /timer 联机对战房间(多设备,各自设备计时)。
 *
 * 项目模型:每人可选自己的项目(默认 = 建房项目),**同项目玩家共享同一条打乱**(公平),
 * 不同项目各持一条。房间用 `scrambles: {event: scramble}` 存当前轮各项目的打乱,谁先需要
 * 某项目的打乱谁 lazy 生成并 set-if-absent 填进去。胜负按「同项目分组」判,各组最快各计一胜。
 *
 *   POST /battle/rooms                    — 建房:{event,scramble,name} → {playerId, ...state}
 *   POST /battle/rooms/:code/join         — 加入:{name} → {playerId, ...state}(默认项目=房间项目)
 *   GET  /battle/rooms/:code?pid=X        — 房间状态(轮询;带 pid 时顺手刷新在线心跳)
 *   POST /battle/rooms/:code/status       — 实时状态:{pid,ph}(idle|ready|inspecting|solving)
 *   POST /battle/rooms/:code/event        — 改自己项目:{pid,event,scramble}(顺带 lazy 填该项目打乱)
 *   POST /battle/rooms/:code/scramble     — lazy 填某项目当前轮打乱:{event,scramble}(set-if-absent)
 *   POST /battle/rooms/:code/result       — 交成绩:{pid,round,t,p};轮次落后 → {advanced,...state}
 *   POST /battle/rooms/:code/next         — 开下一轮(CAS 只第一个成功):{pid,round,scramble}
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
 * 无需登录 —— 房间码即房间身份,随机 playerId 即玩家身份。成绩/状态都是单行 jsonb 原子合并
 * (行锁串行化),实时性 = 客户端 1s 轮询 GET(no-store)。响应都带 now(服务器毫秒),客户端
 * 据此估时钟偏移,把对手 solving 的 at 换算成本地滚动计时。
 *
 * 注意:query() 会把 SQL 里所有 `?` 重写成 $n,jsonb 存在性判断必须用 jsonb_exists() 函数形式,
 * 不能写 `players ? pid` 操作符。::jsonb 参数一律传裸对象(postgres.js 自己序列化),禁预先
 * JSON.stringify(会双重编码成 jsonb 字符串标量)。
 */
export const battleRoomsRoutes = new Hono();

/** 房间码字母表:去掉易混的 0/O/1/I/L(与 trainer_rooms 一致)。 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 5;
const MAX_PLAYERS = 8;
const NAME_MAX = 24;
const SCRAMBLE_MAX = 1200;
/** 单轮历史上限:防 jsonb 无界膨胀(超过就丢最旧的)。 */
const MAX_HISTORY = 50;
/** 当前轮打乱表(scrambles)项目数上限:防恶意 /event 刷不同项目撑爆 jsonb。 */
const MAX_SCRAMBLE_EVENTS = 16;
/** 过期房间:24h 无活动惰性清理。 */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** 心跳超时:与客户端 OFFLINE_MS 同口径(轮询 1s,给足抖动余量)。 */
const OFFLINE_MS = 15_000;
/** 「同时开始」倒计时:全员准备到起表的提前量(> 轮询周期,慢的一端也来得及看到)。 */
const COUNTDOWN_MS = 3_000;

const CODE_RE = /^[A-Z0-9]{4,12}$/;
const EVENT_RE = /^[A-Za-z0-9]{2,16}$/;
const PID_RE = /^[a-z0-9]{6,16}$/;
const WCA_ID_RE = /^\d{4}[A-Z]{4}\d{2}$/;
const ISO2_RE = /^[A-Za-z]{2}$/;
const PHASES = new Set(['idle', 'ready', 'inspecting', 'solving']);
const PENALTIES = new Set(['ok', '+2', 'dnf']);

function randCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

function randPid(): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)];
  return s;
}

function parseCode(raw: string | undefined): string | null {
  const s = (raw ?? '').trim().toUpperCase();
  return CODE_RE.test(s) ? s : null;
}

function parseEvent(raw: unknown): string | null {
  return typeof raw === 'string' && EVENT_RE.test(raw) ? raw : null;
}

/** 玩家名:去首尾空白、压缩连续空白、截断;空的给默认名。 */
function sanitizeName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX) : '';
  return s || 'Cuber';
}

function parseScramble(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > SCRAMBLE_MAX) return null;
  return s;
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

interface PlayerEntry { name: string; wcaId?: string; iso2?: string; joined: number; seen: number; ph: string; at: number; event: string }
interface RoomResult { t: number; p: string }
interface RoomHistoryEntry {
  round: number;
  /** 该轮各项目的打乱(玩家按当轮 playerEvents 里的自己项目取用)。 */
  scrambles: Record<string, string>;
  /** 该轮各玩家所选项目快照(玩家可能中途改项目,历史要按当轮记)。 */
  playerEvents: Record<string, string>;
  results: Record<string, RoomResult>;
  winners: string[];
}
interface RoomRow {
  code: string;
  event: string;                                   // 房间默认项目(新加入者的默认)
  round: number;
  scrambles: Record<string, string>;               // 当前轮各项目打乱 {event: scramble}
  players: Record<string, PlayerEntry>;
  results: Record<string, Record<string, RoomResult>>;
  history: RoomHistoryEntry[];
  scores: Record<string, number>;
  admin: string | null;                            // 房主 pid(不在房里则读时回落最早加入者)
  sync_start: boolean;                             // 是否要求全员同时起表
  start_at: string | number | null;                // 本轮同时起表时刻(BIGINT,driver 可能给字符串)
}

const ROOM_COLS = 'code, event, round, scrambles, players, results, history, scores, admin, sync_start, start_at';

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
    code: r.code, event: r.event, round: r.round, scrambles: r.scrambles ?? {},
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
function allReady(r: RoomRow, now: number): boolean {
  const res = r.results[String(r.round)] ?? {};
  const contenders = Object.entries(r.players).filter(([id, p]) => now - p.seen <= OFFLINE_MS && !res[id]);
  if (contenders.length < 2) return false;
  return contenders.every(([, p]) => p.ph === 'ready');
}

async function getRoomRow(code: string): Promise<RoomRow | null> {
  const rows = await query<RoomRow>(`SELECT ${ROOM_COLS} FROM battle_rooms WHERE code = ?`, [code]);
  return rows[0] ?? null;
}

/** 玩家当前项目(缺省回落房间默认项目,兼容早期无 event 字段的行)。 */
function playerEvent(pl: PlayerEntry | undefined, roomDefault: string): string {
  return pl?.event || roomDefault;
}

/** 有效成绩:dnf → Infinity,+2 → t+2000。 */
function effectiveMs(r: { t: number; p: string }): number {
  if (r.p === 'dnf') return Infinity;
  return r.p === '+2' ? r.t + 2000 : r.t;
}

/**
 * 按「同项目分组」结算一轮:各组最快有效成绩者(可并列)是该组胜者。
 * 返回 { winners: 全部组胜者, scored: 应计胜场者(仅 ≥2 人的组) }。
 */
function settleRound(
  results: Record<string, RoomResult>,
  playerEvents: Record<string, string>,
): { winners: string[]; scored: string[] } {
  const byEvent: Record<string, Array<[string, RoomResult]>> = {};
  for (const [id, r] of Object.entries(results)) {
    if (!playerEvents[id]) continue; // 已离场玩家不计
    (byEvent[playerEvents[id]] ??= []).push([id, r]);
  }
  const winners: string[] = [];
  const scored: string[] = [];
  for (const grp of Object.values(byEvent)) {
    const best = Math.min(...grp.map(([, r]) => effectiveMs(r)));
    if (!Number.isFinite(best)) continue;
    const w = grp.filter(([, r]) => effectiveMs(r) === best).map(([id]) => id);
    winners.push(...w);
    if (grp.length >= 2) scored.push(...w);
  }
  return { winners, scored };
}

// POST /battle/rooms — 建房(建房者即首位玩家,项目 = 建房项目)
battleRoomsRoutes.post('/battle/rooms', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));

  let body: { event?: unknown; scramble?: unknown; name?: unknown; wcaId?: unknown; iso2?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid body' }, 400); }

  const event = parseEvent(body.event);
  const scramble = parseScramble(body.scramble);
  if (!event || !scramble) return c.json({ error: 'invalid event/scramble' }, 400);
  const name = sanitizeName(body.name);
  const wcaId = parseWcaId(body.wcaId);
  const iso2 = parseIso2(body.iso2);

  const now = Date.now();
  // 惰性清理:顺手删掉过期房间(不阻塞主流程)
  query('DELETE FROM battle_rooms WHERE updated_at < ?', [now - ROOM_TTL_MS]).catch(() => {});

  const pid = randPid();
  const players: Record<string, PlayerEntry> = {
    [pid]: { name, ...(wcaId ? { wcaId } : {}), ...(iso2 ? { iso2 } : {}), joined: now, seen: now, ph: 'idle', at: now, event },
  };
  const scrambles: Record<string, string> = { [event]: scramble };

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randCode();
    try {
      await query(
        `INSERT INTO battle_rooms (code, event, round, scrambles, players, results, history, scores, admin, created_at, updated_at)
         VALUES (?, ?, 1, ?::jsonb, ?::jsonb, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, ?, ?, ?)`,
        [code, event, scrambles, players, pid, now, now],
      );
      return c.json({
        playerId: pid, code, event, round: 1, scrambles, players, results: {}, history: [], scores: {},
        admin: pid, syncStart: false, startAt: null, now,
      });
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
  const pid = randPid();
  // 重名不拒绝,自动加后缀去重:同一 WCA ID 两台设备也能同房对战,名字用「名 (2)」区分。
  // 每次算出的唯一名再用 NOT EXISTS 原子写入(行锁下),并发抢到同名则重读重算,最多试几次。
  for (let attempt = 0; attempt < MAX_PLAYERS + 4; attempt++) {
    const cur = await getRoomRow(code);
    if (!cur) return c.json({ error: 'room not found' }, 404);
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
       SET players = players || jsonb_build_object(?::text, ?::jsonb), updated_at = ?
       WHERE code = ?
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_each(b.players) AS e(k, v)
           WHERE lower(v ->> 'name') = lower(?)
         )
       RETURNING ${ROOM_COLS}`,
      [pid, entry, now, code, finalName],
    );
    if (rows[0]) return c.json({ playerId: pid, ...stateJson(rows[0]) });
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
  const pid = PID_RE.test(pidRaw) ? pidRaw : null;

  if (pid) {
    const now = Date.now();
    // 心跳合并 + 读取一次往返;pid 不在房里(被清/伪造)则不 touch,走下面纯读。
    const rows = await query<RoomRow>(
      `UPDATE battle_rooms
       SET players = players || jsonb_build_object(?::text, (players -> ?) || jsonb_build_object('seen', ?::bigint)),
           updated_at = ?
       WHERE code = ? AND jsonb_exists(players, ?)
       RETURNING ${ROOM_COLS}`,
      [pid, pid, now, now, code, pid],
    );
    if (rows[0]) return c.json(stateJson(rows[0]));
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
  const pid = typeof body.pid === 'string' && PID_RE.test(body.pid) ? body.pid : null;
  const ph = typeof body.ph === 'string' && PHASES.has(body.ph) ? body.ph : null;
  if (!pid || !ph) return c.json({ error: 'invalid pid/ph' }, 400);

  const now = Date.now();
  const rows = await query<RoomRow>(
    `UPDATE battle_rooms
     SET players = players || jsonb_build_object(?::text, (players -> ?) || ?::jsonb), updated_at = ?
     WHERE code = ? AND jsonb_exists(players, ?)
     RETURNING ${ROOM_COLS}`,
    [pid, pid, { ph, at: now, seen: now }, now, code, pid],
  );
  let room = rows[0];
  if (!room) return c.json({ error: 'room or player not found' }, 404);

  // 「同时开始」:这一跳把最后一个人置成 ready 了 → 落倒计时起点(set-if-null,并发只一个生效)。
  if (ph === 'ready' && room.sync_start && room.start_at == null && allReady(room, now)) {
    const upd = await query<RoomRow>(
      `UPDATE battle_rooms SET start_at = ?, updated_at = ?
       WHERE code = ? AND start_at IS NULL
       RETURNING ${ROOM_COLS}`,
      [now + COUNTDOWN_MS, now, code],
    );
    if (upd[0]) room = upd[0];
  }
  return c.json(stateJson(room));
});

// POST /battle/rooms/:code/event — 玩家改自己项目 + lazy 填该项目当前轮打乱
battleRoomsRoutes.post('/battle/rooms/:code/event', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; event?: unknown; scramble?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = typeof body.pid === 'string' && PID_RE.test(body.pid) ? body.pid : null;
  const event = parseEvent(body.event);
  const scramble = parseScramble(body.scramble);
  if (!pid || !event || !scramble) return c.json({ error: 'invalid body' }, 400);

  const room = await getRoomRow(code);
  if (!room) return c.json({ error: 'room not found' }, 404);
  if (!room.players[pid]) return c.json({ error: 'player not in room' }, 404);

  const now = Date.now();
  const scrambles = { ...(room.scrambles ?? {}) };
  // lazy 填该项目打乱(已有则沿用,不覆盖 —— 同项目玩家共享;上限内才加防刷)
  if (!(event in scrambles) && Object.keys(scrambles).length < MAX_SCRAMBLE_EVENTS) {
    scrambles[event] = scramble;
  }
  const player: PlayerEntry = { ...room.players[pid], event, seen: now };

  const rows = await query<RoomRow>(
    `UPDATE battle_rooms
     SET players = players || jsonb_build_object(?::text, ?::jsonb), scrambles = ?::jsonb, updated_at = ?
     WHERE code = ? AND jsonb_exists(players, ?)
     RETURNING ${ROOM_COLS}`,
    [pid, player, scrambles, now, code, pid],
  );
  if (!rows[0]) return c.json({ error: 'room or player not found' }, 404);
  return c.json(stateJson(rows[0]));
});

// POST /battle/rooms/:code/scramble — lazy 填某项目当前轮打乱(set-if-absent,同项目玩家共享)
battleRoomsRoutes.post('/battle/rooms/:code/scramble', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { event?: unknown; scramble?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const event = parseEvent(body.event);
  const scramble = parseScramble(body.scramble);
  if (!event || !scramble) return c.json({ error: 'invalid event/scramble' }, 400);

  const now = Date.now();
  // set-if-absent:仅当该项目当前轮尚无打乱且未超上限时写入(行锁下原子,并发只一个生效)。
  const rows = await query<RoomRow>(
    `UPDATE battle_rooms
     SET scrambles = scrambles || jsonb_build_object(?::text, ?::jsonb), updated_at = ?
     WHERE code = ?
       AND NOT jsonb_exists(scrambles, ?)
       AND (SELECT count(*) FROM jsonb_object_keys(scrambles)) < ?
     RETURNING ${ROOM_COLS}`,
    [event, scramble, now, code, event, MAX_SCRAMBLE_EVENTS],
  );
  if (rows[0]) return c.json(stateJson(rows[0]));

  // 已被别人填了 / 超上限 / 房间不存在 —— 读当前状态返回(客户端自会采用已有的那条)
  const room = await getRoomRow(code);
  if (!room) return c.json({ error: 'room not found' }, 404);
  return c.json(stateJson(room));
});

// POST /battle/rooms/:code/result — 交本轮成绩(允许重复交 = 改罚时)
battleRoomsRoutes.post('/battle/rooms/:code/result', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; round?: unknown; t?: unknown; p?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = typeof body.pid === 'string' && PID_RE.test(body.pid) ? body.pid : null;
  const reqRound = Number.isInteger(body.round) && (body.round as number) >= 1 ? (body.round as number) : null;
  const t = Number.isFinite(body.t) && (body.t as number) >= 0 && (body.t as number) < 24 * 3600_000
    ? Math.round(body.t as number) : null;
  const p = typeof body.p === 'string' && PENALTIES.has(body.p) ? body.p : null;
  if (!pid || !reqRound || t == null || !p) return c.json({ error: 'invalid body' }, 400);

  const now = Date.now();
  const roundKey = String(reqRound);
  // 只在轮次仍是 reqRound 时合并(行锁下原子);合并同时把该玩家 ph 置 done。
  const rows = await query<RoomRow>(
    `UPDATE battle_rooms
     SET results = results || jsonb_build_object(?::text, COALESCE(results -> ?, '{}'::jsonb) || jsonb_build_object(?::text, ?::jsonb)),
         players = players || jsonb_build_object(?::text, (players -> ?) || ?::jsonb),
         updated_at = ?
     WHERE code = ? AND round = ? AND jsonb_exists(players, ?)
     RETURNING ${ROOM_COLS}`,
    [
      roundKey, roundKey, pid, { t, p },
      pid, pid, { ph: 'done', at: now, seen: now },
      now, code, reqRound, pid,
    ],
  );
  if (rows[0]) return c.json(stateJson(rows[0]));

  // 没写进去:房间没了 / 玩家没了 / 轮次已被别人推进 —— 复查区分
  const room = await getRoomRow(code);
  if (!room) return c.json({ error: 'room not found' }, 404);
  if (!room.players[pid]) return c.json({ error: 'player not in room' }, 404);
  return c.json({ advanced: true, ...stateJson(room) });
});

// POST /battle/rooms/:code/next — 开下一轮(CAS 只第一个成功);按项目分组结算胜者
battleRoomsRoutes.post('/battle/rooms/:code/next', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; round?: unknown; scramble?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = typeof body.pid === 'string' && PID_RE.test(body.pid) ? body.pid : null;
  const reqRound = Number.isInteger(body.round) && (body.round as number) >= 1 ? (body.round as number) : null;
  const scramble = parseScramble(body.scramble);
  if (!pid || !reqRound || !scramble) return c.json({ error: 'invalid body' }, 400);

  const room = await getRoomRow(code);
  if (!room) return c.json({ error: 'room not found' }, 404);
  if (!room.players[pid]) return c.json({ error: 'player not in room' }, 404);
  // 已被别人推进 → 幂等返回当前状态(客户端直接用房间里的新打乱)
  if (room.round !== reqRound) return c.json(stateJson(room));

  // 该轮各玩家项目快照(玩家可能中途改项目,历史与结算都按当轮记)。
  const playerEvents: Record<string, string> = {};
  for (const [id, pl] of Object.entries(room.players)) playerEvents[id] = playerEvent(pl, room.event);

  // 按项目分组结算:各组最快计胜场(仅 ≥2 人的组)。winners 全存历史供展示。
  const roundResults = room.results[String(reqRound)] ?? {};
  const { winners, scored } = settleRound(roundResults, playerEvents);
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
  const advancerEvent = playerEvent(room.players[pid], room.event);
  const scrambles: Record<string, string> = { [advancerEvent]: scramble };
  const players: Record<string, PlayerEntry> = {};
  for (const [id, pl] of Object.entries(room.players)) players[id] = { ...pl, ph: 'idle', at: now };

  const upd = await query<RoomRow>(
    `UPDATE battle_rooms
     SET round = round + 1, scrambles = ?::jsonb, results = '{}'::jsonb, history = ?::jsonb,
         scores = ?::jsonb, players = ?::jsonb, start_at = NULL, updated_at = ?
     WHERE code = ? AND round = ?
     RETURNING ${ROOM_COLS}`,
    [scrambles, history, scores, players, now, code, reqRound],
  );
  if (upd[0]) return c.json(stateJson(upd[0]));

  // CAS 落空(SELECT 与 UPDATE 之间被别人抢先)→ 读当前状态返回
  const after = await getRoomRow(code);
  if (!after) return c.json({ error: 'room not found' }, 404);
  return c.json(stateJson(after));
});

/**
 * 房主操作的公共前置:取房 + 校验请求者就是当前房主。
 * 客户端隐藏按钮只是装饰,授权一律在这里做。
 */
async function requireAdmin(code: string, pid: string | null): Promise<
  { room: RoomRow } | { error: string; status: 400 | 403 | 404 }
> {
  if (!pid) return { error: 'invalid pid', status: 400 };
  const room = await getRoomRow(code);
  if (!room) return { error: 'room not found', status: 404 };
  if (effectiveAdmin(room) !== pid) return { error: 'not admin', status: 403 };
  return { room };
}

// POST /battle/rooms/:code/settings — 房主改房设(目前只有「同时开始计时」)
battleRoomsRoutes.post('/battle/rooms/:code/settings', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; syncStart?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = typeof body.pid === 'string' && PID_RE.test(body.pid) ? body.pid : null;
  if (typeof body.syncStart !== 'boolean') return c.json({ error: 'invalid body' }, 400);
  const syncStart = body.syncStart;

  const gate = await requireAdmin(code, pid);
  if ('error' in gate) return c.json({ error: gate.error }, gate.status);

  // 关掉开关同时清 start_at:别把已经在倒计时的人挂在半空。
  const rows = await query<RoomRow>(
    `UPDATE battle_rooms
     SET sync_start = ?, start_at = CASE WHEN ? THEN start_at ELSE NULL END, updated_at = ?
     WHERE code = ?
     RETURNING ${ROOM_COLS}`,
    [syncStart, syncStart, Date.now(), code],
  );
  if (!rows[0]) return c.json({ error: 'room not found' }, 404);
  return c.json(stateJson(rows[0]));
});

// POST /battle/rooms/:code/admin — 转让房主给房里另一位玩家
battleRoomsRoutes.post('/battle/rooms/:code/admin', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown; target?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = typeof body.pid === 'string' && PID_RE.test(body.pid) ? body.pid : null;
  const target = typeof body.target === 'string' && PID_RE.test(body.target) ? body.target : null;
  if (!target) return c.json({ error: 'invalid target' }, 400);

  const gate = await requireAdmin(code, pid);
  if ('error' in gate) return c.json({ error: gate.error }, gate.status);
  if (!gate.room.players[target]) return c.json({ error: 'player not in room' }, 404);

  const rows = await query<RoomRow>(
    `UPDATE battle_rooms SET admin = ?, updated_at = ?
     WHERE code = ? AND jsonb_exists(players, ?)
     RETURNING ${ROOM_COLS}`,
    [target, Date.now(), code, target],
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
  const pid = typeof body.pid === 'string' && PID_RE.test(body.pid) ? body.pid : null;
  const target = typeof body.target === 'string' && PID_RE.test(body.target) ? body.target : null;
  if (!target) return c.json({ error: 'invalid target' }, 400);
  if (target === pid) return c.json({ error: 'cannot kick yourself' }, 400);

  const gate = await requireAdmin(code, pid);
  if ('error' in gate) return c.json({ error: gate.error }, gate.status);

  // 被踢者的成绩留在 results/history(战绩回放不该出现空洞),只摘玩家与胜场。
  const rows = await query<RoomRow>(
    `UPDATE battle_rooms SET players = players - ?, scores = scores - ?, updated_at = ?
     WHERE code = ?
     RETURNING ${ROOM_COLS}`,
    [target, target, Date.now(), code],
  );
  if (!rows[0]) return c.json({ error: 'room not found' }, 404);
  return c.json(stateJson(rows[0]));
});

// POST /battle/rooms/:code/leave — 离开;房间空了即删
battleRoomsRoutes.post('/battle/rooms/:code/leave', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { pid?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const pid = typeof body.pid === 'string' && PID_RE.test(body.pid) ? body.pid : null;
  if (!pid) return c.json({ error: 'invalid pid' }, 400);

  const rows = await query<{ players: Record<string, PlayerEntry> }>(
    `UPDATE battle_rooms
     SET players = players - ?, scores = scores - ?, updated_at = ?
     WHERE code = ?
     RETURNING players`,
    [pid, pid, Date.now(), code],
  );
  if (!rows[0]) return c.json({ error: 'room not found' }, 404);
  if (Object.keys(rows[0].players).length === 0) {
    await query('DELETE FROM battle_rooms WHERE code = ?', [code]);
  }
  return c.json({ ok: true });
});
