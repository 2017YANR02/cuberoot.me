import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/alg/sweep — 公式训练器「过遍」进度:哪些范围整轮过完了 + 现在停在哪 + 折叠。
 *
 *   GET  /alg/sweep                — 当前用户全部 set(进度总览页 / LSLL「继续第 N 轮」)
 *   GET  /alg/sweep/:puzzle/:set   — { sweeps: { scope: 遍数 }, cursor, t }
 *   PUT  /alg/sweep/:puzzle/:set   — body { sweeps, cursor, t };服务端合并:
 *        sweeps 逐 scope 取 max(多设备离线各刷各的,取 max 不重复计),
 *        cursor 按 t 做 last-write-wins。
 *   POST /alg/sweep/:puzzle/:set/fold — body { keys: string[] }
 *        整轮过完后折叠:删掉这些 case 的**记忆排期**,但**有手动标记的一律留着**。
 *        见 client `lib/alg-sweep.ts` 的四条口径 —— 判据在客户端(它才知道水位和标记),
 *        这里只做最后一道保险:再查一次 alg_case_marks,标过的不删。
 *
 * 身份始终取 requireAuth(c).wcaId;客户端不传 userId。
 */
export const algSweepRoutes = new Hono();

/** 单 set 最多记多少个范围(LSLL 是 494 轮,留足余量;超了整包拒收)。 */
const MAX_SCOPES = 4000;
/** scope 字符串长度上限(`?scope=` 本身就短)。 */
const MAX_SCOPE_LEN = 64;
/** 单次折叠最多几个 case(LSLL 一轮 302,留余量)。 */
const MAX_FOLD_KEYS = 2000;

function parseSlug(raw: string | undefined, max: number): string | null {
  const s = (raw ?? '').trim();
  return s.length >= 1 && s.length <= max && /^[a-z0-9-]+$/.test(s) ? s : null;
}

/** scope = `?scope=` 的值,整集为空串 —— 空串合法,所以下限是 0 不是 1。 */
const validScope = (s: unknown): s is string =>
  typeof s === 'string' && s.length <= MAX_SCOPE_LEN && !/[\x00-\x1f]/.test(s);

const validCaseKey = (k: unknown): k is string =>
  typeof k === 'string' && k.length >= 1 && k.length <= 128 && !/[\x00-\x1f]/.test(k);

type Sweeps = Record<string, number>;
interface Cursor { scope: string; pos: number; total: number }

interface Row {
  puzzle: string; set_slug: string; sweeps: Sweeps; cursor: Cursor | null;
  folded_at: string | number; updated_at: string | number;
}

const COLS = 'puzzle, set_slug, sweeps, cursor, folded_at, updated_at';

const toWire = (r: Row) => ({
  puzzle: r.puzzle,
  set: r.set_slug,
  sweeps: r.sweeps ?? {},
  cursor: r.cursor ?? null,
  foldedAt: Number(r.folded_at),
  t: Number(r.updated_at),
});

const emptyWire = (puzzle: string, set: string) =>
  ({ puzzle, set, sweeps: {} as Sweeps, cursor: null, foldedAt: 0, t: 0 });

algSweepRoutes.get('/alg/sweep', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const rows = await query<Row>(
    `SELECT ${COLS} FROM alg_set_progress WHERE wca_id = ? ORDER BY puzzle, set_slug`,
    [authUser.wcaId],
  );
  return c.json({ sets: rows.map(toWire) });
});

algSweepRoutes.get('/alg/sweep/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const puzzle = parseSlug(c.req.param('puzzle'), 16);
  const setSlug = parseSlug(c.req.param('set'), 32);
  if (!puzzle || !setSlug) return c.json({ error: 'invalid puzzle/set' }, 400);

  const rows = await query<Row>(
    `SELECT ${COLS} FROM alg_set_progress WHERE wca_id = ? AND puzzle = ? AND set_slug = ?`,
    [authUser.wcaId, puzzle, setSlug],
  );
  const r = rows[0];
  return c.json(r ? toWire(r) : emptyWire(puzzle, setSlug));
});

/** 解析并校验客户端送来的 sweeps;任何一条坏 shape 整包拒收。 */
function parseSweeps(raw: unknown): Sweeps | null {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const keys = Object.keys(src);
  if (keys.length > MAX_SCOPES) return null;
  const out: Sweeps = {};
  for (const k of keys) {
    if (!validScope(k)) return null;
    const v = src[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1) return null;
    out[k] = Math.min(Math.floor(v), 1_000_000);
  }
  return out;
}

function parseCursor(raw: unknown): Cursor | null | undefined {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (!validScope(o.scope)) return undefined;
  const pos = o.pos, total = o.total;
  if (typeof pos !== 'number' || !Number.isFinite(pos) || pos < 0) return undefined;
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) return undefined;
  return { scope: o.scope, pos: Math.floor(pos), total: Math.floor(total) };
}

