import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  InstalledAuthClient,
  type MobileAuthRuntime,
  type MobileAuthStorage,
} from './installed-auth';

const NOW = Date.UTC(2026, 7, 28);
const TICKET = 'T'.repeat(43);

const USER = {
  uid: 42,
  wcaId: '2017YANR02',
  name: 'CubeRoot User',
  avatar: '',
  avatarSource: 'auto' as const,
  avatarPreset: null,
  isAdmin: false,
};

function token(expiresAt = NOW + 90 * 24 * 60 * 60 * 1000): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(expiresAt / 1000) }))
    .toString('base64url');
  return `header.${payload}.signature-value-long-enough`;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

class MemoryStorage implements MobileAuthStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  async removeItem(key: string) {
    this.values.delete(key);
  }
}

function setup(fetcher = vi.fn<typeof fetch>()) {
  const storage = new MemoryStorage();
  const openBrowser = vi.fn(async (_url: string) => undefined);
  const closeBrowser = vi.fn(async () => undefined);
  let randomSeed = 1;
  const runtime: MobileAuthRuntime = {
    closeBrowser,
    fetcher,
    getAppId: async () => 'me.cuberoot.app',
    now: () => NOW,
    openBrowser,
    randomBytes(length) {
      return Uint8Array.from({ length }, () => randomSeed++ % 256);
    },
    async digestSha256(value) {
      return new Uint8Array(createHash('sha256').update(value).digest());
    },
    storage,
  };
  return { client: new InstalledAuthClient(runtime), closeBrowser, fetcher, openBrowser, storage };
}

