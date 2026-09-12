import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  begin: vi.fn(), complete: vi.fn(), verifySession: vi.fn(), requireUid: vi.fn(),
  sign: vi.fn(), capture: vi.fn(), login: vi.fn(), verifyCode: vi.fn(), findUser: vi.fn(), douyinExchange: vi.fn(),
  issueLinkCode: vi.fn(), previewLinkCode: vi.fn(), issueCode: vi.fn(),
}));
vi.mock('../src/db/connection.js', () => ({ query: vi.fn(), sql: {} }));
vi.mock('../src/utils/identity_choice.js', async (original) => {
  const actual = await original<typeof import('../src/utils/identity_choice.js')>();
  return { ...actual, beginIdentityLogin: mocks.begin, completeIdentityChoice: mocks.complete,
    issueIdentityLinkCode: mocks.issueLinkCode, previewIdentityLinkCode: mocks.previewLinkCode };
});
vi.mock('../src/utils/account.js', async (original) => {
  const actual = await original<typeof import('../src/utils/account.js')>();
  return { ...actual, loginWithIdentity: mocks.login, verifyCode: mocks.verifyCode, issueCode: mocks.issueCode, findUserByIdentity: mocks.findUser, publicUser: (u: unknown) => u };
});
vi.mock('../src/utils/account_device.js', () => ({ captureAccountDevice: mocks.capture }));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: mocks.requireUid }));
vi.mock('../src/utils/recon_helpers.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'test-only', signSession: mocks.sign, verifySession: mocks.verifySession }));
vi.mock('../src/utils/apple_login.js', () => ({
  appleConfigured: () => true, exchangeAppleCode: async () => ({ sub: 'subject', encryptedToken: Buffer.alloc(48), keyVersion: 1 }),
}));
vi.mock('../src/utils/google.js', () => ({ googleConfigured: () => true, verifyGoogleAssertion: () => ({ sub: 'subject', email: 'untrusted@example.test' }) }));
vi.mock('../src/utils/douyin_miniprogram.js', async (original) => ({
  ...await original<typeof import('../src/utils/douyin_miniprogram.js')>(),
  douyinMiniProgramConfigured: () => true, exchangeDouyinMiniProgramCode: mocks.douyinExchange,
}));
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
  mocks.douyinExchange.mockResolvedValue({ openid: 'douyin-subject' });
  mocks.issueLinkCode.mockResolvedValue({ linkCode: 'L42-123456', expiresInSeconds: 600 });
  mocks.previewLinkCode.mockResolvedValue({ user: { id: 42, displayName: 'Target' } });
  mocks.issueCode.mockResolvedValue({ code: '123456' });
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
    ['email', '/auth/email/verify', { email: 'unknown@example.test', code: '123456' }],
    ['phone', '/auth/phone/verify', { phone: '+8613812345678', code: '123456' }],
    ['douyin', '/auth/douyin/miniprogram', { code: 'verified-code' }],
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
  it.each([
    ['email', '/auth/email/verify', { email: 'known@example.test', code: '123456' }, 'email_code'],
    ['phone', '/auth/phone/verify', { phone: '+8613812345678', code: '123456' }, undefined],
    ['douyin', '/auth/douyin/miniprogram', { code: 'verified-code' }, undefined],
  ])('%s known identities retain direct login and their authentication grant', async (_provider, path, body, amr) => {
    mocks.begin.mockResolvedValue({ user, isNew: false });
    const response = await post(path as string, body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: 'canonical-session', user, isNew: false });
    expect(mocks.sign).toHaveBeenCalledWith({ uid: 42, wcaId: null, name: 'Target', ...(amr ? { amr } : {}) });
  });
  it.each([
    ['/auth/email/verify', { email: 'unknown@example.test', code: '123456' }],
    ['/auth/phone/verify', { phone: '+8613812345678', code: '123456' }],
  ])('%s rejects invalid proof and malformed existingOnly before issuing a choice', async (path, body) => {
    for (const malformed of [null, { ...body as object, code: 123456 }, { email: {}, phone: {}, code: '123456' }]) {
      expect((await post(path as string, malformed)).status).toBe(400);
    }
    expect((await post(path as string, { ...body as object, existingOnly: 'true' })).status).toBe(400);
    expect(mocks.verifyCode).not.toHaveBeenCalled();
    mocks.verifyCode.mockResolvedValue(false);
    expect((await post(path as string, body)).status).toBe(401);
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('phone password recovery never offers account creation and keeps its dedicated grant', async () => {
    const body = { phone: '+8613812345678', code: '123456', purpose: 'password_reset' };
    mocks.findUser.mockResolvedValue(null);
    expect((await post('/auth/phone/verify', body)).status).toBe(404);
    expect(mocks.begin).not.toHaveBeenCalled();
    mocks.findUser.mockResolvedValue(user);
    expect((await post('/auth/phone/verify', body)).status).toBe(200);
    expect(mocks.sign).toHaveBeenCalledWith({ uid: 42, wcaId: null, name: 'Target', amr: 'phone_password_reset' });
  });
  it('email account creation preserves its setup grant only when the transaction returned one', async () => {
    mocks.complete.mockResolvedValue({ user, isNew: true, amr: 'email_code' });
    expect((await post('/auth/identity/complete', { ticket, action: 'create' })).status).toBe(200);
    expect(mocks.sign).toHaveBeenLastCalledWith({ uid: 42, wcaId: null, name: 'Target', amr: 'email_code' });
    mocks.complete.mockResolvedValue({ user, isNew: false });
    expect((await post('/auth/identity/complete', { ticket, action: 'link', expectedUid: 42 }, 'jwt')).status).toBe(200);
    expect(mocks.sign).toHaveBeenLastCalledWith({ uid: 42, wcaId: null, name: 'Target' });
  });
  it('link-code issuance requires the canonical current account and returns no identity credentials', async () => {
    expect((await post('/auth/identity/link-code', {})).status).toBe(401);
    expect(mocks.issueLinkCode).not.toHaveBeenCalled();
    expect((await post('/auth/identity/link-code', { expectedUid: 99 }, 'jwt')).status).toBe(409);
    expect(mocks.issueLinkCode).not.toHaveBeenCalled();
    const response = await post('/auth/identity/link-code', { expectedUid: 42 }, 'jwt');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ linkCode: 'L42-123456', expiresInSeconds: 600 });
    expect(mocks.issueLinkCode).toHaveBeenCalledWith(42);
    mocks.issueLinkCode.mockClear();
    mocks.requireUid.mockResolvedValue(99);
    expect((await post('/auth/identity/link-code', { expectedUid: 42 }, 'jwt')).status).toBe(409);
    expect(mocks.issueLinkCode).not.toHaveBeenCalled();
  });
  it('preview returns only a proved target and does not sign a session', async () => {
    const response = await post('/auth/identity/link-code/preview', { ticket, linkCode: 'L42-123456' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: { id: 42, displayName: 'Target' } });
    expect(mocks.previewLinkCode).toHaveBeenCalledWith(ticket, 'L42-123456');
    expect(mocks.sign).not.toHaveBeenCalled();
    mocks.previewLinkCode.mockRejectedValue(new IdentityChoiceError('INVALID_IDENTITY_LINK_CODE'));
    expect((await post('/auth/identity/link-code/preview', { ticket, linkCode: 'L42-000000' })).status).toBe(400);
  });
  it('code-based linking requires the confirmed target and passes both independent proofs', async () => {
    expect((await post('/auth/identity/complete', { ticket, action: 'link_with_code', linkCode: 'L42-123456' })).status).toBe(400);
    expect(mocks.complete).not.toHaveBeenCalled();
    const response = await post('/auth/identity/complete', { ticket, action: 'link_with_code', linkCode: 'L42-123456', expectedUid: 42 });
    expect(response.status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledWith(ticket, 'link_with_code', 42, 'L42-123456');
    expect(mocks.verifySession).not.toHaveBeenCalled();
    expect(mocks.sign).toHaveBeenCalledWith({ uid: 42, wcaId: null, name: 'Target' });
  });
  it('irreversible merge rejects missing or changed displayed source before consuming the merge code', async () => {
    for (const expectedSourceUid of [undefined, 99, '42']) {
      const response = await post('/auth/account/merge', { code: '55-123456', expectedSourceUid }, 'jwt');
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'account changed; sign in again', code: 'ACCOUNT_CHANGED' });
    }
    expect(mocks.verifyCode).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('merge-code issuance binds the displayed retained account before issuing any capability', async () => {
    for (const expectedUid of [undefined, 99, '42']) {
      const response = await post('/auth/account/merge/code', { expectedUid }, 'jwt');
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'account changed; sign in again', code: 'ACCOUNT_CHANGED' });
    }
    expect(mocks.issueCode).not.toHaveBeenCalled();
    const response = await post('/auth/account/merge/code', { expectedUid: 42 }, 'jwt');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code: '42-123456', expiresInSeconds: 600 });
    expect(mocks.issueCode).toHaveBeenCalledWith('merge', '42', 'account_merge');
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
