import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ exchange: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/web-session', () => ({ getWebAccessToken: mocks.exchange }));
vi.mock('@/lib/api-base', () => ({
  apiUrl: (path: string) => `https://api.cuberoot.me${path}`,
  directApiUrl: (path: string) => `https://api.cuberoot.me${path}`,
}));
import { sessionFetch } from '@/lib/session-fetch';

beforeEach(() => {
  mocks.exchange.mockReset().mockResolvedValue('short-access');
  mocks.fetch.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe('web session fetch boundary', () => {
  it('preserves public requests and existing native/preview bearer credentials', async () => {
    const publicInit = { signal: new AbortController().signal };
    await sessionFetch('https://static.cuberoot.me/stats/a.json', publicInit);
    expect(mocks.fetch).toHaveBeenLastCalledWith('https://static.cuberoot.me/stats/a.json', publicInit);
    const nativeInit = { headers: { Authorization: 'Bearer native-session' }, method: 'POST', body: '{}' };
    await sessionFetch('https://api.cuberoot.me/v1/auth/me', nativeInit);
    expect(mocks.fetch).toHaveBeenLastCalledWith('https://api.cuberoot.me/v1/auth/me', nativeInit);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('exchanges the captured generation and preserves Request body, headers and signal', async () => {
    const controller = new AbortController();
    const request = new Request('https://api.cuberoot.me/v1/forum/posts', {
      method: 'POST', body: 'payload', signal: controller.signal,
      headers: { Authorization: 'Bearer old', 'X-Request-ID': 'keep', 'Content-Type': 'text/plain' },
    });
    await sessionFetch(request, { headers: { authorization: 'Bearer web-session:account-a', 'X-Extra': 'extra' } });
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith('web-session:account-a');
    const [input, init] = mocks.fetch.mock.calls[0];
    expect(input).toBe(request);
    expect(request.method).toBe('POST');
    expect(await request.clone().text()).toBe('payload');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer short-access');
    expect(new Headers(init.headers).get('X-Request-ID')).toBe('keep');
    expect(new Headers(init.headers).get('X-Extra')).toBe('extra');
    expect(new Headers(init.headers).get('Content-Type')).toBe('text/plain');
    expect(init.redirect).toBe('error');
    expect(request.headers.get('Authorization')).toBe('Bearer old');
  });

  it.each([
    'https://attacker.example/v1/auth/me',
    'https://api.cuberoot.me.attacker.example/v1/auth/me',
    'https://api.cuberoot.me/other',
    'https://user:password@api.cuberoot.me/v1/auth/me',
    'http://api.cuberoot.me/v1/auth/me',
  ])('rejects untrusted marker target %s before exchanging or sending', async (url) => {
    await expect(sessionFetch(url, { headers: { Authorization: 'Bearer web-session:a' } })).rejects.toThrow('outside');
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('allows only explicitly configured same-origin private page endpoints', async () => {
    vi.stubGlobal('window', { location: { href: 'https://www.cuberoot.me/account', origin: 'https://www.cuberoot.me' } });
    await sessionFetch('/api/identity-choice', {
      method: 'POST', headers: { Authorization: 'Bearer web-session:a' }, body: '{}',
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(new Headers(mocks.fetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer web-session:a');
    expect(new Headers(mocks.fetch.mock.calls[0][1].headers).get('X-Web-Session')).toBe('a');
    expect(new Headers(mocks.fetch.mock.calls[0][1].headers).get('X-Web-Session-Embedded')).toBe('1');
    expect(mocks.fetch.mock.calls[0][1].credentials).toBe('same-origin');
    await expect(sessionFetch('/api/unrelated', {
      headers: { Authorization: 'Bearer web-session:a' },
    })).rejects.toThrow('outside');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts while a shared exchange is pending without sending the mutation', async () => {
    let finish!: (token: string) => void;
    mocks.exchange.mockReturnValue(new Promise<string>(resolve => { finish = resolve; }));
    const controller = new AbortController();
    const result = sessionFetch('https://api.cuberoot.me/v1/forum/posts', {
      method: 'POST', headers: { Authorization: 'Bearer web-session:a' }, signal: controller.signal, body: '{}',
    });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    finish('short-access');
    await Promise.resolve();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('does not exchange an already cancelled request or retry a failed write', async () => {
    await expect(sessionFetch('https://api.cuberoot.me/v1/forum/posts', {
      headers: { Authorization: 'Bearer web-session:a' }, signal: AbortSignal.abort(),
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(mocks.exchange).not.toHaveBeenCalled();
    mocks.fetch.mockRejectedValue(new TypeError('network failed'));
    await expect(sessionFetch('https://api.cuberoot.me/v1/forum/posts', {
      method: 'POST', headers: { Authorization: 'Bearer web-session:a' }, body: '{}',
    })).rejects.toThrow('network failed');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('bridges account writes with the cookie generation and preserves Request data', async () => {
    const browser = { location: { href: 'https://www.cuberoot.me/account', origin: 'https://www.cuberoot.me' }, parent: null as unknown };
    browser.parent = browser;
    vi.stubGlobal('window', browser);
    const controller = new AbortController();
    const request = new Request('https://api.cuberoot.me/v1/auth/identity/link-code?mode=1', {
      method: 'POST', body: '{"expectedUid":42}', signal: controller.signal,
      headers: { Authorization: 'Bearer web-session:a', 'Content-Type': 'application/json', 'X-Keep': 'yes' },
    });
    await sessionFetch(request, { headers: { 'X-Extra': 'also' } });
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith('web-session:a');
    const bridged = mocks.fetch.mock.calls[0][0] as Request;
    expect(bridged.url).toBe('https://www.cuberoot.me/api/web-session/account/identity/link-code?mode=1');
    expect(bridged.method).toBe('POST');
    expect(await bridged.text()).toBe('{"expectedUid":42}');
    expect(bridged.headers.get('Authorization')).toBeNull();
    expect(bridged.headers.get('X-Web-Session')).toBe('a');
    expect(bridged.headers.get('X-Web-Session-Embedded')).toBeNull();
    expect(bridged.headers.get('X-Keep')).toBe('yes');
    expect(bridged.headers.get('X-Extra')).toBe('also');
    expect(bridged.credentials).toBe('same-origin');
    expect(bridged.redirect).toBe('error');
    controller.abort();
    expect(bridged.signal.aborted).toBe(true);
  });

  it('pins a mutable URL before awaiting the token exchange', async () => {
    let finish!: (token: string) => void;
    mocks.exchange.mockReturnValue(new Promise<string>(resolve => { finish = resolve; }));
    const url = new URL('https://api.cuberoot.me/v1/forum/posts');
    const response = sessionFetch(url, { headers: { Authorization: 'Bearer web-session:a' } });
    url.hostname = 'attacker.example';
    finish('short-access');
    await response;
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://api.cuberoot.me/v1/forum/posts');
  });

  it('rejects an exchange that returns another marker instead of a credential', async () => {
    mocks.exchange.mockResolvedValue('web-session:other');
    await expect(sessionFetch('https://api.cuberoot.me/v1/auth/me', {
      headers: { Authorization: 'Bearer web-session:a' },
    })).rejects.toThrow('access token');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
