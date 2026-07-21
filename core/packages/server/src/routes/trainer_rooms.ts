import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/trainer/rooms — 公式训练器「协同房间」(多设备在线复习分工)。
 *
 *   POST /trainer/rooms                  — 建房:{puzzle,set,order,keys[]} → {code,round,total,order}
 *   GET  /trainer/rooms/:code            — 房间状态(轮询合并进度):{round,total,claimed,done,...}
 *   POST /trainer/rooms/:code/claim      — 领取下一题:{round,count?} → {caseKey,index,cases,round,total} | {done} | {advanced}
 *                                          count(默认1,夹1..12)一次占多格(三条一屏);cases[]=本次领到的格,
 *                                          顶层 caseKey/index=首格(兼容旧前端);一次 HTTP = 一次限流额度
 *   POST /trainer/rooms/:code/next-round — 开下一轮(CAS,只第一个成功):{round} → {round,total}
 *
 * 无需登录 —— 房间码即身份。核心是「领取」原子出队:一条 UPDATE 把游标 +1 并返回该格 case_key,
 * PG 行锁保证多设备并发下每格只发一次 ⟹ 各设备拿到的 case 天然不重不漏、动态均衡。
 * 队列由服务端持有(乱序时服务端洗),所以两台不必自己对齐 seed —— 交给房间。
 * 打乱字符串仍由客户端按 case_key 本地生成(房间只协调「谁做哪个 case」)。
 */
export const trainerRoomsRoutes = new Hono();

/** 房间码字母表:去掉易混的 0/O/1/I/L。 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 5;
/** 单个房间池上限(1LLL ~3915,留余量)。 */
const MAX_KEYS = 5000;
const MAX_KEY_LEN = 160;
/** 过期房间:24h 无活动惰性清理。 */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

function randCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

/** Fisher-Yates(服务端每轮洗一次;不需要密码学强度)。 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CODE_RE = /^[A-Z0-9]{4,12}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,48}$/;

function parseCode(raw: string | undefined): string | null {
  const s = (raw ?? '').trim().toUpperCase();
  return CODE_RE.test(s) ? s : null;
}

/** 校验 keys:非空字符串数组、条数与单条长度设上限、去重后仍非空。 */
function parseKeys(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0 || raw.length > MAX_KEYS) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of raw) {
    if (typeof k !== 'string') return null;
    const s = k.trim();
    if (!s || s.length > MAX_KEY_LEN) return null;
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out.length > 0 ? out : null;
}

interface RoomRow {
  code: string;
  puzzle: string;
  set_slug: string;
  order_mode: 'seq' | 'shuffle';
  keys: string[];
  round: number;
  queue: string[];
  next_index: number;
  total: number;
}

// POST /trainer/rooms — 建房
trainerRoomsRoutes.post('/trainer/rooms', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));

  let body: { puzzle?: unknown; set?: unknown; order?: unknown; keys?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid body' }, 400); }

  const puzzle = typeof body.puzzle === 'string' ? body.puzzle.trim() : '';
  const setSlug = typeof body.set === 'string' ? body.set.trim() : '';
  if (!ID_RE.test(puzzle) || !ID_RE.test(setSlug)) return c.json({ error: 'invalid puzzle/set' }, 400);
  const order = body.order === 'seq' ? 'seq' : 'shuffle';
  const keys = parseKeys(body.keys);
  if (!keys) return c.json({ error: 'invalid keys' }, 400);

  const queue = order === 'seq' ? keys : shuffle(keys);
  const now = Date.now();

  // 惰性清理:顺手删掉过期房间(不阻塞主流程,错了也无所谓)
  query('DELETE FROM trainer_rooms WHERE updated_at < ?', [now - ROOM_TTL_MS]).catch(() => {});

  // 生成不重复房间码(极小概率撞了重试)
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randCode();
    try {
      await query(
        `INSERT INTO trainer_rooms
           (code, puzzle, set_slug, order_mode, keys, round, queue, next_index, total, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?::jsonb, 1, ?::jsonb, 0, ?, ?, ?)`,
        [code, puzzle, setSlug, order, keys, queue, queue.length, now, now],
      );
      return c.json({ code, round: 1, total: queue.length, order, puzzle, set: setSlug });
    } catch (e) {
      // 主键冲突才重试;其它错误直接抛
      if (String((e as Error).message).includes('duplicate') || String((e as Error).message).includes('unique')) continue;
      throw e;
    }
  }
  return c.json({ error: 'could not allocate room code' }, 500);
});

// GET /trainer/rooms/:code — 状态(轮询合并进度 / 探知对方是否已开下一轮)
trainerRoomsRoutes.get('/trainer/rooms/:code', async (c) => {
  c.header('Cache-Control', 'no-store');
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);
  const rows = await query<RoomRow>(
    'SELECT puzzle, set_slug, order_mode, round, next_index, total FROM trainer_rooms WHERE code = ?',
    [code],
  );
  const r = rows[0];
  if (!r) return c.json({ error: 'room not found' }, 404);
  return c.json({
    code, puzzle: r.puzzle, set: r.set_slug, order: r.order_mode,
    round: r.round, total: r.total, claimed: r.next_index, done: r.next_index >= r.total,
  });
});

