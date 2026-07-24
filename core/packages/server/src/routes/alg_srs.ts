import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/alg/srs — 公式记忆(间隔重复)的调度状态与每日复习日志,跨设备同步。
 *
 *   GET /alg/srs/:puzzle/:set — 该 set 的全部记录 + 每日日志
 *       { recs: { [caseKey]: { d, iv, ef, n, l, st, t, h } }, daily: [[day, reviews, again]] }
 *   PUT /alg/srs/:puzzle/:set — 批量 upsert(客户端防抖后一次提交)
 *       body { items: [{ k, d, iv, ef, n, l, st, t, h }] }
 *       t = 上次复习时间,兼作 LWW 版本号:只接受不比现有旧的写。
 *   GET /alg/srs — 跨全部 set 的记录(进度总览页),上限 MAX_ROWS 行
 *   PUT /alg/srs/daily — 每日日志合并(同一天取较大值:离线多设备各刷各的,取 max 不会重复计)
 *
 * 身份始终取 requireAuth(c).wcaId;客户端不传 userId。
 */
export const algSrsRoutes = new Hono();

/** 单用户记录上限(与 alg_case_marks 同量级)。 */
const MAX_RECS_PER_USER = 20000;
const MAX_ITEMS_PER_PUT = 2000;
/** GET /alg/srs 单次最多回多少行(防某天被人刷爆后拖垮总览页)。 */
const MAX_ROWS = 20000;
/** 每日日志保留/接收的天数窗口。 */
const MAX_DAYS_PER_PUT = 400;

function parseSlug(raw: string | undefined, max: number): string | null {
  const s = (raw ?? '').trim();
  return s.length >= 1 && s.length <= max && /^[a-z0-9-]+$/.test(s) ? s : null;
}

function validCaseKey(k: unknown): k is string {
  return typeof k === 'string' && k.length >= 1 && k.length <= 128 && !/[\x00-\x1f]/.test(k);
}

/** 有限数值 + 区间钳制;非数字返回 null(整包拒收)。 */
function num(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v < lo ? lo : v > hi ? hi : v;
}

interface SrsRow {
  case_key: string; due: string | number; ivl: number; ease: number;
  reps: number; lapses: number; streak: number; hist: number; reviewed_at: string | number;
}

type WireRec = { d: number; iv: number; ef: number; n: number; l: number; st: number; t: number; h: number };

const toWire = (r: SrsRow): WireRec => ({
  d: Number(r.due), iv: Number(r.ivl), ef: Number(r.ease), n: Number(r.reps),
  l: Number(r.lapses), st: Number(r.streak), t: Number(r.reviewed_at), h: Number(r.hist),
});

interface DailyRow { day: string; reviews: number; again: number }

