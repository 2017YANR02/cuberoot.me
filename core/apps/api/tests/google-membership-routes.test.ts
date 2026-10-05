import { afterEach, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), reconcile: vi.fn() }));
vi.mock('../src/payment/google-membership.js', () => ({
  googleIapEnabled: () => false,
  verifyGooglePushAuthorization: mocks.authorize,
  reconcileGoogleSubscription: mocks.reconcile,
  googleAccountId: vi.fn(), syncGoogleSubscriptions: vi.fn(), validGooglePurchaseToken: vi.fn(),
}));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: vi.fn(), checkRateLimit: vi.fn() }));
import { membershipGoogleRoutes } from '../src/routes/membership_google.js';

const app = new Hono().route('/v1', membershipGoogleRoutes);
const endpoint = '/v1/membership/google/notifications';
function notify(data: object) {
  return app.request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { data: Buffer.from(JSON.stringify(data)).toString('base64') } }) });
}
afterEach(() => vi.resetAllMocks());
it('keeps purchase routes disabled', async () => {
  expect((await app.request('/v1/membership/google/me')).status).toBe(503);
});
it('requires push authentication even for test notifications', async () => {
  mocks.authorize.mockRejectedValueOnce(new Error('Unauthorized'));
  expect((await notify({ packageName: 'me.cuberoot.app', testNotification: {} })).status).toBe(401);
  expect(mocks.reconcile).not.toHaveBeenCalled();
});
it('accepts authenticated test delivery but rejects another package', async () => {
  expect((await notify({ packageName: 'me.cuberoot.app', testNotification: {} })).status).toBe(200);
  expect((await notify({ packageName: 'wrong.package', testNotification: {} })).status).toBe(400);
  expect(mocks.reconcile).not.toHaveBeenCalled();
});
it('keeps real notifications retryable without changing entitlements', async () => {
  expect((await notify({ packageName: 'me.cuberoot.app', subscriptionNotification: { purchaseToken: 'test-token' } })).status).toBe(503);
  expect(mocks.reconcile).not.toHaveBeenCalled();
});
