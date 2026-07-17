/**
 * 论坛(/forum)路由:分类/子版索引、主题列表、帖子分页、发帖/回帖/编辑/软删、
 * 置顶/锁帖(管理员)、反应(一人一帖一条)、浏览计数、最新活跃、搜索、举报。
 * 结构对标 speedsolving.com;作者键 = 全站归属键 ownerKey(真 wca_id 或 u<uid>)。
 * 表:forum_categories / forum_forums / forum_threads / forum_posts / forum_reactions / forum_reports(0066)。
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import {
  requireAuth, authenticateUser, checkRateLimit, ADMIN_WCA_IDS,
} from '../utils/recon_helpers.js';
import type { WcaUser } from '../utils/recon_helpers.js';
import { notify, adminRecipients } from '../utils/notify.js';

export const forumRoutes = new Hono();

/**
 * 通知失败绝不能连累已经落库的帖子(用户看到 500 会重发,于是重复发帖)—— 故吞异常。
 * 但要 await:notify() 里写 notifications 表是主路径(邮件才是它内部的旁路),
 * 不等的话响应已返回而通知行还没写,收件人的红点会慢一拍甚至在崩溃时丢掉。
 * 与 recon.ts 的挂钩方式一致。
 */
async function notifyBestEffort(input: Parameters<typeof notify>[0]): Promise<void> {
  try {
    await notify(input);
  } catch (e) {
    console.warn('[forum] notify failed:', (e as Error).message);
  }
}

const REACTION_KINDS = ['like', 'love', 'haha', 'wow', 'sad'];

// 读端点(浏览计数/搜索)独立限流桶,与共享写桶(30/60s)分离——
// 否则逛论坛就把同 IP 的发帖配额抽干。120 次/60s/IP。
const READ_LIMIT = 120;
const READ_WINDOW_MS = 60_000;
const readBuckets = new Map<string, { count: number; resetAt: number }>();
function checkReadRate(ip: string): boolean {
  const now = Date.now();
  const b = readBuckets.get(ip);
  if (!b || now >= b.resetAt) {
    if (readBuckets.size > 10_000) readBuckets.clear();
    readBuckets.set(ip, { count: 1, resetAt: now + READ_WINDOW_MS });
    return true;
  }
  b.count += 1;
  return b.count <= READ_LIMIT;
}

/** 用户内容,永远即取即新 */
function noStore(c: { header: (k: string, v: string) => void }): void {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
}

function isAdmin(user: WcaUser): boolean {
  return ADMIN_WCA_IDS.includes(user.wcaId);
}

/** 解析正整数参数,非法回落默认值并夹在 [min, max] */
function posInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/** LIKE 模式转义(%/_/\),配合 SQL 里的 ESCAPE '\' */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}

// 正文长度上限。长文并入论坛后(原 /article 无此限),放宽到 50k 让教程级长帖能发。
const MAX_CONTENT_LEN = 50000;

// ── 发帖审核(issue #36,Discourse approve-post-count 模式)────────────────────
// 新用户前 N 帖(含主题首帖)须管理员过审才公开;已过审帖数 >= N 视为可信直发。
const APPROVE_POST_COUNT = (() => {
  const n = Number(process.env.FORUM_APPROVE_POST_COUNT);
  return Number.isInteger(n) && n >= 0 ? n : 3;
})();
// 敏感词(Discourse watched words):命中则连可信用户也进队列。逗号分隔,大小写不敏感。
const WATCH_WORDS = (process.env.FORUM_WATCH_WORDS ?? '')
  .split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);

type ReviewStatus = 'approved' | 'pending' | 'rejected';