async function fetchDaily(wcaId: string): Promise<Array<[string, number, number]>> {
  const rows = await query<DailyRow>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, reviews, again
       FROM alg_srs_daily WHERE wca_id = ? ORDER BY day DESC LIMIT ?`,
    [wcaId, MAX_DAYS_PER_PUT],
  );
  return rows.map(r => [r.day, Number(r.reviews), Number(r.again)] as [string, number, number]);
}

algSrsRoutes.get('/alg/srs', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const rows = await query<SrsRow & { puzzle: string; set_slug: string }>(
    `SELECT puzzle, set_slug, case_key, due, ivl, ease, reps, lapses, streak, hist, reviewed_at
       FROM alg_case_srs WHERE wca_id = ?
      ORDER BY puzzle, set_slug LIMIT ?`,
    [authUser.wcaId, MAX_ROWS],
  );
  const bySet = new Map<string, { puzzle: string; set: string; recs: Record<string, WireRec> }>();
  for (const r of rows) {
    const gk = `${r.puzzle}/${r.set_slug}`;
    let g = bySet.get(gk);
    if (!g) { g = { puzzle: r.puzzle, set: r.set_slug, recs: {} }; bySet.set(gk, g); }
    g.recs[r.case_key] = toWire(r);
  }
  return c.json({ sets: [...bySet.values()], daily: await fetchDaily(authUser.wcaId) });
});

algSrsRoutes.get('/alg/srs/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const puzzle = parseSlug(c.req.param('puzzle'), 16);
  const setSlug = parseSlug(c.req.param('set'), 32);
  if (!puzzle || !setSlug) return c.json({ error: 'invalid puzzle/set' }, 400);

  const rows = await query<SrsRow>(
    `SELECT case_key, due, ivl, ease, reps, lapses, streak, hist, reviewed_at
       FROM alg_case_srs WHERE wca_id = ? AND puzzle = ? AND set_slug = ?`,
    [authUser.wcaId, puzzle, setSlug],
  );
  const recs: Record<string, WireRec> = {};
  for (const r of rows) recs[r.case_key] = toWire(r);
  return c.json({ recs, daily: await fetchDaily(authUser.wcaId) });
});

interface PutItem { k?: unknown; d?: unknown; iv?: unknown; ef?: unknown; n?: unknown; l?: unknown; st?: unknown; t?: unknown; h?: unknown }

algSrsRoutes.put('/alg/srs/daily', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  let body: { days?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
  const days = Array.isArray(body.days) ? body.days : null;
  if (!days || days.length === 0) return c.json({ error: 'days required' }, 400);
  if (days.length > MAX_DAYS_PER_PUT) return c.json({ error: 'too many days' }, 400);

  const parsed: Array<[string, number, number]> = [];
  for (const d of days) {
    if (!Array.isArray(d) || d.length < 2) return c.json({ error: 'invalid day row' }, 400);
    const [day, reviews, again] = d as [unknown, unknown, unknown];
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return c.json({ error: 'invalid day' }, 400);
    const n = num(reviews, 0, 100000);
    const a = num(again ?? 0, 0, 100000);
    if (n === null || a === null) return c.json({ error: 'invalid counts' }, 400);
    parsed.push([day, Math.round(n), Math.round(a)]);
  }

  const values: unknown[] = [];
  const placeholders = parsed.map(([day, n, a]) => {
    values.push(authUser.wcaId, day, n, a);
    return '(?, ?::date, ?, ?)';
  });
  // 合并语义 = 取较大值(离线多设备各自计数,取 max 不会把同一天重复累加)
  await query(
    `INSERT INTO alg_srs_daily (wca_id, day, reviews, again) VALUES ${placeholders.join(', ')}
     ON CONFLICT (wca_id, day) DO UPDATE
     SET reviews = GREATEST(alg_srs_daily.reviews, EXCLUDED.reviews),
         again   = GREATEST(alg_srs_daily.again,   EXCLUDED.again)`,
    values,
  );
  return c.json({ ok: true, days: parsed.length });
});

algSrsRoutes.put('/alg/srs/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const puzzle = parseSlug(c.req.param('puzzle'), 16);
  const setSlug = parseSlug(c.req.param('set'), 32);
  if (!puzzle || !setSlug) return c.json({ error: 'invalid puzzle/set' }, 400);

  let body: { items?: PutItem[] };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
  const items = Array.isArray(body.items) ? body.items : null;
  if (!items || items.length === 0) return c.json({ error: 'items required' }, 400);
  if (items.length > MAX_ITEMS_PER_PUT) return c.json({ error: 'too many items' }, 400);

  const now = Date.now();
  const parsed: Array<{ k: string; d: number; iv: number; ef: number; n: number; l: number; st: number; t: number; h: number }> = [];
  for (const it of items) {
    if (!validCaseKey(it.k)) return c.json({ error: 'invalid case key' }, 400);
    const d = num(it.d, 0, 4102444800000);          // ≤ 2100-01-01
    const iv = num(it.iv, 0, 3650);
    const ef = num(it.ef, 1, 5);
    const n = num(it.n, 0, 100000);
    const l = num(it.l, 0, 100000);
    const st = num(it.st, 0, 100000);
    const h = num(it.h, 0, 0xffffff);
    if (d === null || iv === null || ef === null || n === null || l === null || st === null || h === null) {
      return c.json({ error: 'invalid record' }, 400);
    }
    // 时间戳只在 [0, now+5min] 内可信,其余按服务器时间(防客户端时钟漂移把 LWW 卡死)
    const tRaw = typeof it.t === 'number' && Number.isFinite(it.t) ? it.t : now;
    const t = tRaw > 0 && tRaw <= now + 300_000 ? tRaw : now;
    parsed.push({ k: it.k, d, iv, ef, n: Math.round(n), l: Math.round(l), st: Math.round(st), t, h: Math.round(h) });
  }

  const cnt = await query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM alg_case_srs WHERE wca_id = ?', [authUser.wcaId],
  );
  if ((cnt[0]?.n ?? 0) + parsed.length > MAX_RECS_PER_USER) {
    return c.json({ error: 'srs limit reached' }, 409);
  }

  const values: unknown[] = [];
  const placeholders = parsed.map((p) => {
    values.push(authUser.wcaId, puzzle, setSlug, p.k, p.d, p.iv, p.ef, p.n, p.l, p.st, p.h, p.t);
    return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  });
  await query(
    `INSERT INTO alg_case_srs
       (wca_id, puzzle, set_slug, case_key, due, ivl, ease, reps, lapses, streak, hist, reviewed_at)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (wca_id, puzzle, set_slug, case_key) DO UPDATE
     SET due = EXCLUDED.due, ivl = EXCLUDED.ivl, ease = EXCLUDED.ease, reps = EXCLUDED.reps,
         lapses = EXCLUDED.lapses, streak = EXCLUDED.streak, hist = EXCLUDED.hist,
         reviewed_at = EXCLUDED.reviewed_at
     WHERE alg_case_srs.reviewed_at <= EXCLUDED.reviewed_at`,
    values,
  );
  return c.json({ ok: true, upserted: parsed.length });
});
