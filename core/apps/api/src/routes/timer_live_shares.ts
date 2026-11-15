import { createHash, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit } from '../utils/rate_limit.js';
import { isTimerLiveId, isTimerLiveToken, TIMER_LIVE_TTL_MS } from '@cuberoot/shared/timer/live-share';
import { TimerLiveRelay } from '../timer_live_relay.js';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const timerLiveRelay = new TimerLiveRelay(async (id, token, role) => {
  const rows = await query<{ expires_at: string | number }>(
    `SELECT expires_at FROM timer_live_shares WHERE id = ? AND ${role === 'host' ? 'host_hash' : 'viewer_hash'} = ? AND revoked = FALSE AND expires_at > ?`,
    [id, hash(token), Date.now()]);
  return rows[0] ? { expiresAt: Number(rows[0].expires_at) } : null;
});
export const timerLiveSharesRoutes = new Hono();
timerLiveSharesRoutes.use('/timer/live-shares*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
timerLiveSharesRoutes.post('/timer/live-shares', async c => {
  checkRateLimit(getIp(c), { bucket: 'timer-live-create', max: 60 });
  const id = randomBytes(16).toString('base64url'), token = randomBytes(32).toString('base64url');
  const viewerToken = randomBytes(32).toString('base64url'), expiresAt = Date.now() + TIMER_LIVE_TTL_MS;
  await query('INSERT INTO timer_live_shares (id, host_hash, viewer_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    [id, hash(token), hash(viewerToken), Date.now(), expiresAt]);
  return c.json({ id, token, viewerToken, expiresAt }, 201);
});
timerLiveSharesRoutes.delete('/timer/live-shares/:id', async c => {
  const id = c.req.param('id'), token = c.req.header('Authorization')?.replace(/^Bearer /, '');
  if (!isTimerLiveId(id) || !isTimerLiveToken(token)) return c.json({ error: 'Invalid credential' }, 401);
  const rows = await query<{ id: string }>('UPDATE timer_live_shares SET revoked = TRUE WHERE id = ? AND host_hash = ? RETURNING id', [id, hash(token)]);
  if (!rows.length) return c.json({ error: 'Not found' }, 404);
  timerLiveRelay.revoke(id);
  return c.json({ ok: true });
});
const sweep = setInterval(() => timerLiveRelay.sweep(), 2000); sweep.unref();
const cleanup = setInterval(() => { void query('DELETE FROM timer_live_shares WHERE expires_at < ?', [Date.now()]).catch(() => {}); }, 60 * 60_000);
cleanup.unref();
