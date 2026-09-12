// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { APPLE_STATE_KEY, appleCanonicalEntry, consumeAppleState, rememberAppleState, rememberSocialReturnUrl, takeSocialReturnUrl } from '@/lib/social-auth';

vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => 'existing-session', getWcaToken: () => null, useAuthStore: { getState: vi.fn(() => ({ user: { uid: 42 } })) } }));

const state = 'nonce.apple.login.9999999999.signature';
const codeVerifier = 'v'.repeat(43);
const pending = JSON.stringify({ state, codeVerifier });
const authorizeUrl = `https://appleid.apple.com/auth/authorize?state=${state}`;

describe('Apple browser-bound OAuth state', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('accepts the initiating browser state once and rejects replay', () => {
    rememberAppleState(authorizeUrl, codeVerifier);
    expect(sessionStorage.getItem(APPLE_STATE_KEY)).toBe(pending);
    expect(consumeAppleState(state)).toBe(codeVerifier);
    expect(consumeAppleState(state)).toBeNull();
  });

  it('rejects an unsolicited or mismatched callback and consumes the pending state', () => {
    expect(consumeAppleState(state)).toBeNull();
    rememberAppleState(authorizeUrl, codeVerifier);
    expect(consumeAppleState('other.apple.login.9999999999.signature')).toBeNull();
    expect(consumeAppleState(state)).toBeNull();
  });

  it('does not accept a localStorage state from another tab as browser intent', () => {
    localStorage.setItem(APPLE_STATE_KEY, state);
    expect(consumeAppleState(state)).toBeNull();
  });

  it('rejects non-Apple authorization URLs and missing state before leaving the page', () => {
    for (const url of ['https://example.com/?state=' + state, 'https://appleid.apple.com/auth/authorize',
      'https://appleid.apple.com/auth/authorize?state=nonce.wechat.login.1.signature']) {
      expect(() => rememberAppleState(url, codeVerifier)).toThrow('Invalid Apple authorization URL');
    }
  });

  it('fails closed when browser storage is unavailable or silently drops writes', () => {
    const blocked = { getItem: () => { throw new Error('storage blocked'); }, removeItem: vi.fn(), setItem: vi.fn() };
    expect(() => rememberAppleState(authorizeUrl, codeVerifier, blocked)).toThrow();
    expect(consumeAppleState(state, blocked)).toBeNull();
    expect(() => rememberAppleState(authorizeUrl, codeVerifier, { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() }))
      .toThrow('Apple sign-in requires browser storage');
  });

  it('preserves the existing mobile PKCE return through the canonical social handoff', () => {
    const target = '/zh/account?auth=mobile&provider=apple&state=mobile-state&code_challenge=challenge';
    rememberSocialReturnUrl(target);
    rememberAppleState(authorizeUrl, codeVerifier);
    expect(consumeAppleState(state)).toBe(codeVerifier);
    expect(takeSocialReturnUrl()).toBe(target);
  });

  it('normalizes www to the server callback origin before storing state while preserving mobile PKCE', () => {
    const path = '/zh/account?auth=mobile&provider=apple&state=mobile&code_challenge=challenge#login';
    expect(appleCanonicalEntry('https://cuberoot.me', 'https://www.cuberoot.me' + path)).toBe('https://cuberoot.me' + path);
    expect(appleCanonicalEntry('https://cuberoot.me', 'https://cuberoot.me' + path)).toBeNull();
  });

  it('rejects malformed canonical origins and cannot turn a path into an open redirect', () => {
    for (const origin of [undefined, 'http://cuberoot.me', 'https://cuberoot.me/extra', 'https://user@cuberoot.me']) {
      expect(() => appleCanonicalEntry(origin, 'https://www.cuberoot.me/account')).toThrow();
    }
    expect(appleCanonicalEntry('https://cuberoot.me', 'https://www.cuberoot.me//evil.test/account'))
      .toBe('https://cuberoot.me//evil.test/account');
  });
});

