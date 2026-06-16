/**
 * /v1/feedback — 桌宠「反馈」入口(需求 / Bug / 其他)。任何登录 WCA 用户可提。
 *
 * 模型 (migration 0049 + 0058):
 *   - feedback:          正文(= 开帖) + 自动捕获环境(页面/语言/主题/视口/UA) + 对话读状态
 *                        (last_reply_*, user_read_at, admin_read_at)。admin 在 /feedback/admin 审核。
 *   - feedback_media:    截图存 BYTEA(沿用 article_image);短视频落磁盘(FEEDBACK_MEDIA_DIR),
 *                        PG 只存 disk_path → 不进每日备份。
 *   - feedback_messages: GitHub issue 式来回对话(role=user/admin)。开帖人在 /feedback 查看自己的
 *                        线程并回复;admin 在 /feedback/admin 回复。未读经 mine/unread 红点 + admin 列表高亮。
 *
 * 鉴权:提交 / 传附件 / 回帖 / 看线程 = requireAuth + 拥有该 feedback(或 admin)。
 *       审核列表 / 改状态 / 删 = requireAdmin;取媒体公开(immutable 长缓存)。
 *
 * 错误经 throw new Error(msg);全局 onError 按关键词推 HTTP code
 * (Authentication→401, Cannot→403, Rate limit→429, Validation/invalid→400)。
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { query } from '../db/connection.js';
import { requireAuth, requireAdmin, ADMIN_WCA_IDS, checkRateLimit } from '../utils/recon_helpers.js';
import { sendBark } from '../monitors/bark.js';

export const feedbackRoutes = new Hono();

const KINDS = new Set(['need', 'bug', 'other']);
const STATUSES = new Set(['new', 'triaged', 'done']);
const BODY_MAX = 8000;            // 正文字符上限
const CONTACT_MAX = 200;
const IMG_MAX_BYTES = 8 * 1024 * 1024;   // 8MB(解码后)
const VIDEO_MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_IMG_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_FEEDBACK_PER_USER = 500;       // 防滥用(admin 不限)
const MAX_IMAGES_PER_FEEDBACK = 6;
const MAX_VIDEOS_PER_FEEDBACK = 2;

// 视频落盘目录;prod 须设成持久路径(随重部署存活),local 退到 cwd 下。
const MEDIA_DIR = process.env.FEEDBACK_MEDIA_DIR || path.join(process.cwd(), '.feedback-media');

function getIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

function isAdmin(wcaId: string): boolean {
  return ADMIN_WCA_IDS.includes(wcaId);
}

/** 从图片头读宽高(仅 PNG IHDR;其余返 null)。无外部依赖。 */
function pngDimensions(buf: Buffer): { width: number | null; height: number | null } {
  try {
    if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }
  } catch { /* store NULL */ }
  return { width: null, height: null };
}

/** 嗅探视频容器(EBML/WebM 或 ISO BMFF mp4/mov);非视频返 null。优先信任嗅探结果。 */
function sniffVideo(buf: Buffer): string | null {
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'video/webm';
  }
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.toString('ascii', 8, 12);
    return brand.startsWith('qt') ? 'video/quicktime' : 'video/mp4';
  }
  return null;
}

const VIDEO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

interface FeedbackRow {
  id: number | string;
  kind: string;
  body: string;
  wca_id: string;
  wca_name: string;
  contact: string | null;
  page_url: string | null;
  lang: string | null;
  theme: string | null;
  viewport: string | null;
  user_agent: string | null;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
}

/** 取该 feedback 的 owner;不存在抛 Validation(→404 语义由调用方决定,这里走 not found）。 */
async function loadOwner(id: number): Promise<string> {
  const rows = await query<{ wca_id: string }>('SELECT wca_id FROM feedback WHERE id = ?', [id]);
  if (rows.length === 0) throw new Error('Validation: feedback not found');
  return rows[0].wca_id;
}

