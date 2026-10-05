import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ relay: vi.fn(), run: vi.fn(), transaction: vi.fn(), committed: false }));
vi.mock('../src/payment/google-play-relay.js', () => ({ useGooglePlayRelay: () => true, googlePlayRelay: mocks.relay }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.run, withTransaction: mocks.transaction }));
vi.mock('google-auth-library', () => ({ GoogleAuth: class { constructor() { throw new Error('Direct Google access forbidden'); } }, OAuth2Client: class {} }));
import { googleAccountId, reconcileGoogleSubscription, verifyGooglePushAuthorization } from '../src/payment/google-membership.js';
const account = '12345678-1234-1234-1234-123456789abc';
beforeEach(() => {
  vi.clearAllMocks(); mocks.committed = false;
  vi.stubEnv('GOOGLE_IAP_ENABLED', '1');
  vi.stubEnv('GOOGLE_IAP_RTDN_AUDIENCE', 'https://api.cuberoot.me/v1/membership/google/notifications');
  vi.stubEnv('GOOGLE_IAP_RTDN_SERVICE_ACCOUNT', 'push@fixture.iam.gserviceaccount.com');
  mocks.transaction.mockImplementation(async callback => { const result = await callback(mocks.run); mocks.committed = true; return result; });
  mocks.run.mockImplementation(async (sql: string) => sql.includes('SELECT user_id FROM google_membership_accounts') ? [{ user_id: 7 }] : []);
  mocks.relay.mockImplementation(async (request: { operation: string }) => {
    if (request.operation === 'acknowledge') { expect(mocks.committed).toBe(true); return { acknowledged: true }; }
    return { subscription: { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
      externalAccountIdentifiers: { obfuscatedExternalAccountId: account },
      lineItems: [{ productId: 'me.cuberoot.app.membership.monthly', expiryTime: '2030-01-01T00:00:00Z' }] } };
  });
});
afterEach(() => vi.unstubAllEnvs());
it('retains durable storage before acknowledgement and never contacts Google directly', async () => {
  await reconcileGoogleSubscription('receipt-123', 7);
  expect(mocks.run.mock.calls.some(([sql]) => sql.includes('INSERT INTO google_membership_subscriptions'))).toBe(true);
  expect(mocks.relay.mock.calls.map(([request]) => request.operation)).toEqual(['subscription', 'acknowledge']);
});
it('does not acknowledge a wrong account or failed transaction', async () => {
  await expect(reconcileGoogleSubscription('receipt-123', 8)).rejects.toThrow('another account');
  expect(mocks.relay).toHaveBeenCalledTimes(1);
  mocks.transaction.mockRejectedValue(new Error('DB unavailable'));
  await expect(reconcileGoogleSubscription('receipt-123', 7)).rejects.toThrow();
  expect(mocks.relay).toHaveBeenCalledTimes(1);
});
it('keeps purchase operations disabled while allowing authenticated push verification', async () => {
  vi.stubEnv('GOOGLE_IAP_ENABLED', '0');
  await expect(googleAccountId(7)).rejects.toThrow('disabled');
  await expect(reconcileGoogleSubscription('receipt-123', 7)).rejects.toThrow('disabled');
  expect(mocks.relay).not.toHaveBeenCalled();
  mocks.relay.mockResolvedValue({ verified: true });
  await verifyGooglePushAuthorization('Bearer header.payload.signature');
  mocks.relay.mockResolvedValue({ verified: false });
  await expect(verifyGooglePushAuthorization('Bearer header.payload.signature')).rejects.toThrow();
});
