/**
 * /v1/pattern-examples — /scramble/pattern/search 的示例预设(管理员自维护)。
 *   - GET    /v1/pattern-examples          — 全表(public,60s cache),前端一次拉完
 *   - POST   /v1/pattern-examples          — admin 新增(append 到末尾)
 *   - PUT    /v1/pattern-examples/reorder  — admin 重排,body { ids: number[] }(必须全量)
 *   - PUT    /v1/pattern-examples/:id      — admin 编辑
 *   - DELETE /v1/pattern-examples/:id      — admin 删
 *
 * q 就是页面 ?q= 的那串(单一源:管理员在编辑器里摆好图案 → 存成示例 → 点击即还原)。
 * Schema 见 migrations/0091_pattern_examples.sql。
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey, checkRateLimit } from '../utils/recon_helpers.js';

export const patternExamplesRoutes = new Hono();

/** 45 位格子色类(0..5,5=灰) + '-' + 5 × 2 位面分配十六进制掩码。与 client encodeQ 同一份。 */
const Q_RE = /^[0-5]{45}-[0-9a-f]{10}$/;
const NAME_MAX = 60;

interface ExampleRow {
  id: number | string;
  position: number;
  name_zh: string;
  name_en: string;
  q: string;
  continuous: boolean;
}

function rowToJson(r: ExampleRow) {
  return {
    id: Number(r.id),
    position: r.position,
    nameZh: r.name_zh,
    nameEn: r.name_en,
    q: r.q,
    continuous: r.continuous,
  };
}

interface ExampleInput {
  nameZh?: unknown;
  nameEn?: unknown;
  q?: unknown;
  continuous?: unknown;
}

interface Normalized {
  nameZh: string;
  nameEn: string;
  q: string;
  continuous: boolean;
}

function normalize(b: ExampleInput): { error: string } | { value: Normalized } {
  for (const k of ['nameZh', 'nameEn'] as const) {
    if (typeof b[k] !== 'string' || !(b[k] as string).trim()) return { error: `${k} required` };
    if ((b[k] as string).trim().length > NAME_MAX) return { error: `${k} too long` };
  }
  if (typeof b.q !== 'string' || !Q_RE.test(b.q)) return { error: 'q malformed' };
  // 全灰 = 空图案,存了也搜不出东西 —— 入口拦掉,别让管理员存一个死按钮
  if (/^5{45}-/.test(b.q)) return { error: 'q is empty (all gray)' };
  if (b.continuous !== undefined && typeof b.continuous !== 'boolean') {
    return { error: 'continuous must be boolean' };
  }
  return {
    value: {
      nameZh: (b.nameZh as string).trim(),
      nameEn: (b.nameEn as string).trim(),
      q: b.q,
      continuous: b.continuous === true,
    },
  };
}

// GET /v1/pattern-examples — 全表
patternExamplesRoutes.get('/pattern-examples', async (c) => {
  c.header('Cache-Control', 'public, max-age=60');
  const rows = await query<ExampleRow>(
    'SELECT id, position, name_zh, name_en, q, continuous FROM pattern_examples ORDER BY position, id',
  );
  return c.json(rows.map(rowToJson));
});

// POST /v1/pattern-examples — 新增(append 末尾)
patternExamplesRoutes.post('/pattern-examples', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const n = normalize(await c.req.json<ExampleInput>());
  if ('error' in n) return c.json({ error: n.error }, 400);
  const f = n.value;

  const maxPos = await query<{ max: number | null }>('SELECT MAX(position) AS max FROM pattern_examples');
  const nextPos = (maxPos[0].max ?? -1) + 1;

  const inserted = await query<ExampleRow>(
    `INSERT INTO pattern_examples (position, name_zh, name_en, q, continuous)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id, position, name_zh, name_en, q, continuous`,
    [nextPos, f.nameZh, f.nameEn, f.q, f.continuous],
  );
  return c.json(rowToJson(inserted[0]));
});

// PUT /v1/pattern-examples/reorder — body { ids: number[] }(必须传全部 id)
// 放在 /:id 之前避免被捕获(同 nav_sites / alg_sets)。
patternExamplesRoutes.put('/pattern-examples/reorder', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const body = await c.req.json<{ ids?: unknown }>();
  if (!Array.isArray(body.ids)) return c.json({ error: 'ids must be array' }, 400);
  const ids: number[] = [];
  for (const x of body.ids) {
    const v = Number(x);
    if (!Number.isInteger(v) || v <= 0) return c.json({ error: 'ids must be positive integers' }, 400);
    ids.push(v);
  }
  if (new Set(ids).size !== ids.length) return c.json({ error: 'ids must be unique' }, 400);

  const existing = await query<{ id: number | string }>('SELECT id FROM pattern_examples');
  const existingSet = new Set(existing.map((r) => Number(r.id)));
  if (existingSet.size !== ids.length) {
    return c.json({ error: `expected ${existingSet.size} ids, got ${ids.length}` }, 400);
  }
  for (const id of ids) if (!existingSet.has(id)) return c.json({ error: `id ${id} not found` }, 400);

  // 单次 UPDATE FROM VALUES — 一次往返替 N 次 UPDATE。
  const valuesSql = ids.map(() => '(?::bigint, ?::int)').join(', ');
  const params: unknown[] = [];
  ids.forEach((id, i) => { params.push(id, i); });
  await query(
    `UPDATE pattern_examples AS a SET position = v.pos
     FROM (VALUES ${valuesSql}) AS v(id, pos)
     WHERE a.id = v.id`,
    params,
  );
  return c.json({ ok: true });
});

// PUT /v1/pattern-examples/:id — 编辑(名字 / 图案 / continuous;position 走 reorder)
patternExamplesRoutes.put('/pattern-examples/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const n = normalize(await c.req.json<ExampleInput>());
  if ('error' in n) return c.json({ error: n.error }, 400);
  const f = n.value;

  const updated = await query<ExampleRow>(
    `UPDATE pattern_examples SET name_zh = ?, name_en = ?, q = ?, continuous = ?
     WHERE id = ?
     RETURNING id, position, name_zh, name_en, q, continuous`,
    [f.nameZh, f.nameEn, f.q, f.continuous, id],
  );
  if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(rowToJson(updated[0]));
});

// DELETE /v1/pattern-examples/:id
patternExamplesRoutes.delete('/pattern-examples/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const deleted = await query<{ id: number | string }>(
    'DELETE FROM pattern_examples WHERE id = ? RETURNING id',
    [id],
  );
  if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});