/** 发布门槛:管理员免审 → 敏感词必审 → 已过审帖数不足 N 必审。 */
async function statusFor(user: WcaUser, text: string): Promise<'approved' | 'pending'> {
  if (isAdmin(user)) return 'approved';
  const lower = text.toLowerCase();
  if (WATCH_WORDS.some((w) => lower.includes(w))) return 'pending';
  if (APPROVE_POST_COUNT === 0) return 'approved';
  // LIMIT N 内层:够数就停,不全表数
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT 1 FROM forum_posts WHERE author_id = ? AND status = 'approved' AND NOT is_deleted LIMIT ?
     ) s`,
    [user.wcaId, APPROVE_POST_COUNT],
  );
  return rows[0].n >= APPROVE_POST_COUNT ? 'approved' : 'pending';
}

// post_total = 全部楼层数(含软删/待审占位)——客户端「跳到最后一页」的分页数学要按占位算
const THREAD_COLS = `t.id, t.title, t.author_id, t.author_name, t.created_at,
  t.reply_count, t.view_count, t.last_post_at, t.last_post_author_id, t.last_post_author_name,
  t.is_pinned, t.is_locked, t.status,
  (SELECT COUNT(*)::int FROM forum_posts pp WHERE pp.thread_id = t.id) AS post_total`;

interface ThreadRow {
  id: string; title: string; author_id: string; author_name: string; created_at: Date;
  reply_count: number; view_count: number; last_post_at: Date;
  last_post_author_id: string | null; last_post_author_name: string | null;
  is_pinned: boolean; is_locked: boolean; status: ReviewStatus; post_total: number;
  forum_slug?: string; forum_name_en?: string; forum_name_zh?: string;
  snippet_content?: string | null;
}

function threadJson(r: ThreadRow) {
  return {
    id: Number(r.id), title: r.title, authorId: r.author_id, authorName: r.author_name,
    createdAt: r.created_at, replyCount: r.reply_count, viewCount: r.view_count,
    lastPostAt: r.last_post_at, lastPostAuthorId: r.last_post_author_id,
    lastPostAuthorName: r.last_post_author_name, isPinned: r.is_pinned, isLocked: r.is_locked,
    status: r.status, postTotal: r.post_total,
  };
}

/** 帖子反应聚合:[{kind, count, names(≤3)}],按 count 降序 */
async function reactionsFor(postIds: number[]): Promise<Map<number, { kind: string; count: number; names: string[] }[]>> {
  const map = new Map<number, { kind: string; count: number; names: string[] }[]>();
  if (postIds.length === 0) return map;
  const ph = postIds.map(() => '?').join(',');
  const rows = await query<{ post_id: string; kind: string; author_name: string }>(
    `SELECT post_id, kind, author_name FROM forum_reactions WHERE post_id IN (${ph}) ORDER BY created_at`,
    postIds,
  );
  const byPost = new Map<number, Map<string, { count: number; names: string[] }>>();
  for (const r of rows) {
    const pid = Number(r.post_id);
    let kinds = byPost.get(pid);
    if (!kinds) { kinds = new Map(); byPost.set(pid, kinds); }
    let agg = kinds.get(r.kind);
    if (!agg) { agg = { count: 0, names: [] }; kinds.set(r.kind, agg); }
    agg.count += 1;
    if (agg.names.length < 3) agg.names.push(r.author_name);
  }
  for (const [pid, kinds] of byPost) {
    map.set(pid, [...kinds.entries()]
      .map(([kind, a]) => ({ kind, count: a.count, names: a.names }))
      .sort((a, b) => b.count - a.count));
  }
  return map;
}

// ==================== GET /v1/forum/index ====================
// 论坛首页:分类 → 子版(计数现算,不反规范化)+ 全站统计。
forumRoutes.get('/forum/index', async (c) => {
  noStore(c);
  const rows = await query<{
    cat_id: string; cat_slug: string; cat_name_en: string; cat_name_zh: string;
    id: string; slug: string; name_en: string; name_zh: string; desc_en: string; desc_zh: string;
    icon: string; admin_only: boolean;
    thread_count: number; post_count: number;
    lt_id: string | null; lt_title: string | null; lt_last_post_at: Date | null;
    lt_author_id: string | null; lt_author_name: string | null;
  }>(
    `SELECT c.id AS cat_id, c.slug AS cat_slug, c.name_en AS cat_name_en, c.name_zh AS cat_name_zh,
            f.id, f.slug, f.name_en, f.name_zh, f.desc_en, f.desc_zh, f.icon, f.admin_only,
            s.thread_count, s.post_count,
            lt.id AS lt_id, lt.title AS lt_title, lt.last_post_at AS lt_last_post_at,
            lt.last_post_author_id AS lt_author_id, lt.last_post_author_name AS lt_author_name
     FROM forum_categories c
     JOIN forum_forums f ON f.category_id = c.id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS thread_count,
              (COALESCE(SUM(t.reply_count), 0) + COUNT(*))::int AS post_count
       FROM forum_threads t WHERE t.forum_id = f.id AND NOT t.is_deleted AND t.status = 'approved'
     ) s ON TRUE
     LEFT JOIN LATERAL (
       SELECT t.id, t.title, t.last_post_at, t.last_post_author_id, t.last_post_author_name
       FROM forum_threads t WHERE t.forum_id = f.id AND NOT t.is_deleted AND t.status = 'approved'
       ORDER BY t.last_post_at DESC LIMIT 1
     ) lt ON TRUE
     ORDER BY c.sort_order, c.id, f.sort_order, f.id`,
  );

  const cats: {
    id: number; slug: string; nameEn: string; nameZh: string;
    forums: Record<string, unknown>[];
  }[] = [];
  for (const r of rows) {
    let cat = cats.length > 0 ? cats[cats.length - 1] : undefined;
    if (!cat || cat.id !== Number(r.cat_id)) {
      cat = { id: Number(r.cat_id), slug: r.cat_slug, nameEn: r.cat_name_en, nameZh: r.cat_name_zh, forums: [] };
      cats.push(cat);
    }
    cat.forums.push({
      id: Number(r.id), slug: r.slug, nameEn: r.name_en, nameZh: r.name_zh,
      descEn: r.desc_en, descZh: r.desc_zh, icon: r.icon, adminOnly: r.admin_only,
      threadCount: r.thread_count, postCount: r.post_count,
      lastThread: r.lt_id == null ? null : {
        id: Number(r.lt_id), title: r.lt_title, lastPostAt: r.lt_last_post_at,
        lastPostAuthorId: r.lt_author_id, lastPostAuthorName: r.lt_author_name,
      },
    });
  }

  const stats = await query<{ threads: number; posts: number; members: number; latest_member: string | null }>(
    `SELECT (SELECT COUNT(*) FROM forum_threads WHERE NOT is_deleted AND status = 'approved')::int AS threads,
            (SELECT (COALESCE(SUM(reply_count), 0) + COUNT(*)) FROM forum_threads WHERE NOT is_deleted AND status = 'approved')::int AS posts,
            (SELECT COUNT(*) FROM app_users)::int AS members,
            (SELECT display_name FROM app_users ORDER BY id DESC LIMIT 1) AS latest_member`,
  );
  const s = stats[0];
  return c.json({
    categories: cats,
    stats: { threads: s.threads, posts: s.posts, members: s.members, latestMemberName: s.latest_member ?? '' },
  });
});

// ==================== GET /v1/forum/f/:slug ====================
// 子版主题列表:置顶单列(仅第 1 页),普通主题分页。
forumRoutes.get('/forum/f/:slug', async (c) => {
  noStore(c);
  const slug = (c.req.param('slug') ?? '').trim();
  const page = posInt(c.req.query('page'), 1, 1, 100000);
  const size = posInt(c.req.query('size'), 25, 1, 100);
  const sort = c.req.query('sort') === 'created' ? 'created' : 'activity';

  const forums = await query<{
    id: string; slug: string; name_en: string; name_zh: string; desc_en: string; desc_zh: string;
    icon: string; admin_only: boolean; cat_slug: string; cat_name_en: string; cat_name_zh: string;
  }>(
    `SELECT f.id, f.slug, f.name_en, f.name_zh, f.desc_en, f.desc_zh, f.icon, f.admin_only,
            c.slug AS cat_slug, c.name_en AS cat_name_en, c.name_zh AS cat_name_zh
     FROM forum_forums f JOIN forum_categories c ON c.id = f.category_id
     WHERE f.slug = ?`,
    [slug],
  );
  if (forums.length === 0) return c.json({ error: 'Forum not found' }, 404);
  const f = forums[0];
  const forumId = Number(f.id);

  const orderBy = sort === 'created' ? 't.created_at DESC' : 't.last_post_at DESC';
  const pinned = page === 1
    ? await query<ThreadRow>(
        `SELECT ${THREAD_COLS} FROM forum_threads t
         WHERE t.forum_id = ? AND t.is_pinned AND NOT t.is_deleted AND t.status = 'approved'
         ORDER BY t.last_post_at DESC`,
        [forumId],
      )
    : [];
  const threads = await query<ThreadRow>(
    `SELECT ${THREAD_COLS} FROM forum_threads t
     WHERE t.forum_id = ? AND NOT t.is_pinned AND NOT t.is_deleted AND t.status = 'approved'
     ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [forumId, size, (page - 1) * size],
  );
  const totals = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM forum_threads t
     WHERE t.forum_id = ? AND NOT t.is_pinned AND NOT t.is_deleted AND t.status = 'approved'`,
    [forumId],
  );

  return c.json({
    forum: {
      id: forumId, slug: f.slug, nameEn: f.name_en, nameZh: f.name_zh,
      descEn: f.desc_en, descZh: f.desc_zh, icon: f.icon, adminOnly: f.admin_only,
    },
    category: { slug: f.cat_slug, nameEn: f.cat_name_en, nameZh: f.cat_name_zh },
    pinned: pinned.map(threadJson),
    threads: threads.map(threadJson),
    total: totals[0].n, page, size,
  });
});

// ==================== GET /v1/forum/t/:id ====================
// 主题帖子分页。软删帖保留占位(postNo 稳定);authors 带头像/注册时间/发帖数;
// 带 Authorization 时附 myReactions(可选鉴权,失败静默当游客)。
forumRoutes.get('/forum/t/:id', async (c) => {
  noStore(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid thread id' }, 400);
  const page = posInt(c.req.query('page'), 1, 1, 100000);
  const size = posInt(c.req.query('size'), 20, 1, 100);

  // 鉴权前置:非公开主题(待审/驳回)只有作者与管理员可看;帖子掩码也要用 viewer
  const viewer = await authenticateUser(c.req.header('Authorization')).catch(() => null);
  const viewerIsAdmin = !!viewer && isAdmin(viewer);

  const threads = await query<ThreadRow & {
    forum_id: string; is_deleted: boolean; review_note: string | null;
    forum_slug: string; forum_name_en: string; forum_name_zh: string;
    cat_slug: string; cat_name_en: string; cat_name_zh: string;
  }>(
    `SELECT ${THREAD_COLS}, t.forum_id, t.is_deleted, t.review_note,
            f.slug AS forum_slug, f.name_en AS forum_name_en, f.name_zh AS forum_name_zh,
            c2.slug AS cat_slug, c2.name_en AS cat_name_en, c2.name_zh AS cat_name_zh
     FROM forum_threads t
     JOIN forum_forums f ON f.id = t.forum_id
     JOIN forum_categories c2 ON c2.id = f.category_id
     WHERE t.id = ?`,
    [id],
  );
  if (threads.length === 0 || threads[0].is_deleted) return c.json({ error: 'Thread not found' }, 404);
  const t = threads[0];
  if (t.status !== 'approved' && !viewerIsAdmin && viewer?.wcaId !== t.author_id) {
    // 对外不区分「不存在」与「待审核」,不泄露存在性
    return c.json({ error: 'Thread not found' }, 404);
  }

  const totals = await query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM forum_posts WHERE thread_id = ?', [id],
  );
  const total = totals[0].n;
  const offset = (page - 1) * size;

  const posts = await query<{
    id: string; author_id: string; author_name: string; content: string;
    created_at: Date; edited_at: Date | null; is_deleted: boolean;
    status: ReviewStatus; review_note: string | null;
  }>(
    `SELECT id, author_id, author_name, content, created_at, edited_at, is_deleted, status, review_note
     FROM forum_posts WHERE thread_id = ? ORDER BY id LIMIT ? OFFSET ?`,
    [id, size, offset],
  );

  const postIds = posts.map((p) => Number(p.id));
  const reactions = await reactionsFor(postIds);

  // authors 档案:发帖数 + app_users 的头像/注册时间(ownerKey 是 u<uid> 时按内部 id 匹配)
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const authors: Record<string, { name: string; avatarUrl: string | null; joinedAt: Date | null; postCount: number; wcaId: string | null; isAdmin: boolean }> = {};
  if (authorIds.length > 0) {
    const ph = authorIds.map(() => '?').join(',');
    const countRows = await query<{ author_id: string; n: number }>(
      `SELECT p.author_id, COUNT(*)::int AS n FROM forum_posts p
       JOIN forum_threads t2 ON t2.id = p.thread_id
       WHERE p.author_id IN (${ph}) AND NOT p.is_deleted AND NOT t2.is_deleted
         AND p.status = 'approved'
       GROUP BY p.author_id`,
      authorIds,
    );
    const postCounts = new Map(countRows.map((r) => [r.author_id, r.n]));

    const wcaKeys = authorIds.filter((a) => !/^u\d+$/.test(a));
    const uidKeys = authorIds.filter((a) => /^u\d+$/.test(a));
    const profile = new Map<string, { avatar_url: string | null; created_at: Date; display_name: string }>();
    if (wcaKeys.length > 0) {
      const rows = await query<{ wca_id: string; avatar_url: string | null; created_at: Date; display_name: string }>(
        `SELECT wca_id, avatar_url, created_at, display_name FROM app_users WHERE wca_id IN (${wcaKeys.map(() => '?').join(',')})`,
        wcaKeys,
      );
      for (const r of rows) profile.set(r.wca_id, r);
    }
    if (uidKeys.length > 0) {
      const rows = await query<{ id: string; avatar_url: string | null; created_at: Date; display_name: string }>(
        `SELECT id, avatar_url, created_at, display_name FROM app_users WHERE id IN (${uidKeys.map(() => '?').join(',')})`,
        uidKeys.map((a) => Number(a.slice(1))),
      );
      for (const r of rows) profile.set('u' + r.id, r);
    }
    for (const a of authorIds) {
      const p = profile.get(a);
      const lastName = posts.find((x) => x.author_id === a)?.author_name ?? '';
      authors[a] = {
        name: p?.display_name || lastName,
        avatarUrl: p?.avatar_url ?? null,
        joinedAt: p?.created_at ?? null,
        postCount: postCounts.get(a) ?? 0,
        wcaId: /^u\d+$/.test(a) ? null : a,
        isAdmin: ADMIN_WCA_IDS.includes(a),
      };
    }
  }

  // 可选鉴权(viewer 已在上面取):游客照常读,登录者多拿自己的反应
  const myReactions: Record<number, string> = {};
  if (viewer && postIds.length > 0) {
    const ph = postIds.map(() => '?').join(',');
    const rows = await query<{ post_id: string; kind: string }>(
      `SELECT post_id, kind FROM forum_reactions WHERE author_id = ? AND post_id IN (${ph})`,
      [viewer.wcaId, ...postIds],
    );
    for (const r of rows) myReactions[Number(r.post_id)] = r.kind;
  }

  return c.json({
    thread: { ...threadJson(t), forumId: Number(t.forum_id), reviewNote: t.review_note },
    forum: { slug: t.forum_slug, nameEn: t.forum_name_en, nameZh: t.forum_name_zh },
    category: { slug: t.cat_slug, nameEn: t.cat_name_en, nameZh: t.cat_name_zh },
    posts: posts.map((p, i) => {
      // 待审/驳回楼层只对本楼作者与管理员露内容,其他人只见占位(楼号不塌)
      const canSee = p.status === 'approved' || viewerIsAdmin || viewer?.wcaId === p.author_id;
      return {
        id: Number(p.id),
        authorId: p.author_id,
        authorName: p.author_name,
        content: p.is_deleted || !canSee ? '' : p.content,
        createdAt: p.created_at,
        editedAt: p.edited_at,
        isDeleted: p.is_deleted,
        status: p.status,
        reviewNote: canSee ? p.review_note : null,
        postNo: offset + i + 1,
        reactions: reactions.get(Number(p.id)) ?? [],
      };
    }),
    authors,
    myReactions,
    total, page, size,
  });
});

// ==================== POST /v1/forum/threads ====================
forumRoutes.post('/forum/threads', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const body = await c.req.json<{ forumSlug?: string; title?: string; content?: string }>();
  const title = (body.title ?? '').trim();
  const content = (body.content ?? '').trim();
  if (!body.forumSlug) return c.json({ error: 'forumSlug is required' }, 400);
  if (!title) return c.json({ error: 'title is required' }, 400);
  if (title.length > 200) return c.json({ error: 'title exceeds 200 characters' }, 400);
  if (!content) return c.json({ error: 'content is required' }, 400);
  if (content.length > MAX_CONTENT_LEN) return c.json({ error: `content exceeds ${MAX_CONTENT_LEN} characters` }, 400);

  const forums = await query<{ id: string; admin_only: boolean }>(
    'SELECT id, admin_only FROM forum_forums WHERE slug = ?', [body.forumSlug],
  );
  if (forums.length === 0) return c.json({ error: 'Forum not found' }, 404);
  if (forums[0].admin_only && !isAdmin(authUser)) {
    return c.json({ error: 'Only admins can post in this forum' }, 403);
  }

  const status = await statusFor(authUser, title + '\n' + content);
  // 单条语句 CTE:主题 + 首帖一起落库,中途崩不会留无首帖的空主题;status 主题/首帖同值
  const inserted = await query<{ thread_id: string }>(
    `WITH nt AS (
       INSERT INTO forum_threads (forum_id, title, author_id, author_name, last_post_author_id, last_post_author_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
     )
     INSERT INTO forum_posts (thread_id, author_id, author_name, content, status)
     SELECT id, ?, ?, ?, ? FROM nt RETURNING thread_id`,
    [Number(forums[0].id), title, authUser.wcaId, authUser.name, authUser.wcaId, authUser.name, status,
     authUser.wcaId, authUser.name, content, status],
  );
  const threadId = Number(inserted[0].thread_id);

  // 新主题 → 管理员。回帖不给管理员发(否则热帖会把收件箱淹了),回帖只找主题作者。
  // 待审核主题走 forum_review(链接直达审核队列)。
  await notifyBestEffort({
    recipients: adminRecipients(),
    kind: status === 'pending' ? 'forum_review' : 'forum_thread',
    actorKey: authUser.wcaId,
    actorName: authUser.name,
    title,
    excerpt: content,
    link: status === 'pending' ? '/forum/review' : `/forum/t/${threadId}`,
  });
  return c.json({ ok: true, id: threadId, status });
});

// ==================== POST /v1/forum/posts ====================
forumRoutes.post('/forum/posts', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const body = await c.req.json<{ threadId?: number; content?: string }>();
  const threadId = Number(body.threadId);
  if (!Number.isInteger(threadId) || threadId <= 0) return c.json({ error: 'threadId is required' }, 400);
  const content = (body.content ?? '').trim();
  if (!content) return c.json({ error: 'content is required' }, 400);
  if (content.length > MAX_CONTENT_LEN) return c.json({ error: `content exceeds ${MAX_CONTENT_LEN} characters` }, 400);

  const threads = await query<{ is_locked: boolean; is_deleted: boolean; title: string; author_id: string; status: ReviewStatus }>(
    'SELECT is_locked, is_deleted, title, author_id, status FROM forum_threads WHERE id = ?', [threadId],
  );
  if (threads.length === 0 || threads[0].is_deleted) return c.json({ error: 'Thread not found' }, 404);
  if (threads[0].is_locked && !isAdmin(authUser)) return c.json({ error: 'Thread is locked' }, 403);
  // 待审/驳回的主题不开放回帖(作者也不行——先等审核结果;管理员例外)
  if (threads[0].status !== 'approved' && !isAdmin(authUser)) {
    return c.json({ error: 'Thread is awaiting review' }, 403);
  }

  const status = await statusFor(authUser, content);
  // 单条语句 CTE:插帖 + 主题计数/末帖缓存一起更新;postNo 按自身 id 数楼层,并发下不错位。
  // 待审帖不动计数缓存(过审时再补),但仍占楼层号。
  const inserted = status === 'approved'
    ? await query<{ id: string }>(
        `WITH np AS (
           INSERT INTO forum_posts (thread_id, author_id, author_name, content)
           VALUES (?, ?, ?, ?) RETURNING id
         ), bump AS (
           UPDATE forum_threads SET reply_count = reply_count + 1, last_post_at = NOW(),
             last_post_author_id = ?, last_post_author_name = ? WHERE id = ?
         )
         SELECT id FROM np`,
        [threadId, authUser.wcaId, authUser.name, content, authUser.wcaId, authUser.name, threadId],
      )
    : await query<{ id: string }>(
        `INSERT INTO forum_posts (thread_id, author_id, author_name, content, status)
         VALUES (?, ?, ?, ?, 'pending') RETURNING id`,
        [threadId, authUser.wcaId, authUser.name, content],
      );
  const newId = Number(inserted[0].id);
  const nos = await query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM forum_posts WHERE thread_id = ? AND id <= ?', [threadId, newId],
  );

  // 已发布回帖 → 主题作者(notify 内部会剔除 actor 自己:自己回自己的帖不通知)。
  // 待审回帖 → 管理员;过审时才通知主题作者(见 /forum/review 审核端点)。
  await notifyBestEffort(status === 'pending'
    ? {
        recipients: adminRecipients(),
        kind: 'forum_review',
        actorKey: authUser.wcaId,
        actorName: authUser.name,
        title: threads[0].title,
        excerpt: content,
        link: '/forum/review',
      }
    : {
        recipients: [threads[0].author_id],
        kind: 'forum_reply',
        actorKey: authUser.wcaId,
        actorName: authUser.name,
        title: threads[0].title,
        excerpt: content,
        link: `/forum/t/${threadId}`,
      });
  return c.json({ ok: true, id: newId, postNo: nos[0].n, status });
});

// ==================== PATCH /v1/forum/posts/:id ====================
forumRoutes.patch('/forum/posts/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid post id' }, 400);
  const body = await c.req.json<{ content?: string }>();
  const content = (body.content ?? '').trim();
  if (!content) return c.json({ error: 'content is required' }, 400);
  if (content.length > MAX_CONTENT_LEN) return c.json({ error: `content exceeds ${MAX_CONTENT_LEN} characters` }, 400);

  const posts = await query<{ author_id: string; is_deleted: boolean; is_locked: boolean; thread_deleted: boolean }>(
    `SELECT p.author_id, p.is_deleted, t.is_locked, t.is_deleted AS thread_deleted
     FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id WHERE p.id = ?`,
    [id],
  );
  if (posts.length === 0 || posts[0].is_deleted || posts[0].thread_deleted) {
    return c.json({ error: 'Post not found' }, 404);
  }
  if (!isAdmin(authUser)) {
    if (posts[0].author_id !== authUser.wcaId) return c.json({ error: 'Cannot edit others post' }, 403);
    if (posts[0].is_locked) return c.json({ error: 'Thread is locked' }, 403);
  }
  await query('UPDATE forum_posts SET content = ?, edited_at = NOW() WHERE id = ?', [content, id]);
  return c.json({ ok: true });
});

// ==================== DELETE /v1/forum/posts/:id ====================
// 软删除;首帖禁单删(删主题走 DELETE /forum/threads/:id);删后重算主题末帖缓存。
forumRoutes.delete('/forum/posts/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid post id' }, 400);

  const posts = await query<{ author_id: string; is_deleted: boolean; thread_id: string; is_locked: boolean; thread_deleted: boolean }>(
    `SELECT p.author_id, p.is_deleted, p.thread_id, t.is_locked, t.is_deleted AS thread_deleted
     FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id WHERE p.id = ?`,
    [id],
  );
  if (posts.length === 0 || posts[0].is_deleted || posts[0].thread_deleted) {
    return c.json({ error: 'Post not found' }, 404);
  }
  if (!isAdmin(authUser)) {
    if (posts[0].author_id !== authUser.wcaId) return c.json({ error: 'Cannot delete others post' }, 403);
    if (posts[0].is_locked) return c.json({ error: 'Thread is locked' }, 403);
  }
  const threadId = Number(posts[0].thread_id);
  const first = await query<{ min: string }>(
    'SELECT MIN(id) AS min FROM forum_posts WHERE thread_id = ?', [threadId],
  );
  if (Number(first[0].min) === id) return c.json({ error: 'Delete the thread instead' }, 400);

  // 条件删除防双删竞态:两个并发 DELETE 只有一个真正翻位,第二个 404
  const flipped = await query<{ thread_id: string }>(
    'UPDATE forum_posts SET is_deleted = TRUE WHERE id = ? AND NOT is_deleted RETURNING thread_id', [id],
  );
  if (flipped.length === 0) return c.json({ error: 'Post not found' }, 404);
  // 单条语句重算 reply_count + 末帖缓存(被删的可能正是末帖;首帖不可删,可见帖 ≥1)。
  // 计数/末帖只认已过审帖——待审帖从未进过缓存,删它不该动缓存。
  await query(
    `UPDATE forum_threads t
     SET reply_count = GREATEST(s.cnt - 1, 0),
         last_post_at = lp.created_at,
         last_post_author_id = lp.author_id,
         last_post_author_name = lp.author_name
     FROM (SELECT COUNT(*)::int AS cnt FROM forum_posts
           WHERE thread_id = ? AND NOT is_deleted AND status = 'approved') s,
          (SELECT created_at, author_id, author_name FROM forum_posts
           WHERE thread_id = ? AND NOT is_deleted AND status = 'approved' ORDER BY id DESC LIMIT 1) lp
     WHERE t.id = ?`,
    [threadId, threadId, threadId],
  );
  return c.json({ ok: true });
});

// ==================== DELETE /v1/forum/threads/:id ====================
forumRoutes.delete('/forum/threads/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid thread id' }, 400);

  const threads = await query<{ author_id: string; is_deleted: boolean; is_locked: boolean }>(
    'SELECT author_id, is_deleted, is_locked FROM forum_threads WHERE id = ?', [id],
  );
  if (threads.length === 0 || threads[0].is_deleted) return c.json({ error: 'Thread not found' }, 404);
  if (!isAdmin(authUser)) {
    if (threads[0].author_id !== authUser.wcaId) return c.json({ error: 'Cannot delete others thread' }, 403);
    if (threads[0].is_locked) return c.json({ error: 'Thread is locked' }, 403);
  }
  await query('UPDATE forum_threads SET is_deleted = TRUE WHERE id = ? AND NOT is_deleted', [id]);
  return c.json({ ok: true });
});

// ==================== PATCH /v1/forum/threads/:id ====================
// title:作者或管理员;isPinned / isLocked:仅管理员。
forumRoutes.patch('/forum/threads/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid thread id' }, 400);
  const body = await c.req.json<{ title?: string; isPinned?: boolean; isLocked?: boolean }>();

  const threads = await query<{ author_id: string; is_deleted: boolean; is_locked: boolean }>(
    'SELECT author_id, is_deleted, is_locked FROM forum_threads WHERE id = ?', [id],
  );
  if (threads.length === 0 || threads[0].is_deleted) return c.json({ error: 'Thread not found' }, 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return c.json({ error: 'title is required' }, 400);
    if (title.length > 200) return c.json({ error: 'title exceeds 200 characters' }, 400);
    if (!isAdmin(authUser)) {
      if (threads[0].author_id !== authUser.wcaId) return c.json({ error: 'Cannot edit others thread' }, 403);
      if (threads[0].is_locked) return c.json({ error: 'Thread is locked' }, 403);
    }
    sets.push('title = ?');
    params.push(title);
  }
  if (body.isPinned !== undefined || body.isLocked !== undefined) {
    if (!isAdmin(authUser)) return c.json({ error: 'Admin access required for pin/lock' }, 403);
    if (body.isPinned !== undefined) { sets.push('is_pinned = ?'); params.push(Boolean(body.isPinned)); }
    if (body.isLocked !== undefined) { sets.push('is_locked = ?'); params.push(Boolean(body.isLocked)); }
  }
  if (sets.length === 0) return c.json({ error: 'No valid fields to update' }, 400);
  params.push(id);
  await query(`UPDATE forum_threads SET ${sets.join(', ')} WHERE id = ?`, params);
  return c.json({ ok: true });
});

// ==================== POST /v1/forum/posts/:id/react ====================
// kind = null 或与现有相同 → 取消;否则 upsert 换 kind。返回该帖最新反应聚合。
forumRoutes.post('/forum/posts/:id/react', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid post id' }, 400);
  const body = await c.req.json<{ kind?: string | null }>();
  const kind = body.kind ?? null;
  if (kind !== null && !REACTION_KINDS.includes(kind)) return c.json({ error: 'Invalid reaction kind' }, 400);

  const posts = await query<{ is_deleted: boolean; thread_deleted: boolean; status: ReviewStatus }>(
    `SELECT p.is_deleted, t.is_deleted AS thread_deleted, p.status
     FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id WHERE p.id = ?`,
    [id],
  );
  if (posts.length === 0 || posts[0].is_deleted || posts[0].thread_deleted || posts[0].status !== 'approved') {
    return c.json({ error: 'Post not found' }, 404);
  }

  const existing = await query<{ kind: string }>(
    'SELECT kind FROM forum_reactions WHERE post_id = ? AND author_id = ?', [id, authUser.wcaId],
  );
  if (kind === null || (existing.length > 0 && existing[0].kind === kind)) {
    await query('DELETE FROM forum_reactions WHERE post_id = ? AND author_id = ?', [id, authUser.wcaId]);
  } else {
    await query(
      `INSERT INTO forum_reactions (post_id, author_id, author_name, kind) VALUES (?, ?, ?, ?)
       ON CONFLICT (post_id, author_id) DO UPDATE SET kind = EXCLUDED.kind, author_name = EXCLUDED.author_name, created_at = NOW()`,
      [id, authUser.wcaId, authUser.name, kind],
    );
  }
  const reactions = await reactionsFor([id]);
  return c.json({ ok: true, reactions: reactions.get(id) ?? [] });
});

// ==================== POST /v1/forum/t/:id/view ====================
// 浏览计数:客户端每次进入主题页触发一次;无鉴权,走独立读桶(不占写配额)。
forumRoutes.post('/forum/t/:id/view', async (c) => {
  noStore(c);
  if (!checkReadRate(getIp(c))) return c.json({ error: 'Too many requests' }, 429);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid thread id' }, 400);
  await query('UPDATE forum_threads SET view_count = view_count + 1 WHERE id = ? AND NOT is_deleted', [id]);
  return c.json({ ok: true });
});

// ==================== GET /v1/forum/latest ====================
// 全版最新活跃主题(首页「最新回复」块)。
forumRoutes.get('/forum/latest', async (c) => {
  noStore(c);
  const limit = posInt(c.req.query('limit'), 15, 1, 50);
  const rows = await query<ThreadRow>(
    `SELECT ${THREAD_COLS}, f.slug AS forum_slug, f.name_en AS forum_name_en, f.name_zh AS forum_name_zh
     FROM forum_threads t JOIN forum_forums f ON f.id = t.forum_id
     WHERE NOT t.is_deleted AND t.status = 'approved'
     ORDER BY t.last_post_at DESC LIMIT ?`,
    [limit],
  );
  return c.json({
    threads: rows.map((r) => ({
      ...threadJson(r), forumSlug: r.forum_slug, forumNameEn: r.forum_name_en, forumNameZh: r.forum_name_zh,
    })),
  });
});

// ==================== GET /v1/forum/search ====================
// 标题 + 帖子正文 ILIKE;命中正文时带 ~120 字符摘录。
forumRoutes.get('/forum/search', async (c) => {
  noStore(c);
  if (!checkReadRate(getIp(c))) return c.json({ error: 'Too many requests' }, 429);
  const q = (c.req.query('q') ?? '').trim();
  const page = posInt(c.req.query('page'), 1, 1, 100000);
  const size = posInt(c.req.query('size'), 25, 1, 100);
  if (q.length < 2) return c.json({ threads: [], total: 0, page, size });
  const pattern = '%' + escapeLike(q) + '%';

  const where = `NOT t.is_deleted AND t.status = 'approved' AND (t.title ILIKE ? ESCAPE '\\' OR EXISTS (
    SELECT 1 FROM forum_posts p WHERE p.thread_id = t.id AND NOT p.is_deleted AND p.status = 'approved'
      AND p.content ILIKE ? ESCAPE '\\'))`;
  const rows = await query<ThreadRow>(
    `SELECT ${THREAD_COLS}, f.slug AS forum_slug, f.name_en AS forum_name_en, f.name_zh AS forum_name_zh,
            sp.content AS snippet_content
     FROM forum_threads t
     JOIN forum_forums f ON f.id = t.forum_id
     LEFT JOIN LATERAL (
       SELECT p.content FROM forum_posts p
       WHERE p.thread_id = t.id AND NOT p.is_deleted AND p.status = 'approved'
         AND p.content ILIKE ? ESCAPE '\\'
       ORDER BY p.id LIMIT 1
     ) sp ON TRUE
     WHERE ${where}
     ORDER BY t.last_post_at DESC LIMIT ? OFFSET ?`,
    [pattern, pattern, pattern, size, (page - 1) * size],
  );
  const totals = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM forum_threads t WHERE ${where}`,
    [pattern, pattern],
  );

  const lowered = q.toLowerCase();
  return c.json({
    threads: rows.map((r) => {
      let snippet: string | null = null;
      const content = r.snippet_content;
      if (content) {
        const at = content.toLowerCase().indexOf(lowered);
        const start = Math.max(0, (at < 0 ? 0 : at) - 40);
        const slice = content.slice(start, start + 120);
        snippet = (start > 0 ? '…' : '') + slice + (start + 120 < content.length ? '…' : '');
      }
      return {
        ...threadJson(r), forumSlug: r.forum_slug, forumNameEn: r.forum_name_en, forumNameZh: r.forum_name_zh,
        snippet,
      };
    }),
    total: totals[0].n, page, size,
  });
});

