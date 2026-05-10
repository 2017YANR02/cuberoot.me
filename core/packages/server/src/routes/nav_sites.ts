/**
 * /site 网址导航 (nav_sites) 路由。
 *   - GET    /v1/nav/sites              — 全表(1h cache),前端一次拉完
 *   - POST   /v1/nav/sites              — admin 新增,append 到该 group 末尾
 *   - PUT    /v1/nav/sites/:id          — admin 编辑
 *   - DELETE /v1/nav/sites/:id          — admin 删
 *   - PUT    /v1/nav/sites/reorder      — admin 重排,body { groupId, ids: number[] }
 *
 * Schema 见 migrations/0001_nav_sites.sql。
 */
import { Hono } from 'hono';
import { query, sql } from '../db/connection.js';
import { requireAdminOrApiKey, checkRateLimit } from '../utils/recon_helpers.js';

export const navSitesRoutes = new Hono();

interface NavSiteRow {
  id: number | string;
  group_id: string;
  position: number;
  name: string;
  name_en: string | null;
  name_zh: string | null;
  url: string;
  alt_urls: unknown;
  author: string | null;
  desc_en: string | null;
  desc_zh: string | null;
  youtube: string | null;
  tags: unknown;
  status: string | null;
  updated_at: string | Date;
}

function rowToJson(r: NavSiteRow): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: Number(r.id),
    group: r.group_id,
    position: r.position,
    name: r.name,
    url: r.url,
  };
  if (r.name_en) o.name_en = r.name_en;
  if (r.name_zh) o.name_zh = r.name_zh;
  if (r.alt_urls) o.alt_urls = r.alt_urls;
  if (r.author) o.author = r.author;
  if (r.desc_en) o.desc_en = r.desc_en;
  if (r.desc_zh) o.desc_zh = r.desc_zh;
  if (r.youtube) o.youtube = r.youtube;
  if (r.tags) o.tags = r.tags;
  if (r.status) o.status = r.status;
  return o;
}

function getIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

const NAME_MAX = 200;
const URL_MAX = 2000;
const TEXT_MAX = 4000;

interface NavSiteInput {
  group?: string;
  name?: string;
  name_en?: string | null;
  name_zh?: string | null;
  url?: string;
  alt_urls?: unknown;
  author?: string | null;
  desc_en?: string | null;
  desc_zh?: string | null;
  youtube?: string | null;
  tags?: unknown;
  status?: string | null;
}

function validate(b: NavSiteInput): { error?: string } {
  if (typeof b.group !== 'string' || !b.group.trim()) return { error: 'group required' };
  if (typeof b.name !== 'string' || !b.name.trim()) return { error: 'name required' };
  if (b.name.length > NAME_MAX) return { error: 'name too long' };
  if (typeof b.url !== 'string' || !b.url.trim()) return { error: 'url required' };
  if (b.url.length > URL_MAX) return { error: 'url too long' };
  for (const k of ['name_en', 'name_zh', 'author', 'youtube', 'status'] as const) {
    const v = b[k];
    if (v !== undefined && v !== null && typeof v !== 'string') return { error: `${k} must be string or null` };
  }
  for (const k of ['desc_en', 'desc_zh'] as const) {
    const v = b[k];
    if (v !== undefined && v !== null) {
      if (typeof v !== 'string') return { error: `${k} must be string or null` };
      if (v.length > TEXT_MAX) return { error: `${k} too long` };
    }
  }
  if (b.alt_urls !== undefined && b.alt_urls !== null) {
    if (!Array.isArray(b.alt_urls) || !b.alt_urls.every((s) => typeof s === 'string')) return { error: 'alt_urls must be string[]' };
  }
  if (b.tags !== undefined && b.tags !== null) {
    if (!Array.isArray(b.tags) || !b.tags.every((s) => typeof s === 'string')) return { error: 'tags must be string[]' };
  }
  return {};
}

function normalize(b: NavSiteInput): {
  name: string; name_en: string | null; name_zh: string | null;
  url: string; alt_urls: string[] | null; author: string | null;
  desc_en: string | null; desc_zh: string | null; youtube: string | null;
  tags: string[] | null; status: string | null;
} {
  const empty = (s: string | null | undefined) => (s == null || s === '' ? null : s);
  const arr = (a: unknown): string[] | null => {
    if (!Array.isArray(a)) return null;
    const out = a.filter((s): s is string => typeof s === 'string' && s.length > 0);
    return out.length > 0 ? out : null;
  };
  return {
    name: b.name!.trim(),
    name_en: empty(b.name_en ?? null),
    name_zh: empty(b.name_zh ?? null),
    url: b.url!.trim(),
    alt_urls: arr(b.alt_urls),
    author: empty(b.author ?? null),
    desc_en: empty(b.desc_en ?? null),
    desc_zh: empty(b.desc_zh ?? null),
    youtube: empty(b.youtube ?? null),
    tags: arr(b.tags),
    status: empty(b.status ?? null),
  };
}

