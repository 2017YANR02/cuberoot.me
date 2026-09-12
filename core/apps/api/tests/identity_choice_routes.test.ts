import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  begin: vi.fn(), complete: vi.fn(), verifySession: vi.fn(), requireUid: vi.fn(),
  sign: vi.fn(), capture: vi.fn(), login: vi.fn(), verifyCode: vi.fn(),
}));
vi.mock('../src/db/connection.js', () => ({ query: vi.fn(), sql: {} }));
vi.mock('../src/utils/identity_choice.js', async (original) => {
  const actual = await original<typeof import('../src/utils/identity_choice.js')>();
  return { ...actual, beginIdentityLogin: mocks.begin, completeIdentityChoice: mocks.complete };
});
vi.mock('../src/utils/account.js', async (original) => {
  const actual = await original<typeof import('../src/utils/account.js')>();
  return { ...actual, loginWithIdentity: mocks.login, verifyCode: mocks.verifyCode, publicUser: (u: unknown) => u };
});
vi.mock('../src/utils/account_device.js', () => ({ captureAccountDevice: mocks.capture }));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: mocks.requireUid }));
vi.mock('../src/utils/recon_helpers.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'test-only', signSession: mocks.sign, verifySession: mocks.verifySession }));
vi.mock('../src/utils/apple_login.js', () => ({
  appleConfigured: () => true, exchangeAppleCode: async () => ({ sub: 'subject', encryptedToken: Buffer.alloc(48), keyVersion: 1 }),
}));
vi.mock('../src/utils/google.js', () => ({ googleConfigured: () => true, verifyGoogleAssertion: () => ({ sub: 'subject', email: 'untrusted@example.test' }) }));
vi.mock('../src/utils/social_login.js', () => ({
  isSocialProvider: (p: string) => ['wechat', 'qq', 'alipay'].includes(p),
  socialLoginConfigured: () => true, verifySocialState: () => ({ intent: 'login' }),
  exchangeSocialCode: async () => ({ sub: 'subject', name: '' }),
}));
import { accountAuthRoutes } from '../src/routes/account_auth.js';
import { authRoutes } from '../src/routes/auth.js';
import { IdentityChoiceError } from '../src/utils/identity_choice.js';
import { IdentityNotFoundError } from '../src/utils/account.js';
const app = new Hono().route('/v1', accountAuthRoutes).route('/v1', authRoutes);
const ticket = 'A'.repeat(43);
const user = { id: 42, display_name: 'Target', wca_id: null };
const choice = { code: 'ACCOUNT_CHOICE_REQUIRED', error: 'Choose an account', pending: { ticket, provider: 'google', expiresInSeconds: 900 } };
function post(path: string, body: unknown, token?: string) {
  return app.request('/v1' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.begin.mockResolvedValue(choice);
  mocks.complete.mockResolvedValue({ user, isNew: false });
  mocks.verifySession.mockReturnValue({ uid: 42 });
  mocks.requireUid.mockResolvedValue(42);
  mocks.sign.mockReturnValue('canonical-session');
  mocks.verifyCode.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllGlobals());

describe('unified provider account-choice routes', () => {
  it.each([
    ['apple', '/auth/apple', { code: 'code', state: 'state', codeVerifier: 'verifier' }],
    ['google', '/auth/google', { assertion: 'assertion' }],
    ['wechat', '/auth/social/wechat', { code: 'code', state: 'state' }],
    ['qq', '/auth/social/qq', { code: 'code', state: 'state' }],
    ['alipay', '/auth/social/alipay', { code: 'code', state: 'state' }],
    ['wca', '/auth/exchange', { accessToken: 'verified-wca-token' }],
  ])('%s returns an opaque 409 choice without issuing or capturing a session', async (provider, path, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ me: { wca_id: '2017TEST01', name: 'Name', avatar: {} } })));
    const response = await post(path as string, body);
    expect(response.status).toBe(409);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(choice);
    expect(mocks.begin).toHaveBeenCalledWith(expect.objectContaining({ provider }));
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it('legacy WCA callback returns a noncached choice instead of creating or redirecting with a session', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'wca-only', refresh_token: 'wca-refresh', expires_in: 600 }))
      .mockResolvedValueOnce(Response.json({ me: { wca_id: '2017TEST01', name: 'Name', avatar: {} } })));
    const response = await app.request('/v1/auth/callback?code=code');
    expect(response.status).toBe(409);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('explicit create needs the pending credential but not an existing session', async () => {
    mocks.complete.mockResolvedValue({ user, isNew: true });
    const response = await post('/auth/identity/complete', { ticket, action: 'create' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: 'canonical-session', user, isNew: true });
    expect(mocks.complete).toHaveBeenCalledWith(ticket, 'create', undefined);
    expect(mocks.verifySession).not.toHaveBeenCalled();
  });
  it('link requires a canonical Bearer and exact expected uid; account switch never consumes the pending ticket', async () => {
    expect((await post('/auth/identity/complete', { ticket, action: 'link', expectedUid: 42 })).status).toBe(401);
    expect((await post('/auth/identity/complete', { ticket, action: 'link', expectedUid: 43 }, 'jwt')).status).toBe(409);
    mocks.requireUid.mockResolvedValue(99);
    expect((await post('/auth/identity/complete', { ticket, action: 'link', expectedUid: 42 }, 'jwt')).status).toBe(409);
    expect(mocks.complete).not.toHaveBeenCalled();
    mocks.requireUid.mockResolvedValue(42);
    expect((await post('/auth/identity/complete', { ticket, action: 'link', expectedUid: 42 }, 'jwt')).status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledWith(ticket, 'link', 42);
  });
  it('rejects raw WCA Bearer tokens and malformed actions before any consumption', async () => {
    mocks.verifySession.mockImplementation(() => { throw new Error('not canonical'); });
    expect((await post('/auth/identity/complete', { ticket, action: 'link', expectedUid: 42 }, 'raw-wca')).status).toBe(401);
    expect((await post('/auth/identity/complete', { ticket, action: 'merge' })).status).toBe(400);
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it('returns stable expired/conflict responses and hides database failures', async () => {
    mocks.complete.mockRejectedValue(new IdentityChoiceError('INVALID_IDENTITY_TICKET'));
    expect((await post('/auth/identity/complete', { ticket, action: 'create' })).status).toBe(401);
    mocks.complete.mockRejectedValue(new IdentityChoiceError('IDENTITY_CONFLICT'));
    expect((await post('/auth/identity/complete', { ticket, action: 'link', expectedUid: 42 }, 'jwt')).status).toBe(409);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.complete.mockRejectedValue(new Error('sensitive SQL subject'));
    const response = await post('/auth/identity/complete', { ticket, action: 'create' });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'account service unavailable; please retry' });
    expect(log).toHaveBeenCalledWith('[auth] identity completion failed');
    log.mockRestore();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it.each([
    ['email', '/auth/email/verify', { email: 'known@example.test', code: '123456' }],
    ['phone', '/auth/phone/verify', { phone: '+8613812345678', code: '123456' }],
  ])('%s existingOnly verification never falls through to account creation', async (_provider, path, body) => {
    mocks.login.mockRejectedValue(new IdentityNotFoundError());
    const response = await post(path as string, { ...body as object, existingOnly: true });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'account not found' });
    expect(mocks.login.mock.calls[0][4]).toEqual({ createIfMissing: false });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