// ==================== POST /v1/forum/posts/:id/report ====================
// 举报帖子:登录用户;一人一帖一条,重复举报更新理由并重新置为待处理;不可举报自己。
forumRoutes.post('/forum/posts/:id/report', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid post id' }, 400);
  const body = await c.req.json<{ reason?: string }>();
  const reason = (body.reason ?? '').trim();
  if (!reason) return c.json({ error: 'reason is required' }, 400);
  if (reason.length > 500) return c.json({ error: 'reason exceeds 500 characters' }, 400);

  const posts = await query<{
    author_id: string; is_deleted: boolean; thread_deleted: boolean; status: ReviewStatus;
    thread_id: string; thread_title: string;
  }>(
    `SELECT p.author_id, p.is_deleted, t.is_deleted AS thread_deleted, p.status,
            t.id AS thread_id, t.title AS thread_title
     FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id WHERE p.id = ?`,
    [id],
  );
  // 非公开楼层(待审/驳回)对举报者本就不可见,不受理
  if (posts.length === 0 || posts[0].is_deleted || posts[0].thread_deleted || posts[0].status !== 'approved') {
    return c.json({ error: 'Post not found' }, 404);
  }
  if (posts[0].author_id === authUser.wcaId) return c.json({ error: 'Cannot report your own post' }, 400);

  await query(
    `INSERT INTO forum_reports (post_id, reporter_id, reporter_name, reason) VALUES (?, ?, ?, ?)
     ON CONFLICT (post_id, reporter_id)
     DO UPDATE SET reason = EXCLUDED.reason, created_at = NOW(), resolved_at = NULL`,
    [id, authUser.wcaId, authUser.name, reason],
  );

  // 举报 → 管理员。没人盯的举报等于没举报,所以这条必须推,不能只躺在 /forum/reports 列表里。
  await notifyBestEffort({
    recipients: adminRecipients(),
    kind: 'forum_report',
    actorKey: authUser.wcaId,
    actorName: authUser.name,
    title: posts[0].thread_title,
    excerpt: reason,
    link: `/forum/t/${Number(posts[0].thread_id)}`,
  });
  return c.json({ ok: true });
});

