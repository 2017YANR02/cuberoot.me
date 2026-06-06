/**
 * /v1/article — 社区长文发布系统 (untrusted: 任何登录 WCA 用户可发)。
 *
 * 模型 (migration 0026):
 *   - article:        markdown + 自定义指令正文 (source of record)。published_at NULL = 草稿;
 *                     deleted_at = 软删。owner_wca_id/owner_name 创建时快照。
 *   - article_image:  配图 BYTEA,经 GET /article/img/:id 公开服务 (immutable + nginx cache)。
 *
 * 鉴权:
 *   - 列表/单篇读已发布 = 公开;草稿仅 owner/admin。
 *   - 创建/改/删/传图 = requireAuth + rate limit;改/删另要 owner 或 admin。
 *   - owner 校验 = isAdmin || row.owner_wca_id === user.wcaId。
 *
 * 错误经 throw new Error(msg);全局 onError 按关键词推 HTTP code
 * (Authentication→401, Cannot→403, Rate limit→429, Validation/invalid→400)。
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { query } from '../db/connection.js';
import {
  requireAuth,
  authenticateUser,
  ADMIN_WCA_IDS,
  checkRateLimit,
} from '../utils/recon_helpers.js';

export const articleRoutes = new Hono();

// markdown + 指令正文上限 256KB (与 SPEC §2 一致)。
const BODY_MAX_BYTES = 256 * 1024; // 262144
const SLUG_MAX = 200;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMG_MAX_BYTES = 8 * 1024 * 1024; // 8MB 解码后上限
const ALLOWED_IMG_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** Client IP for rate limiting (Nginx reverse-proxy sets X-Real-IP). */
function getIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

interface ArticleRow {
  id: number | string;
  slug: string;
  title: string;
  subtitle: string | null;
  body: string;
  lang: string;
  owner_wca_id: string;
  owner_name: string;
  published_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  deleted_at: string | Date | null;
}

/** 精简列表项 (不含 body)。 */
function rowToListItem(r: ArticleRow) {
  return {
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle ?? undefined,
    authorName: r.owner_name,
    authorWcaId: r.owner_wca_id,
    lang: r.lang,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
  };
}

/** 全量 (含 body),可带 canEdit。 */
function rowToArticle(r: ArticleRow, canEdit: boolean) {
  return {
    ...rowToListItem(r),
    body: r.body,
    createdAt: r.created_at,
    canEdit,
  };
}

/** 取认证用户 (可空),用于 ?mine / 草稿可见性 / canEdit。 */
async function getOptionalUser(c: { req: { header: (name: string) => string | undefined } }) {
  return authenticateUser(c.req.header('Authorization'));
}

function isOwner(ownerWcaId: string, wcaId: string): boolean {
  return ADMIN_WCA_IDS.includes(wcaId) || ownerWcaId === wcaId;
}

function validateSlug(s: unknown): string {
  if (typeof s !== 'string') throw new Error('Validation: slug is required');
  const v = s.trim();
  if (!v) throw new Error('Validation: slug is required');
  if (v.length > SLUG_MAX) throw new Error(`Validation: slug too long (max ${SLUG_MAX})`);
  if (!SLUG_RE.test(v)) throw new Error('Validation: slug must be lowercase letters, digits and hyphens');
  return v;
}

function validateTitle(s: unknown): string {
  if (typeof s !== 'string') throw new Error('Validation: title is required');
  const v = s.trim();
  if (!v) throw new Error('Validation: title is required');
  return v;
}

function validateBody(s: unknown): string {
  if (typeof s !== 'string') throw new Error('Validation: body is required');
  if (Buffer.byteLength(s, 'utf8') > BODY_MAX_BYTES) {
    throw new Error(`Validation: body too large (max ${BODY_MAX_BYTES} bytes)`);
  }
  return s;
}