async function assertCanAttach(id: number, wcaId: string): Promise<void> {
  const owner = await loadOwner(id);
  if (owner !== wcaId && !isAdmin(wcaId)) throw new Error('Cannot attach to others feedback');
}

/** 取一条反馈的归属 + 当前状态;不存在返 null。 */
async function loadFeedback(id: number): Promise<{ wcaId: string; status: string } | null> {
  const rows = await query<{ wca_id: string; status: string }>(
    'SELECT wca_id, status FROM feedback WHERE id = ?', [id]);
  return rows.length ? { wcaId: rows[0].wca_id, status: rows[0].status } : null;
}

/** 批量取一组反馈的附件,返回 feedbackId → 客户端 media 形状数组。 */
async function mediaMap(ids: number[]): Promise<Map<number, Array<Record<string, unknown>>>> {
  const m = new Map<number, Array<Record<string, unknown>>>();
  if (ids.length === 0) return m;
  const placeholders = ids.map(() => '?').join(',');
  const media = await query<{
    id: number | string; feedback_id: number | string; kind: string; mime: string;
    size_bytes: number; width: number | null; height: number | null; duration_ms: number | null;
  }>(
    `SELECT id, feedback_id, kind, mime, size_bytes, width, height, duration_ms
     FROM feedback_media WHERE feedback_id IN (${placeholders}) ORDER BY id`,
    ids,
  );
  for (const mm of media) {
    const fb = Number(mm.feedback_id);
    const arr = m.get(fb) ?? [];
    arr.push({
      id: Number(mm.id), kind: mm.kind, mime: mm.mime, sizeBytes: Number(mm.size_bytes),
      width: mm.width, height: mm.height, durationMs: mm.duration_ms,
    });
    m.set(fb, arr);
  }
  return m;
}

/** 批量取一组反馈的回复条数。 */
async function replyCounts(ids: number[]): Promise<Map<number, number>> {
  const m = new Map<number, number>();
  if (ids.length === 0) return m;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query<{ feedback_id: number | string; n: number | string }>(
    `SELECT feedback_id, COUNT(*) AS n FROM feedback_messages
     WHERE feedback_id IN (${placeholders}) GROUP BY feedback_id`, ids);
  for (const r of rows) m.set(Number(r.feedback_id), Number(r.n));
  return m;
}

interface ThreadFeedbackRow extends FeedbackRow {
  last_reply_at: string | Date | null;
  last_reply_role: string | null;
  user_read_at: string | Date | null;
  admin_read_at: string | Date | null;
}

/** 管理视角:线程最后动作来自用户(含仅开帖) 且管理员尚未读 → 未读。 */
function adminUnread(r: ThreadFeedbackRow): boolean {
  const lastActorIsUser = r.last_reply_role ? r.last_reply_role === 'user' : true;
  if (!lastActorIsUser) return false;
  const activity = r.last_reply_at ?? r.created_at;
  return r.admin_read_at == null || new Date(activity) > new Date(r.admin_read_at);
}

/** 用户视角:有管理员回复且本人尚未读 → 未读。 */
function userUnread(r: ThreadFeedbackRow): boolean {
  if (r.last_reply_role !== 'admin' || r.last_reply_at == null) return false;
  return r.user_read_at == null || new Date(r.last_reply_at) > new Date(r.user_read_at);
}

