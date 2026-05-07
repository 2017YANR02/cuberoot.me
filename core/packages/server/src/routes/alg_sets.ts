/**
 * Alg 公式库 (alg_sets / alg_cases) 路由 — DB 化的标准公式库,
 * 替代曾经的 41 个 `core/packages/shared/data/alg_*.json` 静态文件。
 *
 * 区分:
 *   - 这里(alg_sets.ts):**标准 case**(name / setup / standard / sticker / algs)
 *   - alg.ts(community submissions):**用户额外投稿**叠加在标准 case 之上
 *
 * 路径前缀 /api/alg/sets/... 跟现有 /api/alg/:puzzle/:set/submissions 不冲突。
 */
import { Hono } from 'hono';
import { query, sql } from '../db/connection.js';
import { requireAuth, checkRateLimit, ADMIN_WCA_IDS } from '../utils/recon_helpers.js';

export const algSetsRoutes = new Hono();

interface AlgSetRow {
  puzzle: string;
  set_slug: string;
  source: string | null;
  scraped_at: string | Date | null;
  updated_at: string | Date;
}
interface AlgCaseRow {
  id: number | string;
  puzzle: string;
  set_slug: string;
  position: number;
  name: string;
  number: number | null;
  subgroup: string;
  setup: string;
  standard: string | null;
  sticker: unknown;       // JSONB → driver 已反序列化为 JS object
  algs: unknown;
  ori_names: unknown;
  trainer_key: string | null;
  updated_at: string | Date;
}

function caseRowToJson(c: AlgCaseRow): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: Number(c.id),
    name: c.name,
    subgroup: c.subgroup,
    setup: c.setup,
    sticker: c.sticker,
    algs: c.algs,
  };
  if (c.number !== null) out.number = c.number;
  if (c.standard !== null) out.standard = c.standard;
  if (c.ori_names) out.oriNames = c.ori_names;
  if (c.trainer_key) out.trainerKey = c.trainer_key;
  return out;
}

function getIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

const CASE_NAME_MAX = 128;
const SUBGROUP_MAX = 64;
const TEXT_MAX = 4096;

function validateCaseInput(body: {
  caseName?: string; subgroup?: string; setup?: string; standard?: string | null;
  sticker?: unknown; algs?: unknown; oriNames?: unknown; trainerKey?: string | null;
}): { error?: string } {
  if (typeof body.caseName !== 'string' || !body.caseName.trim()) return { error: 'caseName required' };
  if (body.caseName.length > CASE_NAME_MAX) return { error: 'caseName too long' };
  if (body.subgroup !== undefined && typeof body.subgroup !== 'string') return { error: 'subgroup must be string' };
  if (body.subgroup && body.subgroup.length > SUBGROUP_MAX) return { error: 'subgroup too long' };
  if (body.setup !== undefined && typeof body.setup !== 'string') return { error: 'setup must be string' };
  if (body.setup && body.setup.length > TEXT_MAX) return { error: 'setup too long' };
  if (body.standard !== undefined && body.standard !== null && typeof body.standard !== 'string') return { error: 'standard must be string or null' };
  if (body.standard && body.standard.length > TEXT_MAX) return { error: 'standard too long' };
  if (!body.sticker || typeof body.sticker !== 'object') return { error: 'sticker required (object)' };
  if (!Array.isArray(body.algs)) return { error: 'algs must be array' };
  return {};
}

// GET /api/alg/sets — 列所有 (puzzle, set_slug)
algSetsRoutes.get('/api/alg/sets', async (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  const rows = await query<AlgSetRow>(
    'SELECT puzzle, set_slug, source, scraped_at, updated_at FROM alg_sets ORDER BY puzzle, set_slug'
  );
  return c.json(rows.map(r => ({
    puzzle: r.puzzle,
    setSlug: r.set_slug,
    source: r.source,
    scrapedAt: r.scraped_at,
    updatedAt: r.updated_at,
  })));
});

// GET /api/alg/sets/:puzzle/:set — 完整 AlgFile JSON(跟旧 JSON 文件 1:1)
algSetsRoutes.get('/api/alg/sets/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');

  const sets = await query<AlgSetRow>(
    'SELECT * FROM alg_sets WHERE puzzle = ? AND set_slug = ?',
    [puzzle, set],
  );
  if (sets.length === 0) return c.json({ error: 'Unknown alg set' }, 404);

  const cases = await query<AlgCaseRow>(
    'SELECT * FROM alg_cases WHERE puzzle = ? AND set_slug = ? ORDER BY position ASC',
    [puzzle, set],
  );

  const s = sets[0];
  return c.json({
    scrapedAt: s.scraped_at,
    source: s.source,
    puzzle: s.puzzle,
    set: s.set_slug,
    cases: cases.map(caseRowToJson),
  });
});