/** optional subtitle: 允许缺省/空字符串 → null。 */
function normalizeSubtitle(s: unknown): string | null {
  if (s === undefined || s === null) return null;
  if (typeof s !== 'string') throw new Error('Validation: subtitle must be a string');
  const v = s.trim();
  return v ? v : null;
}

/** 公开服务的 API origin,用于拼图片 URL。优先 nginx 转发头,回退请求 URL。 */
function apiOrigin(c: { req: { header: (name: string) => string | undefined; url: string } }): string {
  // 只信任反代设置的 X-Forwarded-Host(prod nginx 必设);裸 Host 头攻击者可控,不作回退。
  const host = c.req.header('X-Forwarded-Host');
  if (host) {
    const proto = c.req.header('X-Forwarded-Proto') ?? 'https';
    return `${proto}://${host}`;
  }
  try {
    return new URL(c.req.url).origin;
  } catch {
    return '';
  }
}

// GET /v1/article — 列表。默认仅已发布;?mine=1 (authed) 返回自己的草稿+发布。
articleRoutes.get('/article', async (c) => {
  const mine = c.req.query('mine') === '1';
  if (mine) {
    c.header('Cache-Control', 'no-store');
    const user = await requireAuth(c);
    const rows = await query<ArticleRow>(
      `SELECT id, slug, title, subtitle, body, lang, owner_wca_id, owner_name,
              published_at, created_at, updated_at, deleted_at
       FROM article
       WHERE deleted_at IS NULL AND owner_wca_id = ?
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC`,
      [user.wcaId],
    );
    return c.json({ articles: rows.map(rowToListItem) });
  }

  c.header('Cache-Control', 'public, max-age=300');
  const rows = await query<ArticleRow>(
    `SELECT id, slug, title, subtitle, body, lang, owner_wca_id, owner_name,
            published_at, created_at, updated_at, deleted_at
     FROM article
     WHERE deleted_at IS NULL AND published_at IS NOT NULL
     ORDER BY published_at DESC, id DESC`,
  );
  return c.json({ articles: rows.map(rowToListItem) });
});

// GET /v1/article/me — 透传当前登录态 (UI 门控,仿 /wiki/me)。
// NOTE: 放在 /article/:slug 之前注册,否则 'me' 会被当成 slug 命中。
articleRoutes.get('/article/me', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await getOptionalUser(c);
  if (!user) return c.json({ wcaId: null, name: null, isAdmin: false });
  return c.json({
    wcaId: user.wcaId,
    name: user.name,
    isAdmin: ADMIN_WCA_IDS.includes(user.wcaId),
  });
});

// GET /v1/article/img/:id — 公开服务 bytea (no auth)。immutable 长缓存。
// NOTE: 放在 /article/:slug 之前,否则 '/article/img/:id' 会被 :slug 吞掉。
articleRoutes.get('/article/img/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const rows = await query<{ data: Buffer | Uint8Array; mime: string }>(
    'SELECT data, mime FROM article_image WHERE id = ?',
    [id],
  );
  if (rows.length === 0) return c.json({ error: 'Not found' }, 404);

  const r = rows[0];
  const buf = r.data instanceof Uint8Array ? r.data : Uint8Array.from(r.data as unknown as number[]);
  c.header('Content-Type', r.mime);
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  return c.body(buf as unknown as ArrayBuffer);
});

// POST /v1/article/img — 传图 (requireAuth + rate limit + 8MB bodyLimit)。
// JSON { dataB64, mime }。
const imgBodyLimit = bodyLimit({
  // base64 膨胀 ~4/3 + JSON envelope;给足头部。
  maxSize: Math.ceil(IMG_MAX_BYTES * 1.4) + 64 * 1024,
  onError: (c) => c.json({ error: 'Payload too large (max 8MB)' }, 413),
});

