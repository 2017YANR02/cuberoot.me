import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  MobileAuthClient,
  type MobileAuthRuntime,
  type MobileAuthStorage,
} from './mobile-auth';

const NOW = Date.UTC(2026, 7, 28);
const TICKET = 'T'.repeat(43);

const USER = {
  uid: 42,
  wcaId: '2017YANR02',
  name: 'CubeRoot User',
  avatar: '',
  avatarSource: 'auto' as const,
  avatarPreset: null,
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
  return { client: new MobileAuthClient(runtime), closeBrowser, fetcher, openBrowser, storage };
}

describe('mobile auth', () => {
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
    )).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
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
