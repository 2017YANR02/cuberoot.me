import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { getIp } from '../utils/analytics_helpers.js';

export const siteAssistantSharesRoutes = new Hono();
const snapshot = z.object({ requestId: z.string().uuid(), question: z.string().max(8000), answer: z.string().min(1).max(120000) }).strict();
const validId = (id: string) => /^[A-Za-z0-9_-]{24}$/.test(id);
siteAssistantSharesRoutes.use('/site-assistant/shares*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex, nofollow');
  await next();
});
siteAssistantSharesRoutes.post('/site-assistant/shares', bodyLimit({ maxSize: 512 * 1024 }), async c => {
  const user = await requireAuth(c);
  if (!user.uid) return c.json({ error: 'Authentication required' }, 401);
  checkRateLimit(getIp(c));
  const parsed = snapshot.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid message' }, 400);
  const { requestId, question, answer } = parsed.data;
  // Never permit sharing another account's request or exposing its private log.
  const owned = await query('SELECT id FROM site_assistant_requests WHERE id = ? AND user_id = ?', [requestId, user.uid]);
  if (!owned.length) return c.json({ error: 'Not found' }, 404);
  const rows = await query<{ id: string }>(`INSERT INTO site_assistant_shares (id, user_id, request_id, question, answer)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, request_id) DO UPDATE SET id = site_assistant_shares.id RETURNING id`,
    [randomBytes(18).toString('base64url'), user.uid, requestId, question, answer]);
  return c.json({ id: rows[0].id });
});
siteAssistantSharesRoutes.get('/site-assistant/shares/:id', async c => {
  const id = c.req.param('id');
  if (!validId(id)) return c.json({ error: 'Not found' }, 404);
  const rows = await query<{ question: string; answer: string }>('SELECT question, answer FROM site_assistant_shares WHERE id = ?', [id]);
  if (!rows.length) return c.json({ error: 'Not found' }, 404);
  return c.json({ question: rows[0].question, answer: rows[0].answer });
});
siteAssistantSharesRoutes.delete('/site-assistant/shares/:id', async c => {
  const user = await requireAuth(c);
  if (!user.uid) return c.json({ error: 'Authentication required' }, 401);
  const id = c.req.param('id');
  if (!validId(id)) return c.json({ error: 'Not found' }, 404);
  await query('DELETE FROM site_assistant_shares WHERE id = ? AND user_id = ?', [id, user.uid]);
  return c.json({ ok: true });
});