// ── POST /v1/feedback — 创建一条反馈 ──────────────────────────────────────────
feedbackRoutes.post('/feedback', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    throw new Error('Validation: invalid json');
  }

  const kind = typeof body.kind === 'string' && KINDS.has(body.kind) ? body.kind : 'other';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) throw new Error('Validation: body is required');
  if (text.length > BODY_MAX) throw new Error(`Validation: body too long (max ${BODY_MAX})`);

  const str = (v: unknown, max: number): string | null => {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s ? s.slice(0, max) : null;
  };

  if (!isAdmin(user.wcaId)) {
    const cnt = await query<{ n: number | string }>(
      'SELECT COUNT(*) AS n FROM feedback WHERE wca_id = ?', [user.wcaId]);
    if (Number(cnt[0].n) >= MAX_FEEDBACK_PER_USER) {
      throw new Error('Validation: feedback limit reached');
    }
  }

  const inserted = await query<{ id: number | string }>(
    `INSERT INTO feedback (kind, body, wca_id, wca_name, contact, page_url, lang, theme, viewport, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [
      kind, text, user.wcaId, user.name ?? '',
      str(body.contact, CONTACT_MAX), str(body.pageUrl, 500),
      str(body.lang, 8), str(body.theme, 16), str(body.viewport, 24), str(body.userAgent, 500),
    ],
  );
  const id = Number(inserted[0].id);

  // 新反馈推送(best-effort,门关/无 key 静默)。
  sendBark({
    title: `新反馈 · ${kind}`,
    body: text.slice(0, 120),
    url: 'https://www.cuberoot.me/feedback/admin',
    group: 'Feedback',
  }).catch(() => {});

  return c.json({ id });
});

// ── POST /v1/feedback/:id/image — 截图(JSON base64,8MB) ───────────────────────
const imgBodyLimit = bodyLimit({
  maxSize: Math.ceil(IMG_MAX_BYTES * 1.4) + 64 * 1024,
  onError: (c) => c.json({ error: 'Payload too large (max 8MB)' }, 413),
});

feedbackRoutes.post('/feedback/:id/image', imgBodyLimit, async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) throw new Error('Validation: invalid id');
  await assertCanAttach(id, user.wcaId);

  let body: { dataB64?: unknown; mime?: unknown };
  try {
    body = await c.req.json<{ dataB64?: unknown; mime?: unknown }>();
  } catch {
    throw new Error('Validation: invalid json');
  }
  const mime = typeof body.mime === 'string' ? body.mime.trim().toLowerCase() : '';
  if (!ALLOWED_IMG_MIME.has(mime)) throw new Error('Validation: mime must be image/png, image/jpeg or image/webp');
  if (typeof body.dataB64 !== 'string' || !body.dataB64) throw new Error('Validation: dataB64 is required');

  const buf = Buffer.from(body.dataB64, 'base64');
  if (buf.length === 0) throw new Error('Validation: dataB64 is not valid base64');
  if (buf.length > IMG_MAX_BYTES) throw new Error('Validation: image too large (max 8MB)');

  const cnt = await query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM feedback_media WHERE feedback_id = ? AND kind = 'image'`, [id]);
  if (Number(cnt[0].n) >= MAX_IMAGES_PER_FEEDBACK) throw new Error('Validation: too many images');

  const dims = pngDimensions(buf);
  const inserted = await query<{ id: number | string }>(
    `INSERT INTO feedback_media (feedback_id, kind, mime, size_bytes, width, height, data)
     VALUES (?, 'image', ?, ?, ?, ?, ?) RETURNING id`,
    [id, mime, buf.length, dims.width, dims.height, buf],
  );
  return c.json({ id: Number(inserted[0].id) });
});

// ── POST /v1/feedback/:id/video — 短视频(multipart,落磁盘,20MB) ────────────────
const videoBodyLimit = bodyLimit({
  maxSize: VIDEO_MAX_BYTES + 1024 * 1024, // 给 multipart 头部余量
  onError: (c) => c.json({ error: 'Payload too large (max 20MB)' }, 413),
});

