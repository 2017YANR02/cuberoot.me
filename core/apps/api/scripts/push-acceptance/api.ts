import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { NOTIFICATION_PUSH_KINDS, notificationOpenUrl } from '@cuberoot/shared/notification-push';
import { parsePushDevice } from '../../src/utils/push_device.js';
import { pushOpen } from '../../src/utils/push_message.js';

const equal = (a: string, b: string) => {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const allowedOrigins = new Set(['http://127.0.0.1:4175', 'http://localhost:4175', 'capacitor://localhost', 'http://localhost', 'https://localhost']);

/** Separate fixture process: no DB, production auth, transport or scheduled worker imports. */
export function createPushAcceptanceApi(pairingToken: string) {
  if (!/^[a-f0-9]{64}$/.test(pairingToken)) throw new Error('Invalid acceptance pairing token');
  const app = new Hono<{ Variables: { fixtureUid: number } }>();
  const expiresAt = Date.now() + 60 * 60_000;
  const sessions = new Map<string, number>();
  let device: (NonNullable<ReturnType<typeof parsePushDevice>> & { uid: number }) | null = null;
  let sequence = 0;
  app.use('*', bodyLimit({ maxSize: 8192, onError: c => c.json({ error: 'Acceptance payload too large' }, 413) }));
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-CubeRoot-Push-Acceptance', 'fixture-v1');
    const origin = c.req.header('Origin');
    if (origin && !allowedOrigins.has(origin)) return c.json({ error: 'Origin rejected' }, 403);
    if (Date.now() >= expiresAt) return c.json({ error: 'Acceptance session expired; restart the fixture API' }, 410);
    await next();
  });
  app.use('*', cors({ origin: origin => allowedOrigins.has(origin) ? origin : '', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowHeaders: ['Authorization', 'Content-Type'], exposeHeaders: ['X-CubeRoot-Push-Acceptance'] }));
  app.onError(() => new Response(JSON.stringify({ error: 'Acceptance request failed' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }));
  const bearer = (header: string | undefined) => header?.startsWith('Bearer ') ? header.slice(7) : '';
  app.post('/__acceptance/session', async c => {
    if (!equal(bearer(c.req.header('Authorization')), pairingToken)) return c.json({ error: 'Pairing required' }, 401);
    const body = await c.req.json().catch(() => null);
    if (body?.uid !== 900001 && body?.uid !== 900002) return c.json({ error: 'Choose a fixture account' }, 400);
    // Bound storage and invalidate the prior test session for this account.
    for (const [token, uid] of sessions) if (uid === body.uid) sessions.delete(token);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, body.uid);
    return c.json({ token, user: { uid: body.uid, name: `Push fixture ${body.uid}`, wcaId: null, avatar: '', avatarSource: 'preset', avatarPreset: null, isAdmin: false } });
  });
  app.delete('/v1/notifications/push/device', async c => {
    const parsed = parsePushDevice(await c.req.json().catch(() => null), true);
    if (!parsed) return c.json({ error: 'Invalid device credential' }, 400);
    if (device?.installationId === parsed.installationId && equal(device.secretHash, parsed.secretHash)) device = null;
    return c.json({ ok: true });
  });
  app.use('*', async (c, next) => {
    const uid = sessions.get(bearer(c.req.header('Authorization')));
    if (!uid) return c.json({ error: 'Fixture session required' }, 401);
    c.set('fixtureUid', uid);
    await next();
  });
  app.get('/v1/notifications/push/config', c => c.json({ enabled: true, fixture: true }));
  app.put('/v1/notifications/push/device', async c => {
    const parsed = parsePushDevice(await c.req.json().catch(() => null));
    if (!parsed || parsed.pushVersion !== 2) return c.json({ error: 'A version 2 device is required' }, 400);
    if (device && (device.installationId !== parsed.installationId || !equal(device.secretHash, parsed.secretHash))) return c.json({ error: 'Only one acceptance device can bind; revoke it or restart the fixture API' }, 409);
    device = { ...parsed, uid: c.get('fixtureUid') };
    return c.json({ ok: true });
  });
  app.get('/__acceptance/status', c => c.json({ fixture: true, bound: device?.uid === c.get('fixtureUid'), provider: device?.uid === c.get('fixtureUid') ? device.provider : null, delivery: 'disabled', expiresAt }));
  app.post('/__acceptance/notification', async c => {
    if (!device || device.uid !== c.get('fixtureUid')) return c.json({ error: 'Bind this test account first' }, 409);
    const body = await c.req.json().catch(() => null);
    if (!NOTIFICATION_PUSH_KINDS.includes(body?.kind)) return c.json({ error: 'Unsupported notification kind' }, 400);
    const notification = pushOpen({ clientId: device.clientId, notificationId: ++sequence, title: 'Push acceptance fixture', excerpt: '',
      link: '/wca/comp/PushAcceptance2026', kind: body.kind, recipientUid: String(device.uid), pushVersion: 2 });
    return c.json({ notification, url: notificationOpenUrl(device.appId, notification), delivery: 'fixture-only' });
  });
  return app;
}
