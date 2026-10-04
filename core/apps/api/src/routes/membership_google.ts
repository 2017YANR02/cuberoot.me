import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { googleAccountId, googleIapEnabled, reconcileGoogleSubscription, syncGoogleSubscriptions, validGooglePurchaseToken, verifyGooglePushAuthorization } from '../payment/google-membership.js';
import { GOOGLE_MEMBERSHIP_PACKAGE } from '../payment/google-membership-policy.js';

export const membershipGoogleRoutes = new Hono();
membershipGoogleRoutes.use('/membership/google/*', bodyLimit({ maxSize: 32 * 1024 }));
membershipGoogleRoutes.use('/membership/google/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (!googleIapEnabled()) return c.json({ error: 'Google subscriptions unavailable' }, 503);
  await next();
});
membershipGoogleRoutes.get('/membership/google/me', async c => {
  const user = await requireAuth(c);
  if (!user.uid) return c.json({ error: 'Sign in again' }, 401);
  checkRateLimit(String(user.uid), { bucket: 'google-iap', max: 30 });
  return c.json({ obfuscatedAccountId: await googleAccountId(user.uid) });
});
membershipGoogleRoutes.post('/membership/google/verify', async c => {
  const user = await requireAuth(c);
  if (!user.uid) return c.json({ error: 'Sign in again' }, 401);
  checkRateLimit(String(user.uid), { bucket: 'google-iap', max: 30 });
  const body = await c.req.json().catch(() => null);
  if (!validGooglePurchaseToken(body?.purchaseToken)) return c.json({ error: 'Invalid purchase' }, 400);
  try { await reconcileGoogleSubscription(body.purchaseToken, user.uid); }
  catch { return c.json({ error: 'Purchase not verified for this account. Restore or retry; do not pay again.' }, 409); }
  return c.json({ verified: true });
});
membershipGoogleRoutes.post('/membership/google/sync', async c => {
  const user = await requireAuth(c);
  if (!user.uid) return c.json({ error: 'Sign in again' }, 401);
  checkRateLimit(String(user.uid), { bucket: 'google-iap-sync', max: 10 });
  await syncGoogleSubscriptions(user.uid);
  return c.json({ synced: true });
});
membershipGoogleRoutes.post('/membership/google/notifications', async c => {
  try { await verifyGooglePushAuthorization(c.req.header('Authorization')); }
  catch { return c.json({ error: 'Unauthorized push' }, 401); }
  try {
    const envelope = await c.req.json();
    if (typeof envelope?.message?.data !== 'string') return c.json({ error: 'Invalid notification' }, 400);
    const data = JSON.parse(Buffer.from(envelope.message.data, 'base64').toString('utf8'));
    if (data.packageName !== GOOGLE_MEMBERSHIP_PACKAGE) return c.json({ error: 'Wrong package' }, 400);
    const token = data.subscriptionNotification?.purchaseToken ?? data.voidedPurchaseNotification?.purchaseToken;
    if (token) await reconcileGoogleSubscription(token);
    else if (!data.testNotification) return c.json({ received: true, ignored: true });
    return c.json({ received: true });
  } catch {
    // Pub/Sub retries non-2xx; never log receipts, account identifiers or credentials.
    console.error('[google-iap] Notification reconciliation failed');
    return c.json({ error: 'Notification not processed' }, 503);
  }
});