describe('mobile auth', () => {
  it('installs a first-party API session in secure storage without opening Browser', async () => {
    const { client, fetcher, openBrowser, storage } = setup();
    await client.start('en', 'apple');
    openBrowser.mockClear();
    const session = { token: token(), user: USER };
    await expect(client.installCredentialSession(session, () => true)).resolves.toEqual(session);
    expect(JSON.parse(storage.values.get('session')!)).toEqual(session);
    expect(storage.values.has('pending_auth')).toBe(false);
    expect(openBrowser).not.toHaveBeenCalled();
    fetcher.mockResolvedValueOnce(response({ user: USER }));
    await expect(client.restore()).resolves.toEqual(session);
  });

  it('starts the shared website flow without putting the verifier in the URL', async () => {
    const { client, openBrowser, storage } = setup();

    await client.start('zh');

    const opened = new URL(openBrowser.mock.calls[0][0]);
    const pending = JSON.parse(storage.values.get('pending_auth') ?? '{}') as {
      codeVerifier: string;
      state: string;
    };
    expect(opened.origin).toBe('https://cuberoot.me');
    expect(opened.pathname).toBe('/auth/mobile');
    expect(opened.searchParams.get('callback_url')).toBe('me.cuberoot.app://auth/callback');
    expect(opened.searchParams.get('lang')).toBe('zh');
    expect(opened.searchParams.get('state')).toBe(pending.state);
    expect(opened.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(pending.codeVerifier).digest('base64url'),
    );
    expect(opened.toString()).not.toContain(pending.codeVerifier);
  });

  it('preserves an explicitly requested website provider in the browser handoff', async () => {
    const { client, openBrowser } = setup();

    await client.start('zh', 'wechat');

    const opened = new URL(openBrowser.mock.calls[0][0]);
    expect(opened.searchParams.get('provider')).toBe('wechat');
  });

  it('reopens an unfinished login without invalidating its callback state', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({ token: token(), user: USER }),
    );
    const { client, openBrowser, storage } = setup(fetcher);

    await client.start('zh');
    const first = new URL(openBrowser.mock.calls[0][0]);
    const pending = storage.values.get('pending_auth');
    await client.start('zh', 'wechat');
    const second = new URL(openBrowser.mock.calls[1][0]);

    expect(second.searchParams.get('state')).toBe(first.searchParams.get('state'));
    expect(second.searchParams.get('code_challenge')).toBe(first.searchParams.get('code_challenge'));
    expect(second.searchParams.get('provider')).toBe('wechat');
    expect(storage.values.get('pending_auth')).toBe(pending);
    await expect(client.finish(
      `me.cuberoot.app://auth/callback?ticket=${TICKET}&state=${first.searchParams.get('state')}`,
    )).resolves.toMatchObject({ user: USER });
  });

  it('exchanges a matching callback and stores the canonical session', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({ token: token(), user: USER }),
    );
    const { client, closeBrowser, openBrowser, storage } = setup(fetcher);
    await client.start('en');
    const authUrl = new URL(openBrowser.mock.calls[0][0]);
    const state = authUrl.searchParams.get('state');

    const session = await client.finish(
      `me.cuberoot.app://auth/callback?ticket=${TICKET}&state=${state}`,
    );

    expect(session?.user.uid).toBe(42);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://api.cuberoot.me/v1/auth/mobile-session/exchange',
    );
    const init = fetcher.mock.calls[0][1] as RequestInit;
    const request = JSON.parse(String(init.body)) as { ticket: string; codeVerifier: string };
    expect(request.ticket).toBe(TICKET);
    expect(request.codeVerifier).toHaveLength(43);
    expect(storage.values.has('pending_auth')).toBe(false);
    expect(JSON.parse(storage.values.get('session') ?? '{}').user.uid).toBe(42);
    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });

  it('rejects a callback with the wrong state before contacting the API', async () => {
    const { client, fetcher } = setup();
    await client.start('en');

    await expect(client.finish(
      `me.cuberoot.app://auth/callback?ticket=${TICKET}&state=${'S'.repeat(43)}`,
    )).rejects.toThrow('mobile auth state mismatch');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports missing pending state without exchanging a ticket', async () => {
    const { client, fetcher } = setup();
    await expect(client.finish(
      `me.cuberoot.app://auth/callback?ticket=${TICKET}&state=${'S'.repeat(43)}`,
    )).rejects.toThrow('mobile auth request unavailable');
    expect(fetcher).not.toHaveBeenCalled();
    await expect(client.finish('https://cuberoot.me/account')).resolves.toBeNull();
  });

  it('ignores a completed callback redelivered by the native launch URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ token: token(), user: USER }));
    const { client, openBrowser, storage } = setup(fetcher);
    await client.start('zh');
    const state = new URL(openBrowser.mock.calls[0][0]).searchParams.get('state');
    const callback = `me.cuberoot.app://auth/callback?ticket=${TICKET}&state=${state}`;
    await expect(client.finish(callback)).resolves.toMatchObject({ user: USER });
    const stored = storage.values.get('session');
    await expect(client.finish(callback)).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(storage.values.get('session')).toBe(stored);
    await client.logout();
    await expect(client.finish(callback)).resolves.toBeNull();
    expect(storage.values.has('session')).toBe(false);
  });

  it('only writes a validated session when its profile changes', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ user: USER }))
      .mockResolvedValueOnce(response({ user: { ...USER, name: 'Updated' } }));
    const { storage, client } = setup(fetcher);
    storage.values.set('session', JSON.stringify({ token: token(), user: USER }));
    const write = vi.spyOn(storage, 'setItem');
    await expect(client.restore()).resolves.toMatchObject({ user: USER });
    expect(write).not.toHaveBeenCalled();
    await expect(client.restore()).resolves.toMatchObject({ user: { name: 'Updated' } });
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.values.get('session')!).user.name).toBe('Updated');
  });

  it('keeps a valid cached session while offline and clears it on an explicit 401', async () => {
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const first = setup(offline);
    const session = { token: token(), user: USER };
    first.storage.values.set('session', JSON.stringify(session));
    await expect(first.client.restore()).resolves.toEqual(session);
    expect(first.storage.values.has('session')).toBe(true);

    const unauthorized = vi.fn<typeof fetch>().mockResolvedValue(response({}, 401));
    const second = setup(unauthorized);
    second.storage.values.set('session', JSON.stringify(session));
    await expect(second.client.restore()).resolves.toBeNull();
    expect(second.storage.values.has('session')).toBe(false);
  });

  it('removes both the session and an unfinished login on logout', async () => {
    const { client, storage } = setup();
    storage.values.set('session', JSON.stringify({ token: token(), user: USER }));
    storage.values.set('pending_auth', '{}');

    await client.logout();

    expect(storage.values.size).toBe(0);
  });

  it('does not restore a session after logout while its validation is pending', async () => {
    let resolveMe!: (result: Response) => void;
    const fetcher = vi.fn<typeof fetch>(() => new Promise((resolve) => { resolveMe = resolve; }));
    const { client, storage } = setup(fetcher);
    storage.values.set('session', JSON.stringify({ token: token(), user: USER }));

    const restore = client.restore();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await client.logout();
    resolveMe(response({ user: USER }));

    await expect(restore).resolves.toBeNull();
    expect(storage.values.has('session')).toBe(false);
  });

  it.each([200, 401])('does not let late startup validation (%i) replace or clear a newer login', async (status) => {
    let resolveMe!: (result: Response) => void;
    const nextSession = { token: token(NOW + 100 * 24 * 60 * 60 * 1000), user: { ...USER, uid: 43 } };
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/me')) return new Promise<Response>((resolve) => { resolveMe = resolve; });
      return response(nextSession);
    });
    const { client, openBrowser, storage } = setup(fetcher);
    storage.values.set('session', JSON.stringify({ token: token(), user: USER }));
    const restore = client.restore();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await client.logout();
    await client.start('en');
    const state = new URL(openBrowser.mock.calls[0][0]).searchParams.get('state');
    await client.finish(`me.cuberoot.app://auth/callback?ticket=${TICKET}&state=${state}`);
    resolveMe(response({ user: USER }, status));

    await restore;
    expect(JSON.parse(storage.values.get('session') ?? '{}')).toEqual(nextSession);
  });

  it('does not finish a pending login after logout', async () => {
    let resolveExchange!: (result: Response) => void;
    const fetcher = vi.fn<typeof fetch>(() => new Promise((resolve) => { resolveExchange = resolve; }));
    const { client, openBrowser, storage } = setup(fetcher);
    await client.start('en');
    const state = new URL(openBrowser.mock.calls[0][0]).searchParams.get('state');
    const finish = client.finish(`me.cuberoot.app://auth/callback?ticket=${TICKET}&state=${state}`);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await client.logout();
    resolveExchange(response({ token: token(), user: USER }));

    await expect(finish).resolves.toBeNull();
    expect(storage.values.has('session')).toBe(false);
  });

  it('clears an already-running native storage write before logout completes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ user: { ...USER, name: 'Updated' } }));
    const { client, storage } = setup(fetcher);
    storage.values.set('session', JSON.stringify({ token: token(), user: USER }));
    let releaseWrite!: () => void;
    const write = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
      await new Promise<void>((resolve) => { releaseWrite = resolve; });
      storage.values.set(key, value);
    });
    const restore = client.restore();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const logout = client.logout();
    releaseWrite();

    await logout;
    await expect(restore).resolves.toBeNull();
    expect(storage.values.has('session')).toBe(false);
  });

  it('does not let an old web-ticket rejection clear a newer login', async () => {
    let resolveTicket!: (result: Response) => void;
    const nextSession = { token: token(NOW + 100 * 24 * 60 * 60 * 1000), user: { ...USER, uid: 43 } };
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/ticket')) return new Promise<Response>((resolve) => { resolveTicket = resolve; });
      return response(nextSession);
    });
    const { client, storage, openBrowser } = setup(fetcher);
    storage.values.set('session', JSON.stringify({ token: token(), user: USER }));
    const ticket = client.issueWebSessionTicket();
    const rejected = expect(ticket).rejects.toThrow('mobile auth session changed');
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await client.logout();
    await client.start('en');
    const state = new URL(openBrowser.mock.calls[0][0]).searchParams.get('state');
    await client.finish(`me.cuberoot.app://auth/callback?ticket=${TICKET}&state=${state}`);
    resolveTicket(response({}, 401));

    await rejected;
    expect(JSON.parse(storage.values.get('session') ?? '{}')).toEqual(nextSession);
  });

  it('does not publish a login callback if logout starts during its native storage commit', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ token: token(), user: USER }));
    const { client, storage, openBrowser, closeBrowser } = setup(fetcher);
    await client.start('en');
    const state = new URL(openBrowser.mock.calls[0][0]).searchParams.get('state');
    let releaseWrite!: () => void;
    const write = vi.spyOn(storage, 'setItem').mockImplementation(async (key, value) => {
      await new Promise<void>((resolve) => { releaseWrite = resolve; });
      storage.values.set(key, value);
    });
    const finish = client.finish(`me.cuberoot.app://auth/callback?ticket=${TICKET}&state=${state}`);
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const logout = client.logout();
    releaseWrite();

    await logout;
    await expect(finish).resolves.toBeNull();
    expect(storage.values.size).toBe(0);
    expect(closeBrowser).not.toHaveBeenCalled();
  });

  it('issues a short-lived web ticket from the secure native session', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({ ticket: TICKET, expiresIn: 90 }),
    );
    const { client, storage } = setup(fetcher);
    const sessionToken = token();
    storage.values.set('session', JSON.stringify({ token: sessionToken, user: USER }));

    await expect(client.issueWebSessionTicket()).resolves.toEqual({
      ticket: TICKET,
      expiresIn: 90,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.cuberoot.me/v1/auth/web-session/ticket');
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${sessionToken}`);
    expect(init.cache).toBe('no-store');
  });
});
