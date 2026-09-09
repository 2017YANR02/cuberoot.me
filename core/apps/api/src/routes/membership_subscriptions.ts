import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { listMembershipContracts, cancelMembershipContract, synchronizeMembershipNotification } from '../payment/membership-contracts.js';
import { verifyPapayNotification } from '../payment/wechat-papay.js';

export const membershipSubscriptionRoutes = new Hono();
for (const path of ['/membership/subscriptions', '/membership/subscriptions/*']) {
  membershipSubscriptionRoutes.use(path, async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });
}
membershipSubscriptionRoutes.post('/membership/subscriptions/wechat/notify',
  bodyLimit({ maxSize: 65536 }), async (c) => {
    c.header('Cache-Control', 'no-store');
    // Let body-limit observe stream errors before the provider retry handler.
    const payload = await c.req.text();
    let success = false;
    try {
      const notification = verifyPapayNotification(payload);
      success = await synchronizeMembershipNotification(notification);
    } catch {
      // No payload, provider identifiers or credentials in public errors/logs.
    }
    c.header('Content-Type', 'application/xml; charset=utf-8');
    c.header('Cache-Control', 'no-store');
    return c.body(success
      ? '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>'
      : '<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[RETRY]]></return_msg></xml>');
  });
async function withLockRetry<T>(c: Context, action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '55P03') {
      c.header('Retry-After', '2');
      throw new HTTPException(503, { res: c.json({ error: 'subscription management busy; retry shortly' }, 503) });
    }
    throw error;
  }
}
membershipSubscriptionRoutes.get('/membership/subscriptions', async (c) => {
  const user = await requireAuth(c);
  checkRateLimit(user.wcaId, { bucket: 'membership-contract-query', max: 20 });
  return c.json(await withLockRetry(c, () => listMembershipContracts(user.wcaId)));
});
membershipSubscriptionRoutes.post('/membership/subscriptions/:id/cancel', async (c) => {
  const user = await requireAuth(c);
  checkRateLimit(user.wcaId, { bucket: 'membership-contract-cancel', max: 10 });
  const id = c.req.param('id');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: 'invalid subscription id' }, 400);
  }
  const body = await c.req.json().catch(() => null);
  if (!body || body.confirm !== true) return c.json({ error: 'subscription cancellation confirmation required' }, 400);
  const result = await withLockRetry(c, () => cancelMembershipContract(id, user.wcaId));
  if (result.kind === 'missing') return c.json({ error: 'subscription not found' }, 404);
  if (result.kind === 'unavailable') return c.json({ error: 'subscription management unavailable' }, 503);
  return c.json({ subscription: result.subscription }, result.kind === 'complete' ? 200 : 202);
});