articleRoutes.post('/article/img', imgBodyLimit, async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  let body: { dataB64?: unknown; mime?: unknown };
  try {
    body = await c.req.json<{ dataB64?: unknown; mime?: unknown }>();
  } catch {
    throw new Error('Validation: invalid json');
  }

  const mime = typeof body.mime === 'string' ? body.mime.trim().toLowerCase() : '';
  if (!ALLOWED_IMG_MIME.has(mime)) {
    throw new Error('Validation: mime must be image/png, image/jpeg or image/webp');
  }
  if (typeof body.dataB64 !== 'string' || body.dataB64.length === 0) {
    throw new Error('Validation: dataB64 is required');
  }

  const buf = Buffer.from(body.dataB64, 'base64');
  if (buf.length === 0) throw new Error('Validation: dataB64 is not valid base64');
  if (buf.length > IMG_MAX_BYTES) throw new Error('Validation: image too large (max 8MB)');

  const dims = parseImageDimensions(buf, mime);

  const inserted = await query<{ id: number | string }>(
    `INSERT INTO article_image (data, mime, width, height, size_bytes, owner_wca_id)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [buf, mime, dims.width, dims.height, buf.length, user.wcaId],
  );
  const id = Number(inserted[0].id);
  return c.json({ id, url: `${apiOrigin(c)}/v1/article/img/${id}` });
});

// GET /v1/article/:slug — 单篇。已发布任何人可看;草稿仅 owner/admin。
articleRoutes.get('/article/:slug', async (c) => {
  const slug = c.req.param('slug');
  const rows = await query<ArticleRow>(
    `SELECT id, slug, title, subtitle, body, lang, owner_wca_id, owner_name,
            published_at, created_at, updated_at, deleted_at
     FROM article
     WHERE deleted_at IS NULL AND slug = ?`,
    [slug],
  );
  if (rows.length === 0) {
    c.header('Cache-Control', 'no-store');
    return c.json({ error: 'Not found' }, 404);
  }
  const row = rows[0];
  const published = row.published_at != null;

  const user = await getOptionalUser(c);
  const canEdit = user != null && isOwner(row.owner_wca_id, user.wcaId);

  if (!published && !canEdit) {
    // 草稿对非 owner/admin 不存在。
    c.header('Cache-Control', 'no-store');
    return c.json({ error: 'Not found' }, 404);
  }

  c.header('Cache-Control', published ? 'public, max-age=300' : 'no-store');
  return c.json({ article: rowToArticle(row, canEdit) });
});

// POST /v1/article — 创建 (requireAuth + rate limit)。
articleRoutes.post('/article', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    throw new Error('Validation: invalid json');
  }

  const slug = validateSlug(body.slug);
  const title = validateTitle(body.title);
  const bodyText = validateBody(body.body);
  const subtitle = normalizeSubtitle(body.subtitle);
  const publish = body.publish === true;
  const lang = typeof body.lang === 'string' && body.lang.trim() ? body.lang.trim().slice(0, 8) : 'zh';

  // slug 唯一 (非软删)。
  const dup = await query<{ id: number | string }>(
    'SELECT id FROM article WHERE slug = ? AND deleted_at IS NULL',
    [slug],
  );
  if (dup.length > 0) throw new Error('Validation: slug already in use');

  let inserted: ArticleRow[];
  try {
    inserted = await query<ArticleRow>(
      `INSERT INTO article (slug, title, subtitle, body, lang, owner_wca_id, owner_name, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${publish ? 'NOW()' : 'NULL'})
       RETURNING id, slug, title, subtitle, body, lang, owner_wca_id, owner_name,
                 published_at, created_at, updated_at, deleted_at`,
      [slug, title, subtitle, bodyText, lang, user.wcaId, user.name],
    );
  } catch (e) {
    // 并发下两个请求同时通过上面的唯一性预检 → 唯一索引兜底,转成 400 而非 500。
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate key|unique|uq_article_slug|23505/i.test(msg)) {
      throw new Error('Validation: slug already in use');
    }
    throw e;
  }
  return c.json({ article: rowToArticle(inserted[0], true) });
});

// PATCH /v1/article/:slug — owner/admin 改 title/subtitle/body/slug/publish。
articleRoutes.patch('/article/:slug', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const slugParam = c.req.param('slug');
  const found = await query<ArticleRow>(
    `SELECT id, slug, title, subtitle, body, lang, owner_wca_id, owner_name,
            published_at, created_at, updated_at, deleted_at
     FROM article
     WHERE deleted_at IS NULL AND slug = ?`,
    [slugParam],
  );
  if (found.length === 0) return c.json({ error: 'Not found' }, 404);
  const row = found[0];

  if (!isOwner(row.owner_wca_id, user.wcaId)) {
    throw new Error("Cannot edit others' articles");
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    throw new Error('Validation: invalid json');
  }

  const sets: string[] = [];
  const vals: unknown[] = [];

  if (body.title !== undefined) {
    sets.push('title = ?');
    vals.push(validateTitle(body.title));
  }
  if (body.subtitle !== undefined) {
    sets.push('subtitle = ?');
    vals.push(normalizeSubtitle(body.subtitle));
  }
  if (body.body !== undefined) {
    sets.push('body = ?');
    vals.push(validateBody(body.body));
  }
  if (body.lang !== undefined) {
    const lang = typeof body.lang === 'string' && body.lang.trim() ? body.lang.trim().slice(0, 8) : 'zh';
    sets.push('lang = ?');
    vals.push(lang);
  }
  if (body.slug !== undefined) {
    const newSlug = validateSlug(body.slug);
    if (newSlug !== row.slug) {
      const dup = await query<{ id: number | string }>(
        'SELECT id FROM article WHERE slug = ? AND deleted_at IS NULL AND id <> ?',
        [newSlug, Number(row.id)],
      );
      if (dup.length > 0) throw new Error('Validation: slug already in use');
    }
    sets.push('slug = ?');
    vals.push(newSlug);
  }
  if (body.publish !== undefined) {
    if (body.publish === true) {
      // 仅首次发布设 published_at;已发布保持原时间。
      sets.push('published_at = COALESCE(published_at, NOW())');
    } else if (body.publish === false) {
      sets.push('published_at = NULL');
    } else {
      throw new Error('Validation: publish must be a boolean');
    }
  }

  if (sets.length === 0) {
    return c.json({ article: rowToArticle(row, true) });
  }

  vals.push(Number(row.id));
  const updated = await query<ArticleRow>(
    `UPDATE article SET ${sets.join(', ')}
     WHERE id = ?
     RETURNING id, slug, title, subtitle, body, lang, owner_wca_id, owner_name,
               published_at, created_at, updated_at, deleted_at`,
    vals,
  );
  return c.json({ article: rowToArticle(updated[0], true) });
});

// DELETE /v1/article/:slug — owner/admin 软删。
articleRoutes.delete('/article/:slug', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  const slug = c.req.param('slug');
  const found = await query<{ id: number | string; owner_wca_id: string }>(
    'SELECT id, owner_wca_id FROM article WHERE slug = ? AND deleted_at IS NULL',
    [slug],
  );
  if (found.length === 0) return c.json({ error: 'Not found' }, 404);

  if (!isOwner(found[0].owner_wca_id, user.wcaId)) {
    throw new Error("Cannot delete others' articles");
  }

  await query('UPDATE article SET deleted_at = NOW() WHERE id = ?', [Number(found[0].id)]);
  return c.json({ ok: true });
});

/**
 * 从图片头读宽高 (仅 PNG IHDR;JPEG/WebP 不解析,返 null)。无外部依赖。
 */
function parseImageDimensions(buf: Buffer, mime: string): { width: number | null; height: number | null } {
  try {
    if (mime === 'image/png' && buf.length >= 24
      && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      // PNG: 8B sig + 4B len + 'IHDR' (4B), then width(4B) height(4B) big-endian.
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }
  } catch {
    // ignore — store NULL.
  }
  return { width: null, height: null };
}