feedbackRoutes.post('/feedback/:id/video', videoBodyLimit, async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) throw new Error('Validation: invalid id');
  await assertCanAttach(id, user.wcaId);

  const cnt = await query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM feedback_media WHERE feedback_id = ? AND kind = 'video'`, [id]);
  if (Number(cnt[0].n) >= MAX_VIDEOS_PER_FEEDBACK) throw new Error('Validation: too many videos');

  let form: Record<string, string | File>;
  try {
    form = await c.req.parseBody();
  } catch {
    throw new Error('Validation: invalid multipart body');
  }
  const file = form.file;
  if (!(file instanceof File)) throw new Error('Validation: file is required');

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) throw new Error('Validation: empty file');
  if (buf.length > VIDEO_MAX_BYTES) throw new Error('Validation: video too large (max 20MB)');

  const mime = sniffVideo(buf);
  if (!mime) throw new Error('Validation: file must be mp4 / webm / mov video');

  const durRaw = Number(typeof form.durationMs === 'string' ? form.durationMs : NaN);
  const durationMs = Number.isFinite(durRaw) && durRaw > 0 ? Math.round(durRaw) : null;

  // 先建行拿 id → 以 id 命名落盘 → 回填 disk_path,避免文件名碰撞。
  const inserted = await query<{ id: number | string }>(
    `INSERT INTO feedback_media (feedback_id, kind, mime, size_bytes, duration_ms)
     VALUES (?, 'video', ?, ?, ?) RETURNING id`,
    [id, mime, buf.length, durationMs],
  );
  const mediaId = Number(inserted[0].id);
  const rel = `${mediaId}.${VIDEO_EXT[mime]}`;
  try {
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.writeFile(path.join(MEDIA_DIR, rel), buf);
  } catch (e) {
    await query('DELETE FROM feedback_media WHERE id = ?', [mediaId]).catch(() => {});
    console.error('[feedback] video write failed:', (e as Error).message);
    throw new Error('Internal: could not store video');
  }
  await query('UPDATE feedback_media SET disk_path = ? WHERE id = ?', [rel, mediaId]);
  return c.json({ id: mediaId });
});

// ── GET /v1/feedback/media/:id — 公开取媒体(image bytea / video disk)。
// 媒体一旦上传即不可变 → 长缓存 immutable;nosniff 防容器被当脚本渲染。
feedbackRoutes.get('/feedback/media/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const rows = await query<{ kind: string; mime: string; data: Buffer | Uint8Array | null; disk_path: string | null }>(
    'SELECT kind, mime, data, disk_path FROM feedback_media WHERE id = ?', [id]);
  if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
  const r = rows[0];

  c.header('Content-Type', r.mime);
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  c.header('X-Content-Type-Options', 'nosniff');

  if (r.kind === 'image' && r.data) {
    const buf = r.data instanceof Uint8Array ? r.data : Uint8Array.from(r.data as unknown as number[]);
    return c.body(buf as unknown as ArrayBuffer);
  }
  if (r.kind === 'video' && r.disk_path) {
    try {
      const buf = await fs.readFile(path.join(MEDIA_DIR, r.disk_path));
      return c.body(Uint8Array.from(buf) as unknown as ArrayBuffer);
    } catch {
      return c.json({ error: 'Not found' }, 404);
    }
  }
  return c.json({ error: 'Not found' }, 404);
});

// ── GET /v1/feedback/mine — 当前用户自己的反馈对话列表 ─────────────────────────
feedbackRoutes.get('/feedback/mine', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const rows = await query<ThreadFeedbackRow>(
    `SELECT id, kind, body, wca_id, wca_name, contact, page_url, lang, theme, viewport, user_agent,
            status, created_at, updated_at, last_reply_at, last_reply_role, user_read_at, admin_read_at
     FROM feedback WHERE wca_id = ?
     ORDER BY COALESCE(last_reply_at, created_at) DESC, id DESC
     LIMIT 200`,
    [user.wcaId],
  );
  const ids = rows.map((r) => Number(r.id));
  const [media, counts] = await Promise.all([mediaMap(ids), replyCounts(ids)]);
  const items = rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    body: r.body,
    status: r.status,
    createdAt: r.created_at,
    lastReplyAt: r.last_reply_at,
    lastReplyRole: r.last_reply_role,
    replyCount: counts.get(Number(r.id)) ?? 0,
    unread: userUnread(r),
    media: media.get(Number(r.id)) ?? [],
  }));
  return c.json({ items });
});

// ── GET /v1/feedback/mine/unread — 当前用户「有管理员新回复」的线程数(给入口红点) ──
feedbackRoutes.get('/feedback/mine/unread', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const rows = await query<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM feedback
     WHERE wca_id = ? AND last_reply_role = 'admin'
       AND (user_read_at IS NULL OR last_reply_at > user_read_at)`,
    [user.wcaId],
  );
  return c.json({ count: Number(rows[0].n) });
});

