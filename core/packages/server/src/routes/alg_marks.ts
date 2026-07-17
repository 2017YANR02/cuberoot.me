import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';

/**
 * /v1/alg/marks — 公式训练器 per-case 学习标记(学习中/已掌握/搁置 + 星标)。
 *
 *   GET /alg/marks/:puzzle/:set — 当前用户该 set 的全部标记
 *       { marks: { [caseKey]: { s?: status, f?: 1, t: updatedAt } } }
 *   PUT /alg/marks/:puzzle/:set — 批量 upsert(客户端画笔拖涂防抖后一次提交)
 *       body { items: [{ k: caseKey, s: status|null, f: boolean, t: updatedAt }] }
 *       status 与 starred 全空 = 清除标记 → 删行。t 用于多设备 last-write-wins:
 *       服务器只接受 t 更新的写(旧设备迟到的防抖包不能覆盖新标记)。
 *
 * 身份始终取 requireAuth(c).wcaId(ownerKey);客户端不传 userId
 * (禁走 progress.ts 那种客户端报 userId 的 legacy 模式)。
 */
export const algMarksRoutes = new Hono();

function getIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

/** 单用户标记上限(1LLL 全 set 3915 条,全站所有 set 全标也远到不了)。 */
const MAX_MARKS_PER_USER = 20000;
/** 单次批量 PUT 的条数上限(整 set 一键涂满 = 1LLL 3915 条,留余量)。 */
const MAX_ITEMS_PER_PUT = 5000;

const STATUSES = new Set(['learning', 'mastered', 'paused']);

/** puzzle/set slug shape(与 alg_sets 的 slug 同域):小写字母数字 + 连字符。 */
function parseSlug(raw: string | undefined, max: number): string | null {
  const s = (raw ?? '').trim();
  return s.length >= 1 && s.length <= max && /^[a-z0-9-]+$/.test(s) ? s : null;
}

/** caseKey = `subgroup|name`,内容来自站长表,只卡长度与控制字符。 */
function validCaseKey(k: unknown): k is string {
  return typeof k === 'string' && k.length >= 1 && k.length <= 128 && !/[\x00-\x1f]/.test(k);
}

interface MarkRow { case_key: string; status: string | null; starred: boolean; updated_at: string }

algMarksRoutes.get('/alg/marks/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const puzzle = parseSlug(c.req.param('puzzle'), 16);
  const setSlug = parseSlug(c.req.param('set'), 32);
  if (!puzzle || !setSlug) return c.json({ error: 'invalid puzzle/set' }, 400);

  const rows = await query<MarkRow>(
    'SELECT case_key, status, starred, updated_at FROM alg_case_marks WHERE wca_id = ? AND puzzle = ? AND set_slug = ?',
    [authUser.wcaId, puzzle, setSlug],
  );
  const marks: Record<string, { s?: string; f?: 1; t: number }> = {};
  for (const r of rows) {
    const m: { s?: string; f?: 1; t: number } = { t: Number(r.updated_at) };
    if (r.status) m.s = r.status;
    if (r.starred) m.f = 1;
    marks[r.case_key] = m;
  }
  return c.json({ marks });
});

interface PutItem { k: unknown; s?: unknown; f?: unknown; t?: unknown }

algMarksRoutes.put('/alg/marks/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const puzzle = parseSlug(c.req.param('puzzle'), 16);
  const setSlug = parseSlug(c.req.param('set'), 32);
  if (!puzzle || !setSlug) return c.json({ error: 'invalid puzzle/set' }, 400);

  let body: { items?: PutItem[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  const items = Array.isArray(body.items) ? body.items : null;
  if (!items || items.length === 0) return c.json({ error: 'items required' }, 400);
  if (items.length > MAX_ITEMS_PER_PUT) return c.json({ error: 'too many items' }, 400);

  // 逐条校验,任何一条坏 shape 整包拒收(客户端是我们自己的,坏包只能是 bug/恶意)
  const now = Date.now();
  const parsed: Array<{ k: string; s: string | null; f: boolean; t: number }> = [];
  for (const it of items) {
    if (!validCaseKey(it.k)) return c.json({ error: 'invalid case key' }, 400);
    const s = it.s == null ? null : (typeof it.s === 'string' && STATUSES.has(it.s) ? it.s : undefined);
    if (s === undefined) return c.json({ error: 'invalid status' }, 400);
    const f = it.f === true || it.f === 1;
    // 时间戳只在 [0, now+5min] 内可信,其余按服务器时间(防客户端时钟漂移把 LWW 卡死)
    const tRaw = typeof it.t === 'number' ? it.t : now;
    const t = tRaw > 0 && tRaw <= now + 300_000 ? tRaw : now;
    parsed.push({ k: it.k, s, f, t });
  }

  const clears = parsed.filter((p) => p.s === null && !p.f);
  const upserts = parsed.filter((p) => p.s !== null || p.f);

  if (upserts.length > 0) {
    const cnt = await query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM alg_case_marks WHERE wca_id = ?',
      [authUser.wcaId],
    );
    if ((cnt[0]?.n ?? 0) + upserts.length > MAX_MARKS_PER_USER) {
      return c.json({ error: 'marks limit reached' }, 409);
    }
    // 单语句批量 upsert;LWW:只有更新的 t 才覆盖已有行
    const values: unknown[] = [];
    const placeholders = upserts.map((p) => {
      values.push(authUser.wcaId, puzzle, setSlug, p.k, p.s, p.f, p.t);
      return '(?, ?, ?, ?, ?, ?, ?)';
    });
    await query(
      `INSERT INTO alg_case_marks (wca_id, puzzle, set_slug, case_key, status, starred, updated_at)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (wca_id, puzzle, set_slug, case_key) DO UPDATE
       SET status = EXCLUDED.status, starred = EXCLUDED.starred, updated_at = EXCLUDED.updated_at
       WHERE alg_case_marks.updated_at <= EXCLUDED.updated_at`,
      values,
    );
  }
  if (clears.length > 0) {
    // 清除同样受 LWW 保护:只删「不比这次清除更新」的行
    const values: unknown[] = [authUser.wcaId, puzzle, setSlug];
    const conds = clears.map((p) => {
      values.push(p.k, p.t);
      return '(case_key = ? AND updated_at <= ?)';
    });
    await query(
      `DELETE FROM alg_case_marks WHERE wca_id = ? AND puzzle = ? AND set_slug = ? AND (${conds.join(' OR ')})`,
      values,
    );
  }
  return c.json({ ok: true, upserted: upserts.length, cleared: clears.length });
});
