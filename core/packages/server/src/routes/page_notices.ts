/**
 * /v1/page-notices — 每页顶部管理员通知条 (page notices / 维护中·WIP·bug 提示)。
 *   - GET    /v1/page-notices          — enabled 行 (public, 60s cache),前端一次拉完按 path 匹配
 *   - GET    /v1/page-notices/manage   — 全部行含 disabled (admin),行内编辑器预填用
 *   - PUT    /v1/page-notices          — admin upsert by path(ON CONFLICT path)
 *   - DELETE /v1/page-notices/:id      — admin 删
 *
 * path 为匹配模式:精确 `/scramble/stats`、前缀 `/recon/*`、全站 `/*`。前端已 strip lang 前缀。
 * Schema 见 migrations/0073_page_notices.sql。
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey, checkRateLimit } from '../utils/recon_helpers.js';

export const pageNoticesRoutes = new Hono();

const LEVELS = ['info', 'warning', 'maintenance'] as const;
type Level = (typeof LEVELS)[number];
const PATH_MAX = 300;
const BODY_MAX = 2000;

interface NoticeRow {
  id: number | string;
  path: string;
  level: string;
  body_en: string;
  body_zh: string;
  enabled: boolean;
  dismissible: boolean;
  updated_at: string | Date;
}

function rowToJson(r: NoticeRow) {
  return {
    id: Number(r.id),
    path: r.path,
    level: r.level,
    bodyEn: r.body_en,
    bodyZh: r.body_zh,
    enabled: r.enabled,
    dismissible: r.dismissible,
    updatedAt: r.updated_at,
  };
}

// 归一化匹配模式:补前导 '/',去尾部 '/'(根 '/' 与 '/*' glob 除外)。lang 前缀由前端 strip。
function normPath(s: string): string {
  let p = s.trim();
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

interface NoticeInput {
  path?: unknown;
  level?: unknown;
  bodyEn?: unknown;
  bodyZh?: unknown;
  enabled?: unknown;
  dismissible?: unknown;
}

interface Normalized {
  path: string; level: Level; bodyEn: string; bodyZh: string;
  enabled: boolean; dismissible: boolean;
}

function validate(b: NoticeInput): { error?: string; v?: Normalized } {
  if (typeof b.path !== 'string' || !b.path.trim()) return { error: 'path required' };
  const path = normPath(b.path);
  if (path.length > PATH_MAX) return { error: 'path too long' };
  const level = (typeof b.level === 'string' ? b.level : 'info') as Level;
  if (!LEVELS.includes(level)) return { error: 'invalid level' };
  if (b.bodyEn != null && typeof b.bodyEn !== 'string') return { error: 'bodyEn must be string' };
  if (b.bodyZh != null && typeof b.bodyZh !== 'string') return { error: 'bodyZh must be string' };
  const bodyEn = (typeof b.bodyEn === 'string' ? b.bodyEn : '').trim();
  const bodyZh = (typeof b.bodyZh === 'string' ? b.bodyZh : '').trim();
  if (bodyEn.length > BODY_MAX || bodyZh.length > BODY_MAX) return { error: `body too long (max ${BODY_MAX})` };
  if (!bodyEn && !bodyZh) return { error: 'body required (en or zh)' };
  return {
    v: {
      path, level, bodyEn, bodyZh,
      enabled: b.enabled !== false,       // 缺省 true
      dismissible: b.dismissible !== false, // 缺省 true
    },
  };
}

// GET /v1/page-notices — enabled 行 (public)
pageNoticesRoutes.get('/page-notices', async (c) => {
  c.header('Cache-Control', 'public, max-age=60');
  const rows = await query<NoticeRow>('SELECT * FROM page_notices WHERE enabled ORDER BY path');
  return c.json(rows.map(rowToJson));
});

// GET /v1/page-notices/manage — 全部行含 disabled (admin,行内编辑预填)
pageNoticesRoutes.get('/page-notices/manage', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdminOrApiKey(c);
  const rows = await query<NoticeRow>('SELECT * FROM page_notices ORDER BY path');
  return c.json(rows.map(rowToJson));
});

// PUT /v1/page-notices — upsert by path (admin)
pageNoticesRoutes.put('/page-notices', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const body = await c.req.json<NoticeInput>();
  const { error, v } = validate(body);
  if (error || !v) return c.json({ error: error ?? 'invalid' }, 400);

  const rows = await query<NoticeRow>(
    `INSERT INTO page_notices (path, level, body_en, body_zh, enabled, dismissible)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (path) DO UPDATE SET
       level = EXCLUDED.level, body_en = EXCLUDED.body_en, body_zh = EXCLUDED.body_zh,
       enabled = EXCLUDED.enabled, dismissible = EXCLUDED.dismissible, updated_at = NOW()
     RETURNING *`,
    [v.path, v.level, v.bodyEn, v.bodyZh, v.enabled, v.dismissible],
  );
  return c.json(rowToJson(rows[0]));
});

// DELETE /v1/page-notices/:id (admin)
pageNoticesRoutes.delete('/page-notices/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const deleted = await query<{ id: number | string }>(
    'DELETE FROM page_notices WHERE id = ? RETURNING id',
    [id],
  );
  if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});