// POST /api/alg/sets/:puzzle/:set/cases — admin 新增 case (append 到末尾)
algSetsRoutes.post('/api/alg/sets/:puzzle/:set/cases', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  if (!ADMIN_WCA_IDS.includes(user.wcaId)) return c.json({ error: 'Admin required' }, 403);

  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');
  const body = await c.req.json<{
    caseName?: string; subgroup?: string; setup?: string; standard?: string | null;
    sticker?: unknown; algs?: unknown; oriNames?: unknown; trainerKey?: string | null;
  }>();
  const v = validateCaseInput(body);
  if (v.error) return c.json({ error: v.error }, 400);

  const sets = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM alg_sets WHERE puzzle = ? AND set_slug = ?',
    [puzzle, set],
  );
  if (Number(sets[0].count) === 0) return c.json({ error: 'Unknown alg set' }, 404);

  const maxPos = await query<{ max: number | null }>(
    'SELECT MAX(position) AS max FROM alg_cases WHERE puzzle = ? AND set_slug = ?',
    [puzzle, set],
  );
  const nextPos = (maxPos[0].max ?? -1) + 1;

  // postgres@3 自带 jsonb 序列化器 (jsonb 列 / 强 cast 时调 JSON.stringify),
  // 这里直接传对象,driver 单次 stringify 后 PG 解析成 jsonb 对象。
  // 之前手动 JSON.stringify 会被 driver 再编码一次,落地变 jsonb 字符串字面量。
  const inserted = await query<AlgCaseRow>(
    `INSERT INTO alg_cases (
      puzzle, set_slug, position, name, subgroup, setup, standard,
      sticker, algs, ori_names, trainer_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?)
    RETURNING *`,
    [
      puzzle, set, nextPos,
      body.caseName!.trim(), body.subgroup ?? '', body.setup ?? '', body.standard ?? null,
      body.sticker, body.algs,
      body.oriNames ?? null,
      body.trainerKey ?? null,
    ],
  );
  return c.json(caseRowToJson(inserted[0]));
});

// PUT /api/alg/sets/:puzzle/:set/cases/:id — admin 编辑 case
algSetsRoutes.put('/api/alg/sets/:puzzle/:set/cases/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  if (!ADMIN_WCA_IDS.includes(user.wcaId)) return c.json({ error: 'Admin required' }, 403);

  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const body = await c.req.json<{
    caseName?: string; subgroup?: string; setup?: string; standard?: string | null;
    sticker?: unknown; algs?: unknown; oriNames?: unknown; trainerKey?: string | null;
  }>();
  const v = validateCaseInput(body);
  if (v.error) return c.json({ error: v.error }, 400);

  // 见 POST 注释:对象直接传给 ?::jsonb,driver 序列化一次就够了
  const updated = await query<AlgCaseRow>(
    `UPDATE alg_cases SET
       name = ?, subgroup = ?, setup = ?, standard = ?,
       sticker = ?::jsonb, algs = ?::jsonb,
       ori_names = ?::jsonb, trainer_key = ?
     WHERE id = ? AND puzzle = ? AND set_slug = ?
     RETURNING *`,
    [
      body.caseName!.trim(), body.subgroup ?? '', body.setup ?? '', body.standard ?? null,
      body.sticker, body.algs,
      body.oriNames ?? null,
      body.trainerKey ?? null,
      id, puzzle, set,
    ],
  );
  if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(caseRowToJson(updated[0]));
});

// PUT /api/alg/sets/:puzzle/:set/reorder — admin 重排 case 顺序
// body: { ids: number[] } —— 必须是该 set 下的全部 case id,新顺序。server 把 position 重写为 0..N-1。
// NOTE: 故意放 /reorder 而非 /cases/order,避免被 PUT /cases/:id 路由捕获(id="order"→NaN→invalid id 400)。
algSetsRoutes.put('/api/alg/sets/:puzzle/:set/reorder', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  if (!ADMIN_WCA_IDS.includes(user.wcaId)) return c.json({ error: 'Admin required' }, 403);

  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');
  const body = await c.req.json<{ ids?: unknown }>();
  if (!Array.isArray(body.ids)) return c.json({ error: 'ids must be array' }, 400);
  const ids: number[] = [];
  for (const x of body.ids) {
    const n = Number(x);
    if (!Number.isInteger(n) || n <= 0) return c.json({ error: 'ids must be positive integers' }, 400);
    ids.push(n);
  }
  if (new Set(ids).size !== ids.length) return c.json({ error: 'ids must be unique' }, 400);

  // 校验:ids 必须正好等于该 set 的全部 case id 集合(避免漏 case)
  const existing = await query<{ id: number | string }>(
    'SELECT id FROM alg_cases WHERE puzzle = ? AND set_slug = ?',
    [puzzle, set],
  );
  const existingSet = new Set(existing.map(r => Number(r.id)));
  if (existingSet.size !== ids.length) {
    return c.json({ error: `expected ${existingSet.size} ids, got ${ids.length}` }, 400);
  }
  for (const id of ids) {
    if (!existingSet.has(id)) return c.json({ error: `id ${id} not in this set` }, 400);
  }

  await sql.begin(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx`UPDATE alg_cases SET position = ${i} WHERE id = ${ids[i]} AND puzzle = ${puzzle} AND set_slug = ${set}`;
    }
  });

  return c.json({ ok: true });
});

// DELETE /api/alg/sets/:puzzle/:set/cases/:id — admin 删 case
algSetsRoutes.delete('/api/alg/sets/:puzzle/:set/cases/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  if (!ADMIN_WCA_IDS.includes(user.wcaId)) return c.json({ error: 'Admin required' }, 403);

  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const deleted = await query<{ id: number | string }>(
    'DELETE FROM alg_cases WHERE id = ? AND puzzle = ? AND set_slug = ? RETURNING id',
    [id, puzzle, set],
  );
  if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});
