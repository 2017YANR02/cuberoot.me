import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { signGooglePlayRelay, verifyGooglePlayRelay, GOOGLE_PLAY_RELAY_HEADER, GOOGLE_PLAY_RELAY_MAX_BYTES } from '@cuberoot/shared/google-play-relay';
const mocks = vi.hoisted(() => ({ request: vi.fn(), verifyIdToken: vi.fn(), fromJSON: vi.fn(), oidc: vi.fn() }));
vi.mock('google-auth-library', () => ({
  ExternalAccountClient: { fromJSON: mocks.fromJSON },
  OAuth2Client: class { verifyIdToken = mocks.verifyIdToken; },
}));
vi.mock('@vercel/oidc', () => ({ getVercelOidcToken: mocks.oidc }));
import { POST } from '../app/api/google-play/route';
const secret = 'fixture-only-'.repeat(4);
async function request(value: unknown, signed = true) {
  const body = JSON.stringify(value);
  return POST(new Request('https://google-api.cuberoot.me/api/google-play', { method: 'POST', body,
    headers: { 'Content-Type': 'application/json', [GOOGLE_PLAY_RELAY_HEADER]: signed ? await signGooglePlayRelay(secret, body) : 'invalid' } }));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('GOOGLE_PLAY_RELAY_SECRET', secret);
  vi.stubEnv('GOOGLE_PLAY_WIF_AUDIENCE', 'https://iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/pool/providers/provider');
  vi.stubEnv('GOOGLE_PLAY_SERVICE_ACCOUNT', 'billing@project-test.iam.gserviceaccount.com');
  vi.stubEnv('GOOGLE_IAP_RTDN_AUDIENCE', 'https://api.cuberoot.me/v1/membership/google/notifications');
  vi.stubEnv('GOOGLE_IAP_RTDN_SERVICE_ACCOUNT', 'push@project-test.iam.gserviceaccount.com');
  mocks.fromJSON.mockReturnValue({ request: mocks.request });
  mocks.request.mockResolvedValue({ data: { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE' } });
});
afterEach(() => vi.unstubAllEnvs());
it('binds the signature to body, purpose and a 60 second window', async () => {
  const body = '{"operation":"ready"}', now = 1791190000000;
  const proof = await signGooglePlayRelay(secret, body, now);
  expect(await verifyGooglePlayRelay(secret, body, proof, now)).toBe(true);
  expect(await verifyGooglePlayRelay(secret, body + ' ', proof, now)).toBe(false);
  expect(await verifyGooglePlayRelay(secret + 'x', body, proof, now)).toBe(false);
  expect(await verifyGooglePlayRelay(secret, body, proof, now + 61000)).toBe(false);
  expect(await verifyGooglePlayRelay(secret, body, proof, now - 61000)).toBe(false);
});
it('rejects anonymous, preview and oversized requests before Google access', async () => {
  expect((await request({ operation: 'ready' }, false)).status).toBe(401);
  expect((await request('x'.repeat(GOOGLE_PLAY_RELAY_MAX_BYTES))).status).toBe(413);
  vi.stubEnv('VERCEL_ENV', 'preview');
  expect((await request({ operation: 'ready' })).status).toBe(503);
  expect(mocks.fromJSON).not.toHaveBeenCalled();
});
it('refuses arbitrary URLs, products and malformed tokens', async () => {
  for (const value of [{ operation: 'ready', url: 'https://evil.test' }, { operation: 'refund', token: 'token1234' },
    { operation: 'acknowledge', token: 'token1234', productId: 'other-app' }, { operation: 'subscription', token: 'bad token' }]) {
    expect((await request(value)).status).toBe(400);
  }
  expect(mocks.request).not.toHaveBeenCalled();
});
it('uses WIF with only the Play scope and probes both fixed products', async () => {
  const response = await request({ operation: 'ready' });
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.request).toHaveBeenCalledTimes(2);
  expect(mocks.request.mock.calls.map(call => call[0].url)).toEqual([
    'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/me.cuberoot.app/subscriptions/me.cuberoot.app.membership.monthly',
    'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/me.cuberoot.app/subscriptions/me.cuberoot.app.membership.yearly',
  ]);
  const config = mocks.fromJSON.mock.calls[0][0];
  expect(config.audience).toBe('//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/pool/providers/provider');
  expect(config.scopes).toEqual(['https://www.googleapis.com/auth/androidpublisher']);
  expect(config).not.toHaveProperty('private_key');
  await config.subject_token_supplier.getSubjectToken();
  expect(mocks.oidc).toHaveBeenCalledWith({ audience: process.env.GOOGLE_PLAY_WIF_AUDIENCE });
});
it('encodes tokens into fixed Google endpoints and returns no credential', async () => {
  const response = await request({ operation: 'subscription', token: 'receipt/with?query' });
  expect(await response.json()).toEqual({ subscription: { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE' } });
  expect(mocks.request.mock.calls[0][0].url).toBe('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/me.cuberoot.app/purchases/subscriptionsv2/tokens/receipt%2Fwith%3Fquery');
  expect((await request({ operation: 'acknowledge', token: 'receipt-123', productId: 'me.cuberoot.app.membership.monthly' })).status).toBe(200);
  expect(mocks.request.mock.calls[1][0].method).toBe('POST');
});
it('checks push audience and exact verified email, never trusts decoded JWT alone', async () => {
  mocks.verifyIdToken.mockResolvedValue({ getPayload: () => ({ email: 'other', email_verified: true }) });
  expect((await request({ operation: 'verifyPush', idToken: 'header.payload.signature' })).status).toBe(401);
  mocks.verifyIdToken.mockResolvedValue({ getPayload: () => ({ email: process.env.GOOGLE_IAP_RTDN_SERVICE_ACCOUNT, email_verified: true }) });
  expect((await request({ operation: 'verifyPush', idToken: 'header.payload.signature' })).status).toBe(200);
  expect(mocks.verifyIdToken).toHaveBeenCalledWith({ idToken: 'header.payload.signature', audience: process.env.GOOGLE_IAP_RTDN_AUDIENCE });
  expect(mocks.fromJSON).not.toHaveBeenCalled();
});
it('sanitizes upstream errors and returns retryable failure', async () => {
  mocks.request.mockRejectedValue(new Error('sensitive purchase-token credential'));
  const response = await request({ operation: 'ready' });
  expect(response.status).toBe(502);
  expect(await response.text()).not.toMatch(/sensitive|credential|purchase-token/);
});