// POST /trainer/rooms/:code/claim — 原子领取下一题
trainerRoomsRoutes.post('/trainer/rooms/:code/claim', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { round?: unknown; count?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const reqRound = Number.isInteger(body.round) ? (body.round as number) : null;
  if (reqRound == null || reqRound < 1) return c.json({ error: 'invalid round' }, 400);
  // count:一次占多格(三条一屏一次三格)。默认 1,夹 1..12 防一口气占太多。
  const countRaw = Number.isInteger(body.count) ? (body.count as number) : 1;
  const count = Math.min(Math.max(countRaw, 1), 12);

  const head = await query<{ round: number; total: number }>(
    'SELECT round, total FROM trainer_rooms WHERE code = ?', [code],
  );
  const room = head[0];
  if (!room) return c.json({ error: 'room not found' }, 404);

  // 本机落后了(别人已开新一轮)→ 让它重同步到新一轮
  if (reqRound < room.round) {
    return c.json({ advanced: true, round: room.round, total: room.total });
  }

  // 逐格原子出队 count 次:每次都是「游标 +1 并取回该格 case_key」的行锁原子操作(并发下每格只发
  // 一次;两台一起 batch 领取,拿到的下标交错但绝不重复)。一次 HTTP = 一次限流额度,batch 内多个
  // DB 往返都在本进程 + 本地 PG,开销可忽略。领到 total 边界就提前停(cases 可能少于 count)。
  const cases: { caseKey: string; index: number }[] = [];
  let lastRound = room.round, lastTotal = room.total;
  for (let i = 0; i < count; i++) {
    const claimed = await query<{ idx: number; case_key: string; round: number; total: number }>(
      `WITH claimed AS (
         UPDATE trainer_rooms
         SET next_index = next_index + 1, updated_at = ?
         WHERE code = ? AND round = ? AND next_index < total
         RETURNING next_index - 1 AS idx, queue, round, total
       )
       SELECT idx, (queue ->> idx) AS case_key, round, total FROM claimed`,
      [Date.now(), code, reqRound],
    );
    if (!claimed[0]) break;
    const row = claimed[0];
    lastRound = row.round; lastTotal = row.total;
    cases.push({ caseKey: row.case_key, index: row.idx });
  }
  if (cases.length > 0) {
    // 顶层 caseKey/index = 首格,兼容尚未升级的旧前端(它只读顶层单格);cases[] 给新前端多格
    return c.json({ caseKey: cases[0].caseKey, index: cases[0].index, cases, round: lastRound, total: lastTotal });
  }

  // 一格没领到:要么本轮领完,要么刚好被别人开了下一轮 —— 复查 round 区分
  const after = await query<{ round: number; total: number }>(
    'SELECT round, total FROM trainer_rooms WHERE code = ?', [code],
  );
  const r2 = after[0];
  if (!r2) return c.json({ error: 'room not found' }, 404);
  if (r2.round > reqRound) return c.json({ advanced: true, round: r2.round, total: r2.total });
  return c.json({ done: true, round: reqRound, total: r2.total });
});

// POST /trainer/rooms/:code/next-round — 开下一轮(CAS:只第一个真正推进,其余读到已推进的轮)
trainerRoomsRoutes.post('/trainer/rooms/:code/next-round', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const code = parseCode(c.req.param('code'));
  if (!code) return c.json({ error: 'invalid code' }, 400);

  let body: { round?: unknown };
  try { body = await c.req.json(); } catch { body = {}; }
  const reqRound = Number.isInteger(body.round) ? (body.round as number) : null;
  if (reqRound == null || reqRound < 1) return c.json({ error: 'invalid round' }, 400);

  const rows = await query<RoomRow>(
    'SELECT order_mode, keys, round, total FROM trainer_rooms WHERE code = ?', [code],
  );
  const room = rows[0];
  if (!room) return c.json({ error: 'room not found' }, 404);

  // 已被别人推进 → 直接返回当前轮(幂等:大家最终对齐到同一轮)
  if (room.round !== reqRound) {
    return c.json({ round: room.round, total: room.total });
  }

  const newQueue = room.order_mode === 'seq' ? room.keys : shuffle(room.keys);
  const now = Date.now();
  const upd = await query<{ round: number; total: number }>(
    `UPDATE trainer_rooms
     SET round = round + 1, queue = ?::jsonb, next_index = 0, total = ?, updated_at = ?
     WHERE code = ? AND round = ?
     RETURNING round, total`,
    [newQueue, newQueue.length, now, code, reqRound],
  );
  if (upd[0]) return c.json({ round: upd[0].round, total: upd[0].total });

  // CAS 落空(SELECT 与 UPDATE 之间被别人抢先)→ 读当前轮
  const after = await query<{ round: number; total: number }>(
    'SELECT round, total FROM trainer_rooms WHERE code = ?', [code],
  );
  const r2 = after[0];
  if (!r2) return c.json({ error: 'room not found' }, 404);
  return c.json({ round: r2.round, total: r2.total });
});