// ==================== GET /v1/forum/reports ====================
// 管理员:举报列表,默认只看待处理,?all=1 含已处理。
forumRoutes.get('/forum/reports', async (c) => {
  noStore(c);
  const authUser = await requireAuth(c);
  if (!isAdmin(authUser)) return c.json({ error: 'Admin access required' }, 403);
  const all = c.req.query('all') === '1';
  const rows = await query<{
    id: string; post_id: string; reporter_id: string; reporter_name: string; reason: string;
    created_at: Date; resolved_at: Date | null;
    thread_id: string; thread_title: string; post_author_name: string; content: string;
  }>(
    `SELECT r.id, r.post_id, r.reporter_id, r.reporter_name, r.reason, r.created_at, r.resolved_at,
            p.thread_id, t.title AS thread_title, p.author_name AS post_author_name, p.content
     FROM forum_reports r
     JOIN forum_posts p ON p.id = r.post_id
     JOIN forum_threads t ON t.id = p.thread_id
     ${all ? '' : 'WHERE r.resolved_at IS NULL'}
     ORDER BY r.created_at DESC LIMIT 200`,
  );
  return c.json({
    reports: rows.map((r) => ({
      id: Number(r.id), postId: Number(r.post_id), threadId: Number(r.thread_id),
      threadTitle: r.thread_title, postAuthorName: r.post_author_name,
      excerpt: r.content.slice(0, 200),
      reporterId: r.reporter_id, reporterName: r.reporter_name, reason: r.reason,
      createdAt: r.created_at, resolvedAt: r.resolved_at,
    })),
  });
});