algSweepRoutes.put('/alg/sweep/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const puzzle = parseSlug(c.req.param('puzzle'), 16);
  const setSlug = parseSlug(c.req.param('set'), 32);
  if (!puzzle || !setSlug) return c.json({ error: 'invalid puzzle/set' }, 400);

  let body: { sweeps?: unknown; cursor?: unknown; t?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }

  const sweeps = parseSweeps(body.sweeps);
  if (!sweeps) return c.json({ error: 'invalid sweeps' }, 400);
  const cursor = parseCursor(body.cursor);
  if (cursor === undefined) return c.json({ error: 'invalid cursor' }, 400);

  // 时间戳只在 [1, now+5min] 内可信,其余按服务器时间(防客户端时钟漂移把 LWW 卡死)
  const now = Date.now();
  const tRaw = typeof body.t === 'number' ? body.t : now;
  const t = tRaw > 0 && tRaw <= now + 300_000 ? Math.floor(tRaw) : now;

  // 合并在 SQL 里一次做完:sweeps 逐 key 取 max(`||` 右边覆盖左边,所以先算好再合),
  // cursor 只有在这次的 t 不比库里旧时才换 —— 与客户端 mergeSweep 同一套语义。
  await query(
    `INSERT INTO alg_set_progress AS p (wca_id, puzzle, set_slug, sweeps, cursor, updated_at)
     VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?)
     ON CONFLICT (wca_id, puzzle, set_slug) DO UPDATE SET
       sweeps = (
         SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) FROM (
           SELECT k, MAX(v) AS v FROM (
             SELECT key AS k, (value)::int AS v FROM jsonb_each_text(p.sweeps)
             UNION ALL
             SELECT key AS k, (value)::int AS v FROM jsonb_each_text(EXCLUDED.sweeps)
           ) u GROUP BY k
         ) m
       ),
       cursor     = CASE WHEN EXCLUDED.updated_at >= p.updated_at THEN EXCLUDED.cursor ELSE p.cursor END,
       updated_at = GREATEST(p.updated_at, EXCLUDED.updated_at)`,
    // jsonb 参数直接传对象 —— 驱动(porsager/postgres)自己序列化,再 JSON.stringify 一次
    // 存进去的就是一个 JSON **字符串**,下次 jsonb_each_text 直接炸「non-object」。
    [authUser.wcaId, puzzle, setSlug, sweeps, cursor, t],
  );

  const rows = await query<Row>(
    `SELECT ${COLS} FROM alg_set_progress WHERE wca_id = ? AND puzzle = ? AND set_slug = ?`,
    [authUser.wcaId, puzzle, setSlug],
  );
  return c.json(rows[0] ? toWire(rows[0]) : { ...emptyWire(puzzle, setSlug), sweeps, cursor, t });
});

algSweepRoutes.post('/alg/sweep/:puzzle/:set/fold', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const puzzle = parseSlug(c.req.param('puzzle'), 16);
  const setSlug = parseSlug(c.req.param('set'), 32);
  if (!puzzle || !setSlug) return c.json({ error: 'invalid puzzle/set' }, 400);

  let body: { keys?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
  const keys = Array.isArray(body.keys) ? body.keys : null;
  if (!keys || keys.length === 0) return c.json({ error: 'keys required' }, 400);
  if (keys.length > MAX_FOLD_KEYS) return c.json({ error: 'too many keys' }, 400);
  for (const k of keys) if (!validCaseKey(k)) return c.json({ error: 'invalid case key' }, 400);

  // 保险:有手动标记的 case 一律不折。客户端已经滤过一遍,这里不信它 ——
  // 折叠是删除,判据错一次就是把用户自己标的东西扔了。
  const ph = keys.map(() => '?').join(', ');
  const res = await query<{ case_key: string }>(
    `DELETE FROM alg_case_srs s
      WHERE s.wca_id = ? AND s.puzzle = ? AND s.set_slug = ? AND s.case_key IN (${ph})
        AND NOT EXISTS (
          SELECT 1 FROM alg_case_marks m
           WHERE m.wca_id = s.wca_id AND m.puzzle = s.puzzle
             AND m.set_slug = s.set_slug AND m.case_key = s.case_key
        )
      RETURNING s.case_key`,
    [authUser.wcaId, puzzle, setSlug, ...keys],
  );

  // 记下折叠时刻 —— 别的设备本地还留着这批记录,靠它判定「早于最后一次折叠且无标记」
  // 的本地记录属于已折叠的轮,丢弃而不是回传。行还不存在就顺手建(折叠可能先于第一次 PUT)。
  const now = Date.now();
  await query(
    `INSERT INTO alg_set_progress (wca_id, puzzle, set_slug, sweeps, cursor, folded_at, updated_at)
     VALUES (?, ?, ?, '{}'::jsonb, NULL, ?, ?)
     ON CONFLICT (wca_id, puzzle, set_slug) DO UPDATE
       SET folded_at = GREATEST(alg_set_progress.folded_at, EXCLUDED.folded_at)`,
    [authUser.wcaId, puzzle, setSlug, now, now],
  );
  return c.json({ ok: true, folded: res.length, foldedAt: now, keys: res.map(r => r.case_key) });
});