// GET /v1/nav/sites — 全表
navSitesRoutes.get('/nav/sites', async (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  const rows = await query<NavSiteRow>(
    'SELECT * FROM nav_sites ORDER BY group_id, position'
  );
  return c.json(rows.map(rowToJson));
});

// POST /v1/nav/sites — 新增 (append 到该 group 末尾)
navSitesRoutes.post('/nav/sites', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const body = await c.req.json<NavSiteInput>();
  const v = validate(body);
  if (v.error) return c.json({ error: v.error }, 400);
  const f = normalize(body);

  const maxPos = await query<{ max: number | null }>(
    'SELECT MAX(position) AS max FROM nav_sites WHERE group_id = ?',
    [body.group],
  );
  const nextPos = (maxPos[0].max ?? -1) + 1;

  const inserted = await query<NavSiteRow>(
    `INSERT INTO nav_sites (
       group_id, position, name, name_en, name_zh, url, alt_urls,
       author, desc_en, desc_zh, youtube, tags, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?::jsonb, ?)
     RETURNING *`,
    [
      body.group, nextPos, f.name, f.name_en, f.name_zh, f.url, f.alt_urls,
      f.author, f.desc_en, f.desc_zh, f.youtube, f.tags, f.status,
    ],
  );
  return c.json(rowToJson(inserted[0]));
});

// PUT /v1/nav/sites/reorder — body { groupId, ids: number[] }
// 必须传该 group 全部 site id;server 重写 position 0..N-1。
// 与 alg_sets reorder 同款,放在 /:id 之前避免捕获。
navSitesRoutes.put('/nav/sites/reorder', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const body = await c.req.json<{ groupId?: unknown; ids?: unknown }>();
  if (typeof body.groupId !== 'string' || !body.groupId.trim()) return c.json({ error: 'groupId required' }, 400);
  if (!Array.isArray(body.ids)) return c.json({ error: 'ids must be array' }, 400);
  const ids: number[] = [];
  for (const x of body.ids) {
    const n = Number(x);
    if (!Number.isInteger(n) || n <= 0) return c.json({ error: 'ids must be positive integers' }, 400);
    ids.push(n);
  }
  if (new Set(ids).size !== ids.length) return c.json({ error: 'ids must be unique' }, 400);

  const existing = await query<{ id: number | string }>(
    'SELECT id FROM nav_sites WHERE group_id = ?',
    [body.groupId],
  );
  const existingSet = new Set(existing.map((r) => Number(r.id)));
  if (existingSet.size !== ids.length) {
    return c.json({ error: `expected ${existingSet.size} ids, got ${ids.length}` }, 400);
  }
  for (const id of ids) {
    if (!existingSet.has(id)) return c.json({ error: `id ${id} not in this group` }, 400);
  }

  await sql.begin(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx`UPDATE nav_sites SET position = ${i} WHERE id = ${ids[i]} AND group_id = ${body.groupId as string}`;
    }
  });

  return c.json({ ok: true });
});

// PUT /v1/nav/sites/:id — 编辑(可改 group;不改 position,reorder 走专用端点)
navSitesRoutes.put('/nav/sites/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const body = await c.req.json<NavSiteInput>();
  const v = validate(body);
  if (v.error) return c.json({ error: v.error }, 400);
  const f = normalize(body);

  // 如果改了 group,把 position 设为新 group 末尾
  const cur = await query<{ group_id: string; position: number }>(
    'SELECT group_id, position FROM nav_sites WHERE id = ?',
    [id],
  );
  if (cur.length === 0) return c.json({ error: 'Not found' }, 404);

  let newPos = cur[0].position;
  if (cur[0].group_id !== body.group) {
    const maxPos = await query<{ max: number | null }>(
      'SELECT MAX(position) AS max FROM nav_sites WHERE group_id = ?',
      [body.group],
    );
    newPos = (maxPos[0].max ?? -1) + 1;
  }

  const updated = await query<NavSiteRow>(
    `UPDATE nav_sites SET
       group_id = ?, position = ?,
       name = ?, name_en = ?, name_zh = ?, url = ?, alt_urls = ?::jsonb,
       author = ?, desc_en = ?, desc_zh = ?, youtube = ?, tags = ?::jsonb, status = ?
     WHERE id = ?
     RETURNING *`,
    [
      body.group, newPos,
      f.name, f.name_en, f.name_zh, f.url, f.alt_urls,
      f.author, f.desc_en, f.desc_zh, f.youtube, f.tags, f.status,
      id,
    ],
  );
  return c.json(rowToJson(updated[0]));
});

// DELETE /v1/nav/sites/:id
navSitesRoutes.delete('/nav/sites/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const deleted = await query<{ id: number | string }>(
    'DELETE FROM nav_sites WHERE id = ? RETURNING id',
    [id],
  );
  if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});
