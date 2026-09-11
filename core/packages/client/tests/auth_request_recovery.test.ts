// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthProviders, fetchIdentities, fetchSocialAuthorization, linkSocial, loginPassword, loginSocial } from '@/lib/account-api';
import { socialCallbackReturnPath, takeSocialReturnUrl } from '@/lib/social-auth';

vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => 'session', getWcaToken: () => null }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('bounded account authentication requests', () => {
  it.each([
    () => fetchSocialAuthorization('apple', 'login', 'challenge'),
    () => loginSocial('apple', 'code', 'state', 'verifier'),
    () => linkSocial('apple', 'code', 'state', 'verifier'),
    () => loginPassword('test@example.com', 'not-a-real-password'),
    () => fetchIdentities(),
  ])('times out a hung request without retrying a mutation', async (request) => {
    const fetcher = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const pending = expect(request()).rejects.toThrow('Request timed out');
    await vi.advanceTimersByTimeAsync(12_000);
    await pending;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a stalled response body, not just receipt of headers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) }));
    const pending = expect(loginSocial('apple', 'code', 'state', 'verifier')).rejects.toThrow('Request timed out');
    await vi.advanceTimersByTimeAsync(12_000);
    await pending;
  });

  it('keeps unavailable Apple disabled after provider discovery times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    const pending = fetchAuthProviders();
    await vi.advanceTimersByTimeAsync(12_000);
    expect((await pending).apple).toBe(false);
  });

  it('aborts on user cancellation and releases its deadline timer', async () => {
    const fetcher = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const pending = expect(loginSocial('apple', 'code', 'state', 'verifier', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await pending;
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not dispatch a previously canceled request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(linkSocial('apple', 'code', 'state', 'verifier', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([401, 503])('does not turn identity load HTTP %s into an empty account', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    await expect(fetchIdentities()).rejects.toThrow('Could not load account details');
  });
});

describe('safe callback recovery destinations', () => {
  const here = 'https://cuberoot.me/auth/social/callback?code=private';
  it.each(['https://evil.example/account', '//evil.example', 'https://cuberoot.me//evil.example', '/auth/social/callback?code=old', '/auth/mobile/callback'])('rejects unsafe destination %s', (target) => {
    expect(socialCallbackReturnPath(target, here)).toBe('/');
  });
  it('retains the native login or independent linking context in a local account URL', () => {
    const path = '/zh/account?auth=mobile&provider=apple&state=pending&code_challenge=challenge';
    expect(socialCallbackReturnPath(path, here)).toBe(path);
  });
  it('does not throw when browser storage property access itself is blocked', () => {
    vi.stubGlobal('window', {
      get sessionStorage() { throw new Error('blocked'); },
      get localStorage() { throw new Error('blocked'); },
    });
    expect(takeSocialReturnUrl()).toBeNull();
  });
});