// ── GET /v1/feedback/:id/thread — 单条反馈完整对话(发帖人或 admin),取阅即标记已读 ──
feedbackRoutes.get('/feedback/:id/thread', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) throw new Error('Validation: invalid id');
  const fb = await loadFeedback(id);
  if (!fb) throw new Error('Validation: feedback not found');
  const admin = isAdmin(user.wcaId);
  const owner = fb.wcaId === user.wcaId;
  if (!admin && !owner) throw new Error('Cannot view others feedback');

  const rows = await query<ThreadFeedbackRow>(
    `SELECT id, kind, body, wca_id, wca_name, contact, page_url, lang, theme, viewport, user_agent,
            status, created_at, updated_at, last_reply_at, last_reply_role, user_read_at, admin_read_at
     FROM feedback WHERE id = ?`, [id]);
  const r = rows[0];
  const media = await mediaMap([id]);

  const msgs = await query<{
    id: number | string; role: string; wca_id: string; wca_name: string; body: string; created_at: string | Date;
  }>(
    `SELECT id, role, wca_id, wca_name, body, created_at FROM feedback_messages
     WHERE feedback_id = ? ORDER BY created_at, id`, [id]);

  // 取阅即标记请求方已读(admin 看自己提的反馈则两边都标)。
  if (admin) await query('UPDATE feedback SET admin_read_at = NOW() WHERE id = ?', [id]);
  if (owner) await query('UPDATE feedback SET user_read_at = NOW() WHERE id = ?', [id]);

  return c.json({
    feedback: {
      id: Number(r.id), kind: r.kind, body: r.body, wcaId: r.wca_id, wcaName: r.wca_name,
      contact: r.contact, pageUrl: r.page_url, lang: r.lang, theme: r.theme, viewport: r.viewport,
      userAgent: r.user_agent, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
      lastReplyAt: r.last_reply_at, lastReplyRole: r.last_reply_role,
      media: media.get(id) ?? [],
    },
    messages: msgs.map((m) => ({
      id: Number(m.id), role: m.role, wcaId: m.wca_id, wcaName: m.wca_name,
      body: m.body, createdAt: m.created_at,
    })),
  });
});

// ── POST /v1/feedback/:id/reply — 回帖(发帖人或 admin) ────────────────────────
feedbackRoutes.post('/feedback/:id/reply', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) throw new Error('Validation: invalid id');
  const fb = await loadFeedback(id);
  if (!fb) throw new Error('Validation: feedback not found');
  const admin = isAdmin(user.wcaId);
  const owner = fb.wcaId === user.wcaId;
  if (!admin && !owner) throw new Error('Cannot reply to others feedback');

  let body: { body?: unknown };
  try {
    body = await c.req.json<{ body?: unknown }>();
  } catch {
    throw new Error('Validation: invalid json');
  }
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) throw new Error('Validation: body is required');
  if (text.length > BODY_MAX) throw new Error(`Validation: body too long (max ${BODY_MAX})`);

  // admin 身份优先(admin 给自己提的反馈回帖时算 admin 回复)。
  const role = admin ? 'admin' : 'user';
  const inserted = await query<{ id: number | string }>(
    `INSERT INTO feedback_messages (feedback_id, role, wca_id, wca_name, body)
     VALUES (?, ?, ?, ?, ?) RETURNING id`,
    [id, role, user.wcaId, user.name ?? '', text],
  );

  // 推进线程:记录最后往来;admin 首次回复把 new → triaged。
  const bumpStatus = role === 'admin' && fb.status === 'new' ? ", status = 'triaged'" : '';
  await query(
    `UPDATE feedback SET last_reply_at = NOW(), last_reply_role = ?, updated_at = NOW()${bumpStatus} WHERE id = ?`,
    [role, id]);
  // 回帖人本人即已读(admin 与 owner 可能同时成立)。
  if (admin) await query('UPDATE feedback SET admin_read_at = NOW() WHERE id = ?', [id]);
  if (owner) await query('UPDATE feedback SET user_read_at = NOW() WHERE id = ?', [id]);

  // 用户回复推送给 admin(best-effort);admin 回复靠用户端未读红点感知。
  if (role === 'user') {
    sendBark({
      title: '反馈回复',
      body: `${user.name ?? user.wcaId}: ${text.slice(0, 120)}`,
      url: 'https://www.cuberoot.me/feedback/admin',
      group: 'Feedback',
    }).catch(() => {});
  }

  return c.json({ id: Number(inserted[0].id) });
});