// ==================== POST /v1/forum/reports/:id/resolve ====================
forumRoutes.post('/forum/reports/:id/resolve', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  if (!isAdmin(authUser)) return c.json({ error: 'Admin access required' }, 403);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid report id' }, 400);
  await query('UPDATE forum_reports SET resolved_at = NOW() WHERE id = ?', [id]);
  return c.json({ ok: true });
});

// ==================== GET /v1/forum/review ====================
// 管理员:待审核队列(待审主题 + 待审回帖混排,先来先审)。
forumRoutes.get('/forum/review', async (c) => {
  noStore(c);
  const authUser = await requireAuth(c);
  if (!isAdmin(authUser)) return c.json({ error: 'Admin access required' }, 403);

  const threads = await query<{
    id: string; title: string; author_id: string; author_name: string; created_at: Date;
    content: string; forum_name_en: string; forum_name_zh: string;
  }>(
    `SELECT t.id, t.title, t.author_id, t.author_name, t.created_at, p.content,
            f.name_en AS forum_name_en, f.name_zh AS forum_name_zh
     FROM forum_threads t
     JOIN forum_forums f ON f.id = t.forum_id
     JOIN LATERAL (SELECT content FROM forum_posts WHERE thread_id = t.id ORDER BY id LIMIT 1) p ON TRUE
     WHERE t.status = 'pending' AND NOT t.is_deleted
     ORDER BY t.created_at LIMIT 100`,
  );
  // 待审回帖只列「所在主题已公开」的——待审主题下不开放回帖,驳回/删除的主题连带失效
  const posts = await query<{
    id: string; thread_id: string; thread_title: string;
    author_id: string; author_name: string; created_at: Date; content: string;
  }>(
    `SELECT p.id, p.thread_id, t.title AS thread_title,
            p.author_id, p.author_name, p.created_at, p.content
     FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id
     WHERE p.status = 'pending' AND NOT p.is_deleted
       AND t.status = 'approved' AND NOT t.is_deleted
     ORDER BY p.created_at LIMIT 100`,
  );

  const items = [
    ...threads.map((r) => ({
      type: 'thread' as const, id: Number(r.id), threadId: Number(r.id),
      threadTitle: r.title, forumNameEn: r.forum_name_en, forumNameZh: r.forum_name_zh,
      authorId: r.author_id, authorName: r.author_name, content: r.content, createdAt: r.created_at,
    })),
    ...posts.map((r) => ({
      type: 'post' as const, id: Number(r.id), threadId: Number(r.thread_id),
      threadTitle: r.thread_title, forumNameEn: null, forumNameZh: null,
      authorId: r.author_id, authorName: r.author_name, content: r.content, createdAt: r.created_at,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return c.json({ items });
});

// ==================== POST /v1/forum/review/:type/:id/:action ====================
// 管理员审核:type = thread|post,action = approve|reject(reject 可带 reason,回执给作者)。
// 条件 UPDATE 只翻 pending 行:双击/两窗并发只有一次生效,第二次 404。
forumRoutes.post('/forum/review/:type/:id/:action', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  if (!isAdmin(authUser)) return c.json({ error: 'Admin access required' }, 403);
  const type = c.req.param('type');
  const action = c.req.param('action');
  const id = Number(c.req.param('id'));
  if (type !== 'thread' && type !== 'post') return c.json({ error: 'Invalid review type' }, 400);
  if (action !== 'approve' && action !== 'reject') return c.json({ error: 'Invalid review action' }, 400);
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid id' }, 400);
  const body = action === 'reject'
    ? await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }))
    : {};
  const reason = (body.reason ?? '').trim().slice(0, 500);
  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  if (type === 'thread') {
    const flipped = await query<{ author_id: string; title: string }>(
      `UPDATE forum_threads SET status = ?, review_note = ?
       WHERE id = ? AND status = 'pending' AND NOT is_deleted RETURNING author_id, title`,
      [newStatus, action === 'reject' ? reason || null : null, id],
    );
    if (flipped.length === 0) return c.json({ error: 'Not pending' }, 404);
    // 首帖随主题同批过审/驳回(待审主题不开放回帖,故 pending 帖只有首帖)
    await query(
      `UPDATE forum_posts SET status = ? WHERE thread_id = ? AND status = 'pending'`,
      [newStatus, id],
    );
    await notifyBestEffort({
      recipients: [flipped[0].author_id],
      kind: action === 'approve' ? 'forum_approved' : 'forum_rejected',
      actorKey: authUser.wcaId,
      actorName: authUser.name,
      title: flipped[0].title,
      excerpt: action === 'reject' && reason ? reason : flipped[0].title,
      link: `/forum/t/${id}`,
    });
    return c.json({ ok: true });
  }

  // type === 'post'
  const flipped = await query<{ thread_id: string; author_id: string; content: string }>(
    `UPDATE forum_posts SET status = ?, review_note = ?
     WHERE id = ? AND status = 'pending' AND NOT is_deleted RETURNING thread_id, author_id, content`,
    [newStatus, action === 'reject' ? reason || null : null, id],
  );
  if (flipped.length === 0) return c.json({ error: 'Not pending' }, 404);
  const threadId = Number(flipped[0].thread_id);
  const threads = await query<{ title: string; author_id: string }>(
    'SELECT title, author_id FROM forum_threads WHERE id = ?', [threadId],
  );

  if (action === 'approve') {
    // 过审即「发布」:补记 reply_count / 末帖缓存(发帖时待审没记)。
    // 末帖取最新已过审帖——积压队列乱序过审也不会把旧帖顶成末帖。
    await query(
      `UPDATE forum_threads t
       SET reply_count = GREATEST(s.cnt - 1, 0),
           last_post_at = lp.created_at,
           last_post_author_id = lp.author_id,
           last_post_author_name = lp.author_name
       FROM (SELECT COUNT(*)::int AS cnt FROM forum_posts
             WHERE thread_id = ? AND NOT is_deleted AND status = 'approved') s,
            (SELECT created_at, author_id, author_name FROM forum_posts
             WHERE thread_id = ? AND NOT is_deleted AND status = 'approved' ORDER BY id DESC LIMIT 1) lp
       WHERE t.id = ?`,
      [threadId, threadId, threadId],
    );
    // 补发原本在发帖时压下的「回复了你的主题」(actor 是发帖人,不是管理员)
    const posts2 = await query<{ author_name: string }>(
      'SELECT author_name FROM forum_posts WHERE id = ?', [id],
    );
    await notifyBestEffort({
      recipients: [threads[0]?.author_id],
      kind: 'forum_reply',
      actorKey: flipped[0].author_id,
      actorName: posts2[0]?.author_name ?? '',
      title: threads[0]?.title ?? '',
      excerpt: flipped[0].content,
      link: `/forum/t/${threadId}`,
    });
  }
  await notifyBestEffort({
    recipients: [flipped[0].author_id],
    kind: action === 'approve' ? 'forum_approved' : 'forum_rejected',
    actorKey: authUser.wcaId,
    actorName: authUser.name,
    title: threads[0]?.title ?? '',
    excerpt: action === 'reject' && reason ? reason : flipped[0].content,
    link: `/forum/t/${threadId}`,
  });
  return c.json({ ok: true });
});
