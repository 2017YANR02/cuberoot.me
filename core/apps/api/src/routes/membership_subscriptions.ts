import { Hono, type Context } from 'hono';
import { canPurchaseEnterpriseMembership } from '../utils/enterprise_membership.js';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { requireAuth, optionalAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { listMembershipContracts, cancelMembershipContract, synchronizeMembershipNotification } from '../payment/membership-contracts.js';
import { verifyPapayNotification, verifyPapayPaymentNotification, papayConfigured, PapayUnavailable } from '../payment/wechat-papay.js';
import { enrollMembership } from '../payment/membership-enrollment.js';
import { reconcileRenewalDebit } from '../payment/membership-renewals.js';
import { renewalReleased, renewalPilotAllowed, renewalPlanConfigured, RENEWAL_TEMPLATES, RENEWAL_TERMS_VERSION } from '../payment/membership-renewal-policy.js';
import { getIp } from '../utils/analytics_helpers.js';
import QRCode from 'qrcode';
import { renewalChannel } from '../payment/membership-renewal-policy.js';
import { issueMembershipHandoff, readMembershipHandoff } from '../payment/membership-handoff.js';
import { exchangeWechatMiniProgramCode, generateWechatMiniProgramUrlLink } from '../utils/wechat_miniprogram.js';
import { findUserByIdentity } from '../utils/account.js';

export const membershipSubscriptionRoutes = new Hono();
membershipSubscriptionRoutes.get('/membership/subscriptions/availability', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await optionalAuth(c);
  const enterpriseEligible = !!user && await canPurchaseEnterpriseMembership(user.wcaId);
  const pilot = !renewalReleased() && renewalPilotAllowed(user?.wcaId);
  return c.json({ available: miniEnrollmentAvailable(user?.wcaId) || (renewalChannel() === 'h5' && renewalReleased() && papayConfigured()
    && process.env.WECHAT_PAPAY_DEBIT_ENABLED === 'true' && process.env.WECHAT_PAPAY_SYNC_ENABLED === 'true'),
  pilot, pilotPayment: pilot && process.env.WECHAT_PAPAY_PILOT_DEBIT_ENABLED === 'true',
  plans: Object.fromEntries(Object.keys(RENEWAL_TEMPLATES).map(slug => [slug, renewalPlanConfigured(slug) && (!slug.startsWith('enterprise_') || enterpriseEligible)])),
  termsVersion: RENEWAL_TERMS_VERSION, channel: renewalChannel() });
});
for (const path of ['/membership/subscriptions', '/membership/subscriptions/*']) {
  membershipSubscriptionRoutes.use(path, async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });
}
membershipSubscriptionRoutes.post('/membership/subscriptions/enroll', bodyLimit({ maxSize: 4096 }), async (c) => {
  const user = await requireAuth(c);
  checkRateLimit(user.wcaId, { bucket: 'membership-enroll', max: 5 });
  if (!renewalReleased() || !papayConfigured() || process.env.WECHAT_PAPAY_DEBIT_ENABLED !== 'true'
    || process.env.WECHAT_PAPAY_SYNC_ENABLED !== 'true') return c.json({ error: 'auto-renewal unavailable' }, 503);
  const input = await c.req.json().catch(() => null);
  if (renewalChannel() !== 'h5') return c.json({ error: 'use miniprogram enrollment' }, 409);
  try { return c.json(await enrollMembership(user.wcaId, input, getIp(c))); }
  catch (error) {
    return c.json({ error: 'unable to start subscription; refresh or manage your existing subscription' }, error instanceof PapayUnavailable ? 503 : 409);
  }
});

