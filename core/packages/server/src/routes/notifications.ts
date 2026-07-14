/**
 * 站内通知 —— 当前登录用户收件箱。
 * 写入侧在 utils/notify.ts(由 recon 评论/另解触发),这里只读 + 标已读。
 * 收件人键 = ownerKey(requireAuth 的 user.wcaId)。
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAuth } from '../utils/recon_helpers.js';

export const notificationRoutes = new Hono();

interface NotificationRow {
  id: number;
  kind: string;
  actor_key: string;
  actor_name: string;
  title: string;
  excerpt: string;
  link: string;
  created_at: string;
  read_at: string | null;
}

// GET /v1/notifications — 最近通知(默认 30 条)
notificationRoutes.get('/notifications', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 30)));
  const rows = await query<NotificationRow>(
    `SELECT id, kind, actor_key, actor_name, title, excerpt, link, created_at, read_at
       FROM notifications WHERE user_key = ? ORDER BY created_at DESC LIMIT ?`,
    [user.wcaId, limit],
  );
  return c.json(rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    actorKey: r.actor_key,
    actorName: r.actor_name,
    title: r.title,
    excerpt: r.excerpt,
    link: r.link,
    createdAt: r.created_at,
    read: r.read_at != null,
  })));
});

// GET /v1/notifications/unread — 未读数(给红点角标)
notificationRoutes.get('/notifications/unread', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const rows = await query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_key = ? AND read_at IS NULL',
    [user.wcaId],
  );
  return c.json({ count: Number(rows[0]?.count ?? 0) });
});

// POST /v1/notifications/read — 标记已读。body 省略 = 全部已读;{ ids: [...] } = 只标这些
notificationRoutes.post('/notifications/read', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const body = await c.req.json<{ ids?: number[] }>().catch(() => ({} as { ids?: number[] }));
  const ids = (body.ids ?? []).filter((n) => Number.isInteger(n));

  if (ids.length > 0) {
    // ids 已过滤为整数,占位符按个数展开(query() 只做 ? → $N,不接 JS 数组当 PG array)
    const holes = ids.map(() => '?').join(',');
    await query(
      `UPDATE notifications SET read_at = NOW()
        WHERE user_key = ? AND read_at IS NULL AND id IN (${holes})`,
      [user.wcaId, ...ids],
    );
  } else {
    await query(
      'UPDATE notifications SET read_at = NOW() WHERE user_key = ? AND read_at IS NULL',
      [user.wcaId],
    );
  }
  return c.json({ ok: true });
});
