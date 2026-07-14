/**
 * 站内通知 —— 当前登录用户收件箱。
 * 写入侧在 utils/notify.ts(由 recon 评论/另解、论坛主题/回帖/举报触发),这里只读 + 标已读。
 * 收件人键 = ownerKey(requireAuth 的 user.wcaId)。
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAuth } from '../utils/recon_helpers.js';
import { rememberLang, verifyUnsubToken } from '../utils/notify.js';

export const notificationRoutes = new Hono();

/** ownerKey(真 wca_id 或 `u<uid>`)→ app_users.id。查不到返回 null。 */
async function userIdForOwnerKey(key: string): Promise<number | null> {
  const rows = await query<{ id: number }>(
    `SELECT id FROM app_users WHERE wca_id = ? OR ('u' || id::text) = ? LIMIT 1`,
    [key, key],
  );
  return rows[0]?.id != null ? Number(rows[0].id) : null;
}

/** 关掉某人的邮件通知。幂等:重复退订不报错。返回是否命中账号。 */
async function disableEmailNotify(ownerKey: string): Promise<boolean> {
  const id = await userIdForOwnerKey(ownerKey);
  if (id == null) return false;
  await query('UPDATE app_users SET email_notify = FALSE WHERE id = ?', [id]);
  return true;
}

/** 退订结果页(免登录,邮件里点进来的人不一定还有会话)。双语 + 跟随系统深浅色。 */
function unsubPage(ok: boolean): string {
  const title = ok ? '已退订' : '链接无效';
  const zh = ok
    ? '你不会再收到站内消息的邮件通知了(复盘评论 / 另解、论坛回复)。站内消息(红点)不受影响。'
    : '这个退订链接无效或已失效。';
  const en = ok
    ? 'You will no longer receive email notifications (recon comments and alternatives, forum replies). In-site notifications are unaffected.'
    : 'This unsubscribe link is invalid or expired.';
  const back = ok
    ? `<p style="margin:20px 0 0"><a href="https://cuberoot.me/notifications" style="color:#0b7;font-size:14px">想改回来?在「消息」页重新打开 / Re-enable in Notifications</a></p>`
    : '';
  return `<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — cuberoot.me</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; background:#faf9f5; color:#181716; }
  main { max-width:460px; padding:32px 24px; }
  h1 { font-size:20px; margin:0 0 12px; }
  p { margin:0 0 8px; font-size:14px; line-height:1.6; }
  .en { color:#888; }
  @media (prefers-color-scheme: dark) { body { background:#1c1917; color:#f0ebe3; } .en { color:#999; } }
</style></head>
<body><main>
  <h1>${title}</h1>
  <p>${zh}</p>
  <p class="en">${en}</p>
  ${back}
</main></body></html>`;
}

// GET /v1/notifications/unsubscribe?t=… — 邮件里点进来的退订(免登录,签名令牌)
notificationRoutes.get('/notifications/unsubscribe', async (c) => {
  c.header('Cache-Control', 'no-store');
  const key = verifyUnsubToken(c.req.query('t') ?? '');
  const ok = key ? await disableEmailNotify(key) : false;
  return c.html(unsubPage(ok), ok ? 200 : 400);
});

// POST /v1/notifications/unsubscribe?t=… — 邮件客户端一键退订(RFC 8058,无正文交互)
notificationRoutes.post('/notifications/unsubscribe', async (c) => {
  c.header('Cache-Control', 'no-store');
  const key = verifyUnsubToken(c.req.query('t') ?? '');
  if (!key) return c.json({ error: 'Invalid token' }, 400);
  await disableEmailNotify(key);
  return c.json({ ok: true });
});

// GET /v1/notifications/prefs — 当前用户的通知偏好
notificationRoutes.get('/notifications/prefs', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const id = await userIdForOwnerKey(user.wcaId);
  if (id == null) return c.json({ emailNotify: false });
  const rows = await query<{ email_notify: boolean }>(
    'SELECT email_notify FROM app_users WHERE id = ?', [id],
  );
  return c.json({ emailNotify: rows[0]?.email_notify ?? true });
});

// PUT /v1/notifications/prefs — 开 / 关邮件通知
notificationRoutes.put('/notifications/prefs', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const body = await c.req.json<{ emailNotify?: boolean }>().catch(() => ({} as { emailNotify?: boolean }));
  if (typeof body.emailNotify !== 'boolean') {
    return c.json({ error: 'emailNotify (boolean) is required' }, 400);
  }
  const id = await userIdForOwnerKey(user.wcaId);
  if (id == null) return c.json({ error: 'Account not found' }, 404);
  await query('UPDATE app_users SET email_notify = ? WHERE id = ?', [body.emailNotify, id]);
  return c.json({ ok: true, emailNotify: body.emailNotify });
});

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

// GET /v1/notifications/unread?lang=zh|en — 未读数(给红点角标)
//
// ?lang 顺带记住这人的站点语言(通知邮件按收件人语言发)。搭这个端点的车,是因为它是唯一
// 「每个登录用户都会周期性打」的已认证请求 —— 收件人的语言只有他自己在场时才能知道,
// 发通知的那一刻在场的是 actor。rememberLang 内部 memo + 幂等,轮询频繁也不会写放大。
notificationRoutes.get('/notifications/unread', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  rememberLang(user.wcaId, c.req.query('lang'));
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
