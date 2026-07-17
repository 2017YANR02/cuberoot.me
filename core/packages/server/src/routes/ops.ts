/**
 * /code/ops runbook 路由 — 命令 + 提示词模板,DB-backed.
 *   - GET    /v1/ops/commands              — 全表 (5min cache),前端一次拉完
 *   - POST   /v1/ops/commands              — admin 新增 (append 到该 category 末尾)
 *   - PUT    /v1/ops/commands/:id          — admin 编辑
 *   - DELETE /v1/ops/commands/:id          — admin 删
 *   - PUT    /v1/ops/commands/reorder      — admin 重排,body { category, ids: string[] }
 *
 * admin 走 X-Admin-Key (alg-admin-api skill 同款通道,无 WCA OAuth 也行).
 * Schema 见 migrations/0010_ops_commands.sql.
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey, checkRateLimit } from '../utils/recon_helpers.js';

export const opsRoutes = new Hono();

const CATEGORIES = ['db', 'build', 'deploy', 'backup', 'prompt'] as const;
type Category = (typeof CATEGORIES)[number];

interface OpsRow {
  id: string;
  category: string;
  cwd: string | null;
  position: number;
  chips: unknown;
  title_zh: string;
  title_en: string;
  desc_zh: string;
  desc_en: string;
  cmd: string;
  variants: unknown;
}

function rowToJson(r: OpsRow): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: r.id,
    category: r.category,
    position: r.position,
    chips: r.chips ?? [],
    title_zh: r.title_zh,
    title_en: r.title_en,
    desc_zh: r.desc_zh,
    desc_en: r.desc_en,
    cmd: r.cmd,
    variants: r.variants ?? [],
  };
  if (r.cwd) o.cwd = r.cwd;
  return o;
}

const ID_MAX = 80;
const TITLE_MAX = 200;
const DESC_MAX = 2000;
const CMD_MAX = 8000;
const CWD_MAX = 200;
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

interface OpsInput {
  id?: string;
  category?: string;
  cwd?: string | null;
  chips?: unknown;
  title_zh?: string;
  title_en?: string;
  desc_zh?: string;
  desc_en?: string;
  cmd?: string;
  variants?: unknown;
}

function validate(b: OpsInput, opts: { requireId: boolean }): { error?: string } {
  if (opts.requireId) {
    if (typeof b.id !== 'string' || !ID_RE.test(b.id) || b.id.length > ID_MAX) {
      return { error: 'id required: lowercase kebab, max 80 chars' };
    }
  }
  if (typeof b.category !== 'string' || !CATEGORIES.includes(b.category as Category)) {
    return { error: `category required: one of ${CATEGORIES.join('/')}` };
  }
  for (const k of ['title_zh', 'title_en', 'desc_zh', 'desc_en', 'cmd'] as const) {
    const v = b[k];
    if (typeof v !== 'string' || !v.trim()) return { error: `${k} required` };
    const max = k === 'cmd' ? CMD_MAX : k.startsWith('title') ? TITLE_MAX : DESC_MAX;
    if (v.length > max) return { error: `${k} too long (max ${max})` };
  }
  if (b.cwd !== undefined && b.cwd !== null) {
    if (typeof b.cwd !== 'string') return { error: 'cwd must be string or null' };
    if (b.cwd.length > CWD_MAX) return { error: 'cwd too long' };
  }
  if (b.chips !== undefined && b.chips !== null) {
    if (!Array.isArray(b.chips)) return { error: 'chips must be array' };
    for (const c of b.chips) {
      if (!c || typeof c !== 'object') return { error: 'chip must be object' };
      const cc = c as Record<string, unknown>;
      if (typeof cc.zh !== 'string' || typeof cc.en !== 'string') return { error: 'chip needs zh+en strings' };
    }
  }
  if (b.variants !== undefined && b.variants !== null) {
    if (!Array.isArray(b.variants)) return { error: 'variants must be array' };
    for (const v of b.variants) {
      if (!v || typeof v !== 'object') return { error: 'variant must be object' };
      const vv = v as Record<string, unknown>;
      if (typeof vv.cmd !== 'string' || !vv.cmd.trim()) return { error: 'variant.cmd required' };
      if (vv.cmd.length > CMD_MAX) return { error: 'variant.cmd too long' };
      for (const lang of ['zh', 'en'] as const) {
        const obj = vv[lang] as Record<string, unknown> | undefined;
        if (!obj || typeof obj !== 'object') return { error: `variant.${lang} required` };
        if (typeof obj.label !== 'string' || typeof obj.note !== 'string') {
          return { error: `variant.${lang} needs label+note strings` };
        }
      }
    }
  }
  return {};
}

// GET /v1/ops/commands — 全表,按 (category, position, id) 排序
opsRoutes.get('/ops/commands', async (c) => {
  c.header('Cache-Control', 'public, max-age=300');
  const rows = await query<OpsRow>(
    'SELECT id, category, cwd, position, chips, title_zh, title_en, desc_zh, desc_en, cmd, variants FROM ops_commands ORDER BY category, position, id',
  );
  return c.json(rows.map(rowToJson));
});

// POST /v1/ops/commands — 新增 (append 到该 category 末尾)
opsRoutes.post('/ops/commands', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const body = await c.req.json<OpsInput>();
  const v = validate(body, { requireId: true });
  if (v.error) return c.json({ error: v.error }, 400);

  const exists = await query<{ id: string }>('SELECT id FROM ops_commands WHERE id = ?', [body.id]);
  if (exists.length > 0) return c.json({ error: 'id already exists' }, 409);

  const maxPos = await query<{ max: number | null }>(
    'SELECT MAX(position) AS max FROM ops_commands WHERE category = ?',
    [body.category],
  );
  const nextPos = (maxPos[0].max ?? -1) + 1;

  const inserted = await query<OpsRow>(
    `INSERT INTO ops_commands (id, category, cwd, position, chips, title_zh, title_en, desc_zh, desc_en, cmd, variants)
     VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?::jsonb)
     RETURNING id, category, cwd, position, chips, title_zh, title_en, desc_zh, desc_en, cmd, variants`,
    [
      body.id,
      body.category,
      body.cwd ?? null,
      nextPos,
      body.chips ?? [],
      body.title_zh,
      body.title_en,
      body.desc_zh,
      body.desc_en,
      body.cmd,
      body.variants ?? [],
    ],
  );
  return c.json(rowToJson(inserted[0]));
});

// PUT /v1/ops/commands/reorder — body { category, ids: string[] }
// 必须传该 category 全部 id;server 重写 position 0..N-1.
// 放在 /:id 之前避免捕获.
opsRoutes.put('/ops/commands/reorder', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const body = await c.req.json<{ category?: unknown; ids?: unknown }>();
  if (typeof body.category !== 'string' || !CATEGORIES.includes(body.category as Category)) {
    return c.json({ error: `category required: one of ${CATEGORIES.join('/')}` }, 400);
  }
  if (!Array.isArray(body.ids)) return c.json({ error: 'ids must be array' }, 400);
  const ids: string[] = [];
  for (const x of body.ids) {
    if (typeof x !== 'string' || !ID_RE.test(x)) return c.json({ error: 'ids must be valid kebab strings' }, 400);
    ids.push(x);
  }
  if (new Set(ids).size !== ids.length) return c.json({ error: 'ids must be unique' }, 400);

  const existing = await query<{ id: string }>(
    'SELECT id FROM ops_commands WHERE category = ?',
    [body.category],
  );
  const existingSet = new Set(existing.map((r) => r.id));
  if (existingSet.size !== ids.length) {
    return c.json({ error: `expected ${existingSet.size} ids, got ${ids.length}` }, 400);
  }
  for (const id of ids) {
    if (!existingSet.has(id)) return c.json({ error: `id ${id} not in this category` }, 400);
  }

  // 单次 UPDATE FROM VALUES — 一次往返替 N 次 UPDATE。
  const valuesSql = ids.map(() => '(?::text, ?::int)').join(', ');
  const params: unknown[] = [];
  ids.forEach((id, i) => { params.push(id, i); });
  params.push(body.category);
  await query(
    `UPDATE ops_commands AS a SET position = v.pos
     FROM (VALUES ${valuesSql}) AS v(id, pos)
     WHERE a.id = v.id AND a.category = ?`,
    params,
  );

  return c.json({ ok: true });
});

// PUT /v1/ops/commands/:id — 全字段更新 (除了 position,reorder 走专用 endpoint)
opsRoutes.put('/ops/commands/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = c.req.param('id');
  if (!ID_RE.test(id)) return c.json({ error: 'invalid id' }, 400);

  const body = await c.req.json<OpsInput>();
  // category 改动会让 position 跟旧 category 排序对不齐.要换 category 必须先 DELETE 再 POST.
  const existing = await query<{ category: string }>('SELECT category FROM ops_commands WHERE id = ?', [id]);
  if (existing.length === 0) return c.json({ error: 'not found' }, 404);
  if (body.category && body.category !== existing[0].category) {
    return c.json({ error: 'cannot change category via PUT; DELETE + POST' }, 400);
  }
  body.category = existing[0].category;
  const v = validate(body, { requireId: false });
  if (v.error) return c.json({ error: v.error }, 400);

  const updated = await query<OpsRow>(
    `UPDATE ops_commands SET
       cwd = ?, chips = ?::jsonb,
       title_zh = ?, title_en = ?, desc_zh = ?, desc_en = ?,
       cmd = ?, variants = ?::jsonb
     WHERE id = ?
     RETURNING id, category, cwd, position, chips, title_zh, title_en, desc_zh, desc_en, cmd, variants`,
    [
      body.cwd ?? null,
      body.chips ?? [],
      body.title_zh,
      body.title_en,
      body.desc_zh,
      body.desc_en,
      body.cmd,
      body.variants ?? [],
      id,
    ],
  );
  return c.json(rowToJson(updated[0]));
});

// DELETE /v1/ops/commands/:id
opsRoutes.delete('/ops/commands/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = c.req.param('id');
  if (!ID_RE.test(id)) return c.json({ error: 'invalid id' }, 400);

  const deleted = await query<{ id: string }>('DELETE FROM ops_commands WHERE id = ? RETURNING id', [id]);
  if (deleted.length === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true, id: deleted[0].id });
});
