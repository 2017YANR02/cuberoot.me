import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { normalizeRemoteKey, type RemoteAccessRequest } from '@cuberoot/shared/remote-access';
import { query, withTransaction, type QueryRunner } from '../db/connection.js';
import { requireAuth, checkRateLimit, type WcaUser } from '../utils/recon_helpers.js';

export const remoteAccessRoutes = new Hono();
const enabled = () => (process.env.REMOTE_ACCESS_HOST_TOKEN?.length ?? 0) >= 32;
const owner = (u: WcaUser) => u.isAdmin && u.realWcaId === '2017YANR02';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

remoteAccessRoutes.use('/remote-access/*', bodyLimit({ maxSize: 4096 }));
remoteAccessRoutes.use('/remote-access/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});

async function snapshot(q: QueryRunner) {
  const keys = await q<{ id: string; public_key: string }>(
    "SELECT id, public_key FROM remote_access_requests WHERE status IN ('approved','active') ORDER BY id");
  const revision = createHash('sha256').update(JSON.stringify(keys)).digest('hex');
  return { keys, revision };
}

// A distinct host credential can consume approvals, never create or approve them.
remoteAccessRoutes.use('/remote-access/host/*', async (c, next) => {
  const supplied = c.req.header('Authorization')?.replace(/^Bearer /, '') ?? '';
  const expected = process.env.REMOTE_ACCESS_HOST_TOKEN ?? '';
  if (!enabled() || !timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(expected).digest()))
    return c.json({ error: 'Unauthorized host' }, 401);
  await next();
});
remoteAccessRoutes.get('/remote-access/host/keys', async c => c.json(await snapshot(query)));
remoteAccessRoutes.post('/remote-access/host/applied', async c => {
  const body = await c.req.json().catch(() => null);
  const applied = await withTransaction(async q => {
    await q('LOCK TABLE remote_access_requests IN SHARE ROW EXCLUSIVE MODE');
    if (body?.revision !== (await snapshot(q)).revision) return false;
    const activated = await q<{id: string}>("UPDATE remote_access_requests SET status='active', applied_at=NOW() WHERE status='approved' RETURNING id");
    const removed = await q<{id: string}>("UPDATE remote_access_requests SET applied_at=NULL, removed_at=NOW() WHERE status='revoked' AND removed_at IS NULL RETURNING id");
    for (const row of activated) await q("INSERT INTO remote_access_events(request_id, action) VALUES (?, 'applied')", [row.id]);
    for (const row of removed) await q("INSERT INTO remote_access_events(request_id, action) VALUES (?, 'removed')", [row.id]);
    await q('INSERT INTO remote_access_host(singleton) VALUES (TRUE) ON CONFLICT(singleton) DO UPDATE SET seen_at=NOW()');
    return true;
  });
  return applied ? c.json({ ok: true }) : c.json({ error: 'Snapshot changed; reconcile again' }, 409);
});

remoteAccessRoutes.use('/remote-access/requests*', async (c, next) => {
  // No role-preview / impersonation sessions for operating-system access.
  const payload = jwt.decode((c.req.header('Authorization') ?? '').replace(/^Bearer /, ''));
  if (payload && typeof payload === 'object' && payload.previewId) return c.json({ error: 'Use your own account' }, 403);
  await next();
});
remoteAccessRoutes.get('/remote-access/requests', async c => {
  const user = await requireAuth(c);
  const canApprove = owner(user);
  if (!enabled()) return c.json({ enabled: false, canApprove, hostOnline: false, requests: [] });
  const requests = await query<RemoteAccessRequest>(
    `SELECT * FROM remote_access_requests ${canApprove ? '' : 'WHERE user_id = ?'} ORDER BY created_at DESC LIMIT 200`, canApprove ? [] : [user.uid]);
  const [host] = await query<{online: boolean}>('SELECT seen_at > NOW() - INTERVAL \'90 seconds\' AS online FROM remote_access_host WHERE singleton');
  return c.json({ enabled: true, canApprove, hostOnline: host?.online ?? false, requests });
});
remoteAccessRoutes.post('/remote-access/requests', async c => {
  const user = await requireAuth(c);
  if (!enabled()) return c.json({ error: 'Remote access enrollment is not enabled' }, 503);
  if (!user.uid) return c.json({ error: 'Account required' }, 403);
  checkRateLimit(String(user.uid), { bucket: 'remote-access', max: 5 });
  const body = await c.req.json().catch(() => null);
  let publicKey: string;
  try { publicKey = normalizeRemoteKey(body?.publicKey); } catch { return c.json({ error: 'Invalid public key' }, 400); }
  if (typeof body?.device !== 'string' || !body.device.trim() || body.device.length > 80 || /[\x00-\x1f]/.test(body.device))
    return c.json({ error: 'Invalid device name' }, 400);
  const fingerprint = 'SHA256:' + createHash('sha256').update(Buffer.from(publicKey.split(' ')[1], 'base64')).digest('base64').replace(/=+$/, '');
  const result = await withTransaction(async q => {
    await q('SELECT id FROM app_users WHERE id=? FOR UPDATE', [user.uid]);
    const existing = await q<{id: string; user_id: number}>('SELECT id, user_id FROM remote_access_requests WHERE public_key=?', [publicKey]);
    if (existing.length) return Number(existing[0].user_id) === user.uid ? { id: existing[0].id } : null;
    const [count] = await q<{n: number}>("SELECT COUNT(*)::int AS n FROM remote_access_requests WHERE user_id=? AND status IN ('pending','approved','active')", [user.uid]);
    if (count.n >= 10) return null;
    const id = randomUUID();
    await q('INSERT INTO remote_access_requests(id,user_id,user_name,device,public_key,fingerprint) VALUES (?,?,?,?,?,?)',
      [id, user.uid, user.name.slice(0,200), body.device.trim(), publicKey, fingerprint]);
    await q("INSERT INTO remote_access_events(request_id,actor_id,action) VALUES (?,?,'requested')", [id,user.uid]);
    return { id };
  });
  return result ? c.json(result) : c.json({ error: 'Request limit or key already registered' }, 409);
});
remoteAccessRoutes.post('/remote-access/requests/:id/decision', async c => {
  const user = await requireAuth(c);
  if (!enabled()) return c.json({ error: 'Enrollment disabled' }, 503);
  if (!owner(user)) return c.json({ error: 'Only the host owner can approve remote access' }, 403);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const decision = body?.decision;
  if (!uuid.test(id) || !['approved', 'rejected', 'revoked'].includes(decision)) return c.json({ error: 'Invalid decision' }, 400);
  const changed = await withTransaction(async q => {
    const rows = await q<{id: string}>(`UPDATE remote_access_requests SET status=? WHERE id=? AND ${decision === 'revoked' ? "status IN ('approved','active')" : "status='pending'"} RETURNING id`, [decision,id]);
    if (!rows.length) return false;
    await q('INSERT INTO remote_access_events(request_id,actor_id,action) VALUES (?,?,?)', [id,user.uid,decision]);
    return true;
  });
  return changed ? c.json({ ok: true }) : c.json({ error: 'Request already changed; refresh' }, 409);
});
