/**
 * /v1/page-notices — 页面通知(顶部运维通知 + 首页焦点新闻)。
 *   - GET    /v1/page-notices          — enabled 行 (public, 60s cache),前端一次拉完按 path 匹配
 *   - GET    /v1/page-notices/manage   — 全部行含 disabled (admin),行内编辑器预填用
 *   - PUT    /v1/page-notices          — admin upsert by path + placement
 *   - DELETE /v1/page-notices/:id      — admin 删
 *
 * path 为匹配模式:精确 `/scramble/stats`、前缀 `/recon/*`、全站 `/*`。前端已 strip lang 前缀。
 * Schema 见 migrations/0073_page_notices.sql、0169_page_notice_placements.sql。
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey, checkRateLimit } from '../utils/recon_helpers.js';

export const pageNoticesRoutes = new Hono();

const LEVELS = ['info', 'warning', 'maintenance'] as const;
type Level = (typeof LEVELS)[number];
const PLACEMENTS = ['page_top', 'home_featured'] as const;
type Placement = (typeof PLACEMENTS)[number];
// 可选图标 key 白名单,与 client PageNoticeBar.tsx 的 ICONS 保持一致('' = 按 level 回退)。
const ICON_KEYS = new Set([
  'info', 'warning', 'wrench', 'hammer', 'bug', 'refresh', 'flask', 'eye',
  'sparkles', 'rocket', 'megaphone', 'gift', 'bell', 'zap', 'archive',
]);
// 可选横幅颜色 key 白名单,与 client PageNoticeBar.tsx 的 COLORS 保持一致('' = 按 level 回退)。
const COLOR_KEYS = new Set([
  'blue', 'green', 'amber', 'red', 'terracotta', 'purple', 'cyan', 'pink',
]);
const PATH_MAX = 300;
const HREF_MAX = 1000;
const BODY_MAX = 2000;

interface NoticeRow {
  id: number | string;
  path: string;
  placement: string;
  level: string;
  icon: string | null;
  color: string | null;
  body_en: string;
  body_zh: string;
  href: string;
  enabled: boolean;
  dismissible: boolean;
  starts_at: string | Date | null;
  ends_at: string | Date | null;
  updated_at: string | Date;
}

function rowToJson(r: NoticeRow) {
  return {
    id: Number(r.id),
    path: r.path,
    placement: r.placement,
    level: r.level,
    icon: r.icon ?? '',
    color: r.color ?? '',
    bodyEn: r.body_en,
    bodyZh: r.body_zh,
    href: r.href,
    enabled: r.enabled,
    dismissible: r.dismissible,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
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
  id?: unknown;
  path?: unknown;
  placement?: unknown;
  level?: unknown;
  icon?: unknown;
  color?: unknown;
  bodyEn?: unknown;
  bodyZh?: unknown;
  href?: unknown;
  enabled?: unknown;
  dismissible?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
}

interface Normalized {
  path: string; placement: Placement; level: Level; icon: string; color: string;
  bodyEn: string; bodyZh: string; href: string; enabled: boolean; dismissible: boolean;
  startsAt: string | null; endsAt: string | null;
}

function parseOptionalDate(value: unknown, field: string): { error?: string; value?: string | null } {
  if (value == null || value === '') return { value: null };
  if (typeof value !== 'string') return { error: `${field} must be an ISO date string or null` };
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return { error: `${field} must be a valid ISO date string` };
  return { value: new Date(time).toISOString() };
}

function isSafeHref(href: string): boolean {
  if (!href) return true;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validate(b: NoticeInput): { error?: string; v?: Normalized } {
  if (typeof b.path !== 'string' || !b.path.trim()) return { error: 'path required' };
  const path = normPath(b.path);
  if (path.length > PATH_MAX) return { error: 'path too long' };
  const placement = (typeof b.placement === 'string' ? b.placement : 'page_top') as Placement;
  if (!PLACEMENTS.includes(placement)) return { error: 'invalid placement' };
  if (placement === 'home_featured' && path !== '/') return { error: 'home_featured requires path /' };
  const level = (typeof b.level === 'string' ? b.level : 'info') as Level;
  if (!LEVELS.includes(level)) return { error: 'invalid level' };
  // icon / color 非白名单一律降级为 ''(回退到 level 默认),不报错——前端可能发未知 key。
  const icon = typeof b.icon === 'string' && ICON_KEYS.has(b.icon) ? b.icon : '';
  const color = typeof b.color === 'string' && COLOR_KEYS.has(b.color) ? b.color : '';
  if (b.bodyEn != null && typeof b.bodyEn !== 'string') return { error: 'bodyEn must be string' };
  if (b.bodyZh != null && typeof b.bodyZh !== 'string') return { error: 'bodyZh must be string' };
  const bodyEn = (typeof b.bodyEn === 'string' ? b.bodyEn : '').trim();
  const bodyZh = (typeof b.bodyZh === 'string' ? b.bodyZh : '').trim();
  if (bodyEn.length > BODY_MAX || bodyZh.length > BODY_MAX) return { error: `body too long (max ${BODY_MAX})` };
  if (!bodyEn && !bodyZh) return { error: 'body required (en or zh)' };
  if (b.href != null && typeof b.href !== 'string') return { error: 'href must be string' };
  const href = (typeof b.href === 'string' ? b.href : '').trim();
  if (href.length > HREF_MAX) return { error: 'href too long' };
  if (!isSafeHref(href)) return { error: 'href must be an internal path or HTTP(S) URL' };
  if (placement === 'home_featured' && !href) return { error: 'home_featured requires href' };
  const starts = parseOptionalDate(b.startsAt, 'startsAt');
  if (starts.error) return { error: starts.error };
  const ends = parseOptionalDate(b.endsAt, 'endsAt');
  if (ends.error) return { error: ends.error };
  if (starts.value && ends.value && Date.parse(ends.value) <= Date.parse(starts.value)) {
    return { error: 'endsAt must be later than startsAt' };
  }
  return {
    v: {
      path, placement, level, icon, color, bodyEn, bodyZh, href,
      enabled: b.enabled !== false,       // 缺省 true
      dismissible: b.dismissible !== false, // 缺省 true
      startsAt: starts.value ?? null,
      endsAt: ends.value ?? null,
    },
  };
}

// GET /v1/page-notices — enabled 行 (public)
pageNoticesRoutes.get('/page-notices', async (c) => {
  c.header('Cache-Control', 'public, max-age=60');
  const rows = await query<NoticeRow>(
    `SELECT * FROM page_notices
     WHERE enabled
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at > NOW())
     ORDER BY placement, path, updated_at DESC`,
  );
  return c.json(rows.map(rowToJson));
});

// GET /v1/page-notices/manage — 全部行含 disabled (admin,行内编辑预填)
pageNoticesRoutes.get('/page-notices/manage', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdminOrApiKey(c);
  const rows = await query<NoticeRow>('SELECT * FROM page_notices ORDER BY placement, path');
  return c.json(rows.map(rowToJson));
});

// PUT /v1/page-notices — upsert by path + placement (admin)
pageNoticesRoutes.put('/page-notices', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const body = await c.req.json<NoticeInput>();
  const { error, v } = validate(body);
  if (error || !v) return c.json({ error: error ?? 'invalid' }, 400);

  if (body.id != null) {
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'invalid id' }, 400);
    const updated = await query<NoticeRow>(
      `UPDATE page_notices SET
         path = ?, placement = ?, level = ?, icon = ?, color = ?, body_en = ?, body_zh = ?,
         href = ?, enabled = ?, dismissible = ?, starts_at = ?, ends_at = ?, updated_at = NOW()
       WHERE id = ?
       RETURNING *`,
      [
        v.path, v.placement, v.level, v.icon, v.color, v.bodyEn, v.bodyZh, v.href,
        v.enabled, v.dismissible, v.startsAt, v.endsAt, id,
      ],
    );
    if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(rowToJson(updated[0]));
  }

  const rows = await query<NoticeRow>(
    `INSERT INTO page_notices (
       path, placement, level, icon, color, body_en, body_zh, href,
       enabled, dismissible, starts_at, ends_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (path, placement) DO UPDATE SET
       level = EXCLUDED.level, icon = EXCLUDED.icon, color = EXCLUDED.color,
       body_en = EXCLUDED.body_en, body_zh = EXCLUDED.body_zh, href = EXCLUDED.href,
       enabled = EXCLUDED.enabled, dismissible = EXCLUDED.dismissible,
       starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, updated_at = NOW()
     RETURNING *`,
    [
      v.path, v.placement, v.level, v.icon, v.color, v.bodyEn, v.bodyZh, v.href,
      v.enabled, v.dismissible, v.startsAt, v.endsAt,
    ],
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