function miniEnrollmentAvailable(owner?: string) {
  return renewalChannel() === 'miniprogram' && papayConfigured() && process.env.WECHAT_PAPAY_SYNC_ENABLED === 'true'
    && ((renewalReleased() && process.env.WECHAT_PAPAY_DEBIT_ENABLED === 'true') || renewalPilotAllowed(owner));
}
membershipSubscriptionRoutes.post('/membership/subscriptions/mini-link', bodyLimit({ maxSize: 4096 }), async (c) => {
  const user = await requireAuth(c);
  checkRateLimit(user.wcaId, { bucket: 'membership-mini-link', max: 5 });
  if (!miniEnrollmentAvailable(user.wcaId)) return c.json({ error: 'auto-renewal unavailable' }, 503);
  const body = await c.req.json().catch(() => null);
  try {
    if (!renewalPlanConfigured(body?.planSlug)) return c.json({ error: 'renewal template unavailable' }, 503);
    if (body.planSlug.startsWith('enterprise_') && !await canPurchaseEnterpriseMembership(user.wcaId)) {
      return c.json({ error: 'verified enterprise management access required' }, 403);
    }
    const ticket = issueMembershipHandoff(user.wcaId, body?.planSlug);
    const urlLink = await generateWechatMiniProgramUrlLink(new URLSearchParams({ ticket }).toString(),
      Math.floor(Date.now() / 1000) + 600, 'pages/membership/index', renewalReleased() ? 'release' : 'develop');
    return c.json({ urlLink, qrCodeDataUrl: await QRCode.toDataURL(urlLink, { width: 256, margin: 2 }), expiresIn: 600 });
  } catch { return c.json({ error: 'unable to open WeChat authorization' }, 503); }
});
membershipSubscriptionRoutes.post('/membership/subscriptions/mini-context', bodyLimit({ maxSize: 4096 }), async (c) => {
  const user = await requireAuth(c);
  checkRateLimit(user.wcaId, { bucket: 'membership-mini-context', max: 20 });
  const body = await c.req.json().catch(() => null);
  try {
    const pilot = !renewalReleased() && renewalPilotAllowed(user.wcaId);
    const ticket = !body?.ticket && pilot ? issueMembershipHandoff(user.wcaId, body?.pilotPlan) : body?.ticket;
    const context = readMembershipHandoff(ticket, user.wcaId);
    return c.json({ ...context, ...(pilot ? { ticket } : {}), account: user.wcaId, name: user.name,
      available: miniEnrollmentAvailable(user.wcaId) && renewalPlanConfigured(context.planSlug), pilot: !renewalReleased() && renewalPilotAllowed(user.wcaId),
      pilotPayment: pilot && process.env.WECHAT_PAPAY_PILOT_DEBIT_ENABLED === 'true' });
  } catch { return c.json({ error: 'link expired or account mismatch' }, 403); }
});
membershipSubscriptionRoutes.post('/membership/subscriptions/mini-enroll', bodyLimit({ maxSize: 4096 }), async (c) => {
  const user = await requireAuth(c);
  checkRateLimit(user.wcaId, { bucket: 'membership-enroll', max: 5 });
  if (!miniEnrollmentAvailable(user.wcaId)) return c.json({ error: 'auto-renewal unavailable' }, 503);
  const body = await c.req.json().catch(() => null);
  try {
    const consent = readMembershipHandoff(body?.ticket, user.wcaId);
    if (body?.agreed !== true || typeof body.code !== 'string' || !body.code || body.code.length > 512
      || body.priceCents !== consent.priceCents || body.termsVersion !== consent.termsVersion) return c.json({ error: 'invalid consent' }, 400);
    // A website session alone cannot authorize a different WeChat user's account.
    const identity = await exchangeWechatMiniProgramCode(body.code);
    const account = identity.unionid ? await findUserByIdentity('wechat', identity.unionid) : null;
    if (!account || account.id !== user.uid) return c.json({ error: 'WeChat account mismatch' }, 403);
    return c.json(await enrollMembership(user.wcaId, { ...consent, agreed: true }, getIp(c)));
  } catch { return c.json({ error: 'unable to authorize; refresh or manage existing subscription' }, 409); }
});
membershipSubscriptionRoutes.post('/membership/subscriptions/wechat/payment-notify', bodyLimit({ maxSize: 65536 }), async (c) => {
  const payload = await c.req.text();
  let success = false;
  try {
    const notification = verifyPapayPaymentNotification(payload);
    success = await reconcileRenewalDebit(notification.out_trade_no);
  } catch { /* Ask WeChat to retry without exposing payment details. */ }
  c.header('Content-Type', 'application/xml; charset=utf-8');
  return c.body(`<xml><return_code><![CDATA[${success ? 'SUCCESS' : 'FAIL'}]]></return_code><return_msg><![CDATA[${success ? 'OK' : 'RETRY'}]]></return_msg></xml>`);
});
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