describe('Apple API availability and exchange', () => {
  beforeEach(() => { vi.resetModules(); sessionStorage.clear(); localStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
  afterEach(() => vi.unstubAllGlobals());

  it.each([true, false, undefined, 'true'])('only enables Apple for the explicit server boolean %s', async (apple) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ apple }))));
    const { fetchAuthProviders } = await import('@/lib/account-api');
    expect((await fetchAuthProviders()).apple).toBe(apple === true);
  });

  it('keeps Apple disabled when the provider endpoint is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { fetchAuthProviders } = await import('@/lib/account-api');
    expect((await fetchAuthProviders()).apple).toBe(false);
  });

  it('uses the dedicated Apple endpoints and keeps the session token out of URLs', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ url: authorizeUrl, token: 'c'.repeat(20), user: { uid: 42, name: 'Existing', wcaId: '', avatar: '' } }))));
    vi.stubGlobal('fetch', fetcher);
    const { fetchSocialAuthorization, loginSocial, linkSocial } = await import('@/lib/account-api');
    expect(await fetchSocialAuthorization('apple', 'link', 'challenge')).toEqual({ url: authorizeUrl, siteOrigin: undefined });
    expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining('/v1/auth/apple/authorize?intent=link&codeChallenge=challenge'), { cache: 'no-store', headers: { Authorization: 'Bearer existing-session' }, signal: expect.any(AbortSignal) });
    await loginSocial('apple', 'short-code', state, codeVerifier);
    expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining('/v1/auth/apple'), expect.objectContaining({
      method: 'POST', body: JSON.stringify({ code: 'short-code', state, codeVerifier }), headers: { 'Content-Type': 'application/json' },
    }));
    await linkSocial('apple', 'short-code', state, codeVerifier);
    expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining('/v1/auth/link/apple'), expect.objectContaining({
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer existing-session' },
    }));
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes('existing-session'))).toBe(true);
    await loginSocial('wechat', 'wechat-code', 'wechat-state');
    expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining('/v1/auth/social/wechat'), expect.anything());
  });

  it.each(['login', 'link'] as const)('preserves the account boundary before cross-origin %s', async (intent) => {
    const initialHref = 'https://www.cuberoot.me/zh/account?auth=mobile&provider=apple&code_challenge=challenge';
    const location = { href: initialHref };
    vi.stubGlobal('window', { location, sessionStorage, localStorage });
    Object.assign(window, { parent: window });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: authorizeUrl, siteOrigin: 'https://cuberoot.me' }))));
    const { startSocialLogin } = await import('@/lib/social-auth');
    if (intent === 'login') {
      await expect(startSocialLogin('apple', intent)).resolves.toEqual({ navigated: true });
      expect(location.href).toBe('https://cuberoot.me/zh/account?auth=mobile&provider=apple&code_challenge=challenge');
    } else {
      await expect(startSocialLogin('apple', intent)).rejects.toThrow('Apple linking requires canonical site:');
      expect(location.href).toBe(initialHref);
    }
    expect(sessionStorage.getItem(APPLE_STATE_KEY)).toBeNull();
  });

  it('only saves state and leaves for Apple once the initiating site is canonical', async () => {
    const location = { href: 'https://cuberoot.me/zh/account?auth=mobile&provider=apple' };
    vi.stubGlobal('window', { location, sessionStorage, localStorage });
    Object.assign(window, { parent: window });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: authorizeUrl, siteOrigin: 'https://cuberoot.me' }))));
    const { startSocialLogin } = await import('@/lib/social-auth');
    await expect(startSocialLogin('apple', 'login')).resolves.toEqual({ navigated: true });
    expect(location.href).toBe(authorizeUrl);
    const saved = JSON.parse(sessionStorage.getItem(APPLE_STATE_KEY) ?? '{}') as { state: string; codeVerifier: string };
    expect(saved.state).toBe(state);
    expect(saved.codeVerifier).toHaveLength(43);
    const fetchedUrl = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(new URL(fetchedUrl, 'https://api.cuberoot.me').searchParams.get('codeChallenge'))
      .toBe(createHash('sha256').update(saved.codeVerifier).digest('base64url'));
    expect(location.href).not.toContain(saved.codeVerifier);
    expect(takeSocialReturnUrl()).toBe('https://cuberoot.me/zh/account?auth=mobile&provider=apple');
  });

  it('never starts Apple authorization directly inside an iframe', async () => {
    vi.stubGlobal('window', { parent: {}, location: { href: 'https://cuberoot.me/account' } });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { startSocialLogin } = await import('@/lib/social-auth');
    await expect(startSocialLogin('apple', 'link')).rejects.toThrow('Apple authorization requires system browser');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects an account change while the provider authorization URL is pending', async () => {
    const location = { href: 'https://cuberoot.me/account?view=signin&link_provider=apple&expected_uid=42' };
    vi.stubGlobal('window', { location, sessionStorage, localStorage });
    Object.assign(window, { parent: window });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: authorizeUrl, siteOrigin: 'https://cuberoot.me' }))));
    const { useAuthStore } = await import('@/lib/auth-store');
    vi.mocked(useAuthStore.getState).mockReturnValueOnce({ user: { uid: 42 } } as ReturnType<typeof useAuthStore.getState>)
      .mockReturnValueOnce({ user: { uid: 7 } } as ReturnType<typeof useAuthStore.getState>);
    const { startSocialLogin } = await import('@/lib/social-auth');
    await expect(startSocialLogin('apple', 'link', 42)).rejects.toThrow('account changed');
    expect(location.href).toContain('expected_uid=42');
    expect(sessionStorage.getItem(APPLE_STATE_KEY)).toBeNull();
  });

  it('cannot navigate to Apple after the user canceled the pending authorization request', async () => {
    const initialHref = 'https://cuberoot.me/account?view=signin';
    const location = { href: initialHref };
    vi.stubGlobal('window', { location, sessionStorage, localStorage });
    Object.assign(window, { parent: window });
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise((done) => { resolve = done; }));
    vi.stubGlobal('fetch', fetcher);
    const { startSocialLogin } = await import('@/lib/social-auth');
    const controller = new AbortController();
    const pending = expect(startSocialLogin('apple', 'login', undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    controller.abort();
    await pending;
    resolve(new Response(JSON.stringify({ url: authorizeUrl, siteOrigin: 'https://cuberoot.me' })));
    await Promise.resolve();
    expect(location.href).toBe(initialHref);
    expect(sessionStorage.getItem(APPLE_STATE_KEY)).toBeNull();
  });
});