// ── GET /v1/feedback — admin 审核列表(?status= 过滤) ──────────────────────────
feedbackRoutes.get('/feedback', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdmin(c);
  const status = c.req.query('status');
  const where = status && STATUSES.has(status) ? 'WHERE status = ?' : '';
  const params = where ? [status] : [];
  const rows = await query<ThreadFeedbackRow>(
    `SELECT id, kind, body, wca_id, wca_name, contact, page_url, lang, theme, viewport, user_agent,
            status, created_at, updated_at, last_reply_at, last_reply_role, user_read_at, admin_read_at
     FROM feedback ${where}
     ORDER BY COALESCE(last_reply_at, created_at) DESC, id DESC
     LIMIT 500`,
    params,
  );

  const ids = rows.map((r) => Number(r.id));
  const [media, counts] = await Promise.all([mediaMap(ids), replyCounts(ids)]);

  const items = rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    body: r.body,
    wcaId: r.wca_id,
    wcaName: r.wca_name,
    contact: r.contact,
    pageUrl: r.page_url,
    lang: r.lang,
    theme: r.theme,
    viewport: r.viewport,
    userAgent: r.user_agent,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastReplyAt: r.last_reply_at,
    lastReplyRole: r.last_reply_role,
    replyCount: counts.get(Number(r.id)) ?? 0,
    unread: adminUnread(r),
    media: media.get(Number(r.id)) ?? [],
  }));
  return c.json({ items });
});

// ── PATCH /v1/feedback/:id — admin 改状态 ─────────────────────────────────────
feedbackRoutes.patch('/feedback/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdmin(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) throw new Error('Validation: invalid id');

  let body: { status?: unknown };
  try {
    body = await c.req.json<{ status?: unknown }>();
  } catch {
    throw new Error('Validation: invalid json');
  }
  const status = typeof body.status === 'string' ? body.status : '';
  if (!STATUSES.has(status)) throw new Error('Validation: invalid status');

  const updated = await query<{ id: number | string }>(
    'UPDATE feedback SET status = ?, updated_at = NOW() WHERE id = ? RETURNING id', [status, id]);
  if (updated.length === 0) throw new Error('Validation: feedback not found');
  return c.json({ ok: true });
});

// ── DELETE /v1/feedback/:id — admin 删(连带磁盘视频文件) ──────────────────────
feedbackRoutes.delete('/feedback/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdmin(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) throw new Error('Validation: invalid id');

  // 先取视频盘文件路径,DB 行交给 ON DELETE CASCADE。
  const vids = await query<{ disk_path: string | null }>(
    `SELECT disk_path FROM feedback_media WHERE feedback_id = ? AND kind = 'video' AND disk_path IS NOT NULL`, [id]);
  await query('DELETE FROM feedback WHERE id = ?', [id]);
  for (const v of vids) {
    if (v.disk_path) await fs.unlink(path.join(MEDIA_DIR, v.disk_path)).catch(() => {});
  }
  return c.json({ ok: true });
});
