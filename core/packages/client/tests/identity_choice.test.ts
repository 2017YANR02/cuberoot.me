// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountChoiceRequired, accountChoiceError, clearIdentityChoice, existingAccountRequired, getIdentityChoice, identityReturnPath, rememberIdentityChoice, updateIdentityChoice } from '@/lib/identity-choice';
import { decodeIdentityChoicePending } from '@cuberoot/shared/auth/web-session';
import { completeIdentityChoice, issueAccountMergeCode, issueIdentityLinkCode, loginGoogle, mergeAccount, startWechatBrowserLogin, verifyEmailCode, verifyPhoneCode } from '@/lib/account-api';

vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => 'existing-canonical-session' }));
const ticket = 'a'.repeat(43);
const envelope = { code: 'ACCOUNT_CHOICE_REQUIRED', pending: { ticket, provider: 'apple', expiresInSeconds: 900 } };
const choice = () => new AccountChoiceRequired({ ticket, provider: 'apple', expiresInSeconds: 900 });
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); clearIdentityChoice(); window.history.replaceState({}, '', '/account'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); clearIdentityChoice(); });

describe('first identity account choice boundary', () => {
  it('decodes a verified WeChat phone target without leaking extra profile fields', () => {
    const pending = { ...envelope.pending, provider: 'wechat', phoneAccount: { id: 42, displayName: 'Existing', phone: 'private' } };
    expect(decodeIdentityChoicePending({ ...envelope, pending })?.phoneAccount).toEqual({ id: 42, displayName: 'Existing' });
  });
  it.each([null, [], {}, { id: 0, displayName: 'A' }, { id: '42', displayName: 'A' },
    { id: 42, displayName: 'bad\nname' }, { id: 42, displayName: 'a'.repeat(201) },
  ])('rejects malformed verified phone targets (%j)', (phoneAccount) => {
    expect(decodeIdentityChoicePending({ ...envelope, pending: { ...envelope.pending, provider: 'wechat', phoneAccount } })).toBeNull();
  });
  it('does not accept a phone target for other providers', () => {
    expect(decodeIdentityChoicePending({ ...envelope, pending: { ...envelope.pending, phoneAccount: { id: 42, displayName: '' } } })).toBeNull();
  });
  it.each(['apple', 'google', 'wechat', 'qq', 'alipay', 'wca', 'email', 'phone', 'douyin'])('accepts only a validated server 409 for %s', (provider) => {
    expect(accountChoiceError(409, { ...envelope, pending: { ...envelope.pending, provider } })).toBeInstanceOf(AccountChoiceRequired);
    expect(accountChoiceError(400, envelope)).toBeNull();
  });
  it.each([{ ticket: 'short' }, { provider: 'evil' }, { expiresInSeconds: 901 }, { expiresInSeconds: 0 }])('rejects malformed pending (%j)', (fields) => {
    expect(accountChoiceError(409, { ...envelope, pending: { ...envelope.pending, ...fields } })).toBeNull();
  });
  it('keeps the first identity and original mobile PKCE return when a second provider is unknown', () => {
    const original = '/account?auth=mobile&provider=apple&next=%2Fauth%2Fmobile%3FcodeChallenge%3Doriginal';
    rememberIdentityChoice(choice(), original);
    updateIdentityChoice(ticket, { stage: 'authenticate' });
    rememberIdentityChoice(new AccountChoiceRequired({ ticket: 'b'.repeat(43), provider: 'google', expiresInSeconds: 900 }), '/account?next=wrong');
    expect(getIdentityChoice()).toMatchObject({ ticket, returnPath: original, stage: 'authenticate', otherIdentityRejected: true });
    expect(existingAccountRequired()).toBe(true);
    expect(localStorage.length).toBe(0);
    expect(window.location.href).not.toContain(ticket);
  });
  it('expires and permits a fresh attempt without retaining the old identity', () => {
    vi.useFakeTimers();
    rememberIdentityChoice(choice(), '/account');
    vi.advanceTimersByTime(900_001);
    expect(getIdentityChoice()).toBeNull();
    rememberIdentityChoice(new AccountChoiceRequired({ ticket: 'b'.repeat(43), provider: 'wca', expiresInSeconds: 900 }), '/recon');
    clearIdentityChoice(ticket);
    expect(getIdentityChoice()?.ticket).toBe('b'.repeat(43));
    clearIdentityChoice();
    expect(getIdentityChoice()).toBeNull();
  });
  it.each(['https://evil.example/path', '//evil.example', '/auth/callback#access_token=secret', '/auth/social/callback?code=secret'])('does not retain an unsafe return path %s', (path) => {
    expect(identityReturnPath(path)).toBe('/account');
  });
  it('does not accept malformed persisted confirmation without an expected UID', () => {
    sessionStorage.setItem('cuberoot_pending_identity', JSON.stringify({ ticket, provider: 'apple', expiresAt: Date.now() + 60_000, returnPath: '/account', stage: 'confirm' }));
    expect(getIdentityChoice()).toBeNull();
  });
  it('propagates the typed response without applying a session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), { status: 409 })));
    await expect(loginGoogle('assertion')).rejects.toBeInstanceOf(AccountChoiceRequired);
    expect(getIdentityChoice()).toBeNull();
  });
  it('limits email, phone and mini-browser authentication to existing accounts while linking', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ token: 'c'.repeat(20), user: { uid: 42, wcaId: '', name: 'Existing', avatar: '' } })));
    vi.stubGlobal('fetch', fetcher);
    rememberIdentityChoice(choice(), '/account');
    updateIdentityChoice(ticket, { stage: 'authenticate' });
    await verifyEmailCode('me@example.test', '123456');
    await verifyPhoneCode('13800138000', '123456');
    await startWechatBrowserLogin();
    expect(fetcher.mock.calls.map((call) => JSON.parse(call[1].body).existingOnly)).toEqual([true, true, true]);
    clearIdentityChoice();
    await verifyEmailCode('me@example.test', '123456');
    expect(JSON.parse(fetcher.mock.calls[3][1].body)).not.toHaveProperty('existingOnly');
  });
  it('sends expected UID and authenticated session only for explicit linking', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ token: 'c'.repeat(20), user: { uid: 42, wcaId: '', name: 'Existing', avatar: '' } })));
    vi.stubGlobal('fetch', fetcher);
    await completeIdentityChoice(ticket, 'link', 42);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ ticket, action: 'link', expectedUid: 42 });
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer existing-canonical-session');
    await completeIdentityChoice(ticket, 'create');
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });
  it('binds linking-code issuance and destructive merging to the confirmed account', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetcher);
    await issueIdentityLinkCode(42);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ expectedUid: 42 });
    await mergeAccount('99-123456', 42);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ code: '99-123456', expectedSourceUid: 42 });
    expect(fetcher.mock.calls.every((call) => call[1].headers.Authorization === 'Bearer existing-canonical-session')).toBe(true);
    await issueAccountMergeCode(42);
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ expectedUid: 42 });
  });
  it('uses existing-only verification for email password recovery without a pending choice', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ token: 'c'.repeat(20), user: { uid: 42, wcaId: '', name: 'Existing', avatar: '' } })));
    vi.stubGlobal('fetch', fetcher);
    await verifyEmailCode('existing@example.test', '123456', { existingOnly: true });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ email: 'existing@example.test', code: '123456', existingOnly: true });
  });
  it.each(['email', 'phone'] as const)('propagates verified unknown %s as a choice, not a session', async (provider) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...envelope, pending: { ...envelope.pending, provider } }), { status: 409 })));
    const request = provider === 'email' ? verifyEmailCode('new@example.test', '123456') : verifyPhoneCode('13800138000', '123456');
    await expect(request).rejects.toMatchObject({ pending: { provider } });
    expect(getIdentityChoice()).toBeNull();
  });
  it('rejects completion without a canonical UID instead of installing a legacy-shaped session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'c'.repeat(20), user: { wcaId: '', name: 'Missing UID', avatar: '' } }))));
    await expect(completeIdentityChoice(ticket, 'create')).rejects.toThrow('invalid account session');
  });
  it('rejects a late existing-account response after the choice is canceled', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise((done) => { resolve = done; })));
    rememberIdentityChoice(choice(), '/account'); updateIdentityChoice(ticket, { stage: 'authenticate' });
    const request = verifyEmailCode('existing@example.test', '123456');
    clearIdentityChoice(); resolve(new Response(JSON.stringify({ token: 'late', user: { uid: 42 } })));
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
