import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { Environment } from '@apple/app-store-server-library';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { appleAccountToken, appleIapAccountEnvironment, appleIapEnabled, appleIapEnvironmentEnabled, appleIapSandboxEnabled, appleSubscriptionStatus, receiveAppleNotification, verifyApplePurchase } from '../payment/apple-membership.js';
import { APPLE_MEMBERSHIP_PRODUCTS } from '../payment/apple-membership-policy.js';

export const membershipAppleRoutes = new Hono();
const unavailable = { error: 'Apple subscriptions are not available yet' };
membershipAppleRoutes.use('/membership/apple/*', bodyLimit({ maxSize: 128 * 1024 }));
membershipAppleRoutes.use('/membership/apple/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (!appleIapEnabled() && !appleIapSandboxEnabled()) return c.json(unavailable, 503);
  await next();
});
membershipAppleRoutes.get('/membership/apple/me', async c => {
  const user = await requireAuth(c);
  if (!user.uid) return c.json({ error: 'Sign in again to use Apple subscriptions' }, 401);
  const environment = appleIapAccountEnvironment(user.uid, c.req.queries('environment') ?? []);
  if (!environment) return c.json(unavailable, 503);
  return c.json({
    appAccountToken: await appleAccountToken(user.uid, environment),
    products: APPLE_MEMBERSHIP_PRODUCTS,
    subscriptions: await appleSubscriptionStatus(user.uid, environment === Environment.SANDBOX),
  });
});
membershipAppleRoutes.post('/membership/apple/verify', async c => {
  const user = await requireAuth(c);
  if (!user.uid) return c.json({ error: 'Sign in again to use Apple subscriptions' }, 401);
  const environment = appleIapAccountEnvironment(user.uid, c.req.queries('environment') ?? []);
  if (!environment) return c.json(unavailable, 503);
  checkRateLimit(String(user.uid), { bucket: 'apple-iap', max: 30 });
  const body = await c.req.json().catch(() => null);
  if (typeof body?.signedTransaction !== 'string' || body.signedTransaction.length > 100_000) return c.json({ error: 'Invalid transaction' }, 400);
  try { await verifyApplePurchase(body.signedTransaction, user.uid, environment); }
  catch { return c.json({ error: 'Could not verify this purchase for this CubeRoot account. Retry or contact support; do not purchase again.' }, 409); }
  return c.json({ verified: true });
});
for (const [path, environment] of [['production', Environment.PRODUCTION], ['sandbox', Environment.SANDBOX]] as const) {
  membershipAppleRoutes.post(`/membership/apple/notifications/${path}`, async c => {
    if (!appleIapEnvironmentEnabled(environment)) return c.json(unavailable, 503);
    const body = await c.req.json().catch(() => null);
    if (typeof body?.signedPayload !== 'string' || body.signedPayload.length > 100_000) return c.json({ error: 'Invalid notification' }, 400);
    try { await receiveAppleNotification(environment, body.signedPayload); }
    catch {
      // Non-2xx makes Apple retry transient verification/API/database failures.
      // Never log raw JWS, identity tokens or signing keys.
      console.error('[apple-iap] Notification verification or reconciliation failed', environment);
      return c.json({ error: 'Notification not processed' }, 503);
    }
    return c.json({ received: true });
  });
}
