import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appleConfigured: vi.fn(), appleAuthorize: vi.fn(), appleCallbackUrl: vi.fn(), exchangeAppleCode: vi.fn(),
  loginWithIdentity: vi.fn(), addIdentity: vi.fn(),
  getIdentities: vi.fn(), requireAppUserId: vi.fn(), captureAccountDevice: vi.fn(), signSession: vi.fn(),
}));
vi.mock('../src/db/connection.js', () => ({ query: vi.fn(), sql: {} }));
vi.mock('../src/utils/apple_login.js', () => ({ ...mocks, AppleLoginError: class extends Error {
  constructor(public code: string) { super(code); }
} }));
vi.mock('../src/utils/account.js', () => ({ ...mocks, publicUser: (user: unknown) => user }));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: mocks.requireAppUserId }));
vi.mock('../src/utils/account_device.js', () => ({ captureAccountDevice: mocks.captureAccountDevice }));
vi.mock('../src/utils/recon_helpers.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'test-state-secret', signSession: mocks.signSession }));
import { accountAuthRoutes } from '../src/routes/account_auth.js';

const app = new Hono().route('/v1', accountAuthRoutes);
const user = { id: 42, display_name: 'Tester', wca_id: null };
const credential = { sub: 'apple-test-sub', encryptedToken: Buffer.from('encrypted-only'), keyVersion: 1 };
function request(path: string, body: unknown = { code: 'code', state: 'signed-state', codeVerifier: 'test-verifier' }) {
  return app.request(`/v1${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.appleConfigured.mockReturnValue(true);
  mocks.exchangeAppleCode.mockResolvedValue(credential);
  mocks.loginWithIdentity.mockResolvedValue({ user, isNew: true });
  mocks.addIdentity.mockResolvedValue('ok');
  mocks.getIdentities.mockResolvedValue([{ provider: 'apple', providerUid: credential.sub }]);
  mocks.requireAppUserId.mockResolvedValue(42);
  mocks.signSession.mockReturnValue('canonical-cuberoot-session');
});

describe('canonical Apple account endpoints', () => {
  it('binds link authorization to the authenticated account but leaves login public', async () => {
    mocks.appleAuthorize.mockReturnValue({ url: 'https://appleid.apple.com/auth/authorize', state: 'state', siteOrigin: 'https://cuberoot.me' });
    expect((await app.request('/v1/auth/apple/authorize?intent=link&codeChallenge=challenge')).status).toBe(200);
    expect(mocks.requireAppUserId).toHaveBeenCalledOnce();
    expect(mocks.appleAuthorize).toHaveBeenLastCalledWith('link', 'challenge', 42);
    mocks.requireAppUserId.mockClear();
    expect((await app.request('/v1/auth/apple/authorize?codeChallenge=challenge')).status).toBe(200);
    expect(mocks.requireAppUserId).not.toHaveBeenCalled();
    expect(mocks.appleAuthorize).toHaveBeenLastCalledWith('login', 'challenge', undefined);
  });
  it('fails closed before account/token work when unconfigured', async () => {
    mocks.appleConfigured.mockReturnValue(false);
    const response = await request('/auth/apple');
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.exchangeAppleCode).not.toHaveBeenCalled();
    expect(mocks.loginWithIdentity).not.toHaveBeenCalled();
  });
  it('uses existing account/session shape and stores the encrypted credential before issuing a session', async () => {
    const response = await request('/auth/apple');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: 'canonical-cuberoot-session', user, isNew: true });
    expect(mocks.loginWithIdentity).toHaveBeenCalledWith('apple', credential.sub, { name: '' }, credential, { createIfMissing: false });
    expect(mocks.loginWithIdentity.mock.invocationCallOrder[0]).toBeLessThan(mocks.signSession.mock.invocationCallOrder[0]);
    expect(mocks.exchangeAppleCode).toHaveBeenCalledWith('code', 'signed-state', 'login', 'test-verifier', undefined);
  });
  it('links to authenticated uid and refuses identity conflict without overwriting credential', async () => {
    mocks.addIdentity.mockResolvedValue('conflict');
    expect((await request('/auth/link/apple')).status).toBe(409);
    expect(mocks.requireAppUserId).toHaveBeenCalledOnce();
    expect(mocks.exchangeAppleCode).toHaveBeenCalledWith('code', 'signed-state', 'link', 'test-verifier', 42);
    expect(mocks.addIdentity).toHaveBeenCalledWith(42, 'apple', credential.sub, undefined, undefined, undefined, undefined, credential);
    expect(mocks.signSession).not.toHaveBeenCalled();
  });
  it('rejects malformed request and limits large bodies', async () => {
    expect((await request('/auth/apple', { code: 42, state: [] })).status).toBe(400);
    expect((await request('/auth/apple', { code: 'x'.repeat(5000), state: '' })).status).toBe(413);
    expect(mocks.exchangeAppleCode).not.toHaveBeenCalled();
  });
  it('only relays form_post through the fixed callback without logging in before browser state verification', async () => {
    mocks.appleCallbackUrl.mockReturnValue('https://cuberoot.me/auth/social/callback?state=s&code=c');
    const response = await app.request('/v1/auth/apple/callback', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ state: 's', code: 'c' }),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.loginWithIdentity).not.toHaveBeenCalled();
    expect((await request('/auth/apple/callback')).status).toBe(400);
  });
});
