import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ enroll: vi.fn(), identity: vi.fn(), account: vi.fn(), owner: 'u12', uid: 12 }));
vi.mock('../src/utils/recon_helpers.js', () => ({ optionalAuth: async () => mocks.owner ? ({ wcaId: mocks.owner, uid: mocks.uid }) : null, requireAuth: async () => ({ wcaId: mocks.owner, uid: mocks.uid, name: 'User' }), checkRateLimit: () => {} }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'route-test-only' }));
vi.mock('../src/payment/membership-contracts.js', () => ({ listMembershipContracts: vi.fn(), cancelMembershipContract: vi.fn(), synchronizeMembershipNotification: vi.fn() }));
vi.mock('../src/payment/membership-renewals.js', () => ({ reconcileRenewalDebit: vi.fn() }));
vi.mock('../src/payment/membership-enrollment.js', () => ({ enrollMembership: mocks.enroll }));
vi.mock('../src/utils/account.js', () => ({ findUserByIdentity: mocks.account }));
vi.mock('../src/utils/wechat_miniprogram.js', () => ({ exchangeWechatMiniProgramCode: mocks.identity, generateWechatMiniProgramUrlLink: vi.fn() }));
import { membershipSubscriptionRoutes } from '../src/routes/membership_subscriptions.js';
import { issueMembershipHandoff } from '../src/payment/membership-handoff.js';
const post = (path: string, data: unknown) => membershipSubscriptionRoutes.request('/membership/subscriptions/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.owner = 'u12'; mocks.uid = 12;
  for (const [name, value] of Object.entries({ APPID: 'wx1f92ba91b7e42015', MCHID: '1234567890', API_V2_KEY: 'x'.repeat(32),
    MONTHLY_APPROVED: '225492', YEARLY_APPROVED: '225493', MINI_RELEASED: 'wx1f92ba91b7e42015', SIGNING_CHANNEL: 'miniprogram',
    RELEASE_ENABLED: 'true', SYNC_ENABLED: 'true', DEBIT_ENABLED: 'true' })) vi.stubEnv('WECHAT_PAPAY_' + name, value);
  vi.stubEnv('WECHAT_MINI_APP_ID', 'wx1f92ba91b7e42015'); vi.stubEnv('WECHAT_MINI_APP_SECRET', 'fixture');
  mocks.identity.mockResolvedValue({ unionid: 'union-fixture', openid: 'openid-fixture' }); mocks.account.mockResolvedValue({ id: 12 });
  mocks.enroll.mockResolvedValue({ subscriptionId: 'test' });
});
afterEach(() => vi.unstubAllEnvs());
function input() { return { ticket: issueMembershipHandoff('u12', 'monthly_auto_renew'), agreed: true, code: 'fixture', priceCents: 2999, termsVersion: '2026-10-14' }; }
it('fails closed before contacting WeChat when the package is not released', async () => {
  vi.stubEnv('WECHAT_PAPAY_MINI_RELEASED', '');
  expect((await post('mini-enroll', input())).status).toBe(503); expect(mocks.identity).not.toHaveBeenCalled(); expect(mocks.enroll).not.toHaveBeenCalled();
});
it('rejects a different logged-in account or a different verified WeChat identity', async () => {
  const body = input(); mocks.owner = 'u13';
  expect((await post('mini-context', body)).status).toBe(403);
  expect((await post('mini-enroll', body)).status).toBe(409); expect(mocks.enroll).not.toHaveBeenCalled();
  mocks.owner = 'u12'; mocks.account.mockResolvedValue({ id: 13 });
  expect((await post('mini-enroll', body)).status).toBe(403); expect(mocks.enroll).not.toHaveBeenCalled();
});
it('requires fresh explicit consent and price, and only then reserves a contract', async () => {
  expect((await post('mini-enroll', { ...input(), agreed: false })).status).toBe(400);
  expect((await post('mini-enroll', { ...input(), priceCents: 1 })).status).toBe(400);
  expect(mocks.enroll).not.toHaveBeenCalled();
  expect((await post('mini-enroll', input())).status).toBe(200);
  expect(mocks.enroll).toHaveBeenCalledWith('u12', expect.objectContaining({ agreed: true, priceCents: 2999, planSlug: 'monthly_auto_renew' }), expect.any(String));
});
it('does not permit old H5 endpoints to reserve mini contracts', async () => {
  expect((await post('enroll', input())).status).toBe(409); expect(mocks.enroll).not.toHaveBeenCalled();
});

it('keeps private signing invisible to anonymous and other accounts', async () => {
  vi.stubEnv('WECHAT_PAPAY_RELEASE_ENABLED', 'false');
  vi.stubEnv('WECHAT_PAPAY_PILOT_ENABLED', 'true');
  vi.stubEnv('WECHAT_PAPAY_PILOT_OWNER', 'u12');
  vi.stubEnv('WECHAT_PAPAY_PILOT_UNTIL', new Date(Date.now() + 3600000).toISOString());
  vi.stubEnv('WECHAT_PAPAY_PILOT_DEBIT_ENABLED', 'false');
  const availability = () => membershipSubscriptionRoutes.request('/membership/subscriptions/availability');
  expect(await (await availability()).json()).toMatchObject({ available: true, pilot: true, pilotPayment: false });
  expect((await post('mini-enroll', input())).status).toBe(200);
  const preview = await post('mini-context', { pilotPlan: 'monthly_auto_renew' });
  expect(preview.status).toBe(200);
  expect(await preview.json()).toMatchObject({ pilot: true, ticket: expect.any(String), priceCents: 2999 });
  mocks.owner = 'u13';
  expect((await post('mini-context', { pilotPlan: 'monthly_auto_renew' })).status).toBe(403);
  expect(await (await availability()).json()).toMatchObject({ available: false, pilot: false });
  expect((await post('mini-enroll', input())).status).toBe(503);
  mocks.owner = '';
  expect(await (await availability()).json()).toMatchObject({ available: false, pilot: false });
});
