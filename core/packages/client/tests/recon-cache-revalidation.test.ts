import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'node:url';
import { workspaceFixturePath } from './workspace-fixture-path';
import { POST } from '@/app/api/recon/revalidate/route';
import { revalidateTag } from 'next/cache';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
const { revalidateReconPages } = await import(pathToFileURL(
  workspaceFixturePath('@cuberoot/server', 'src/utils/recon_revalidate.ts'),
).href) as { revalidateReconPages(id: string | number): Promise<void> };

const secret = 'test-only-secret';
const destinations = ['https://production.example/api/recon/revalidate', 'https://standalone.example/api/recon/revalidate'];
const request = (body: string, token = secret) => new Request(destinations[0], {
  method: 'POST', body, headers: { Authorization: `Bearer ${token}` },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('RECON_REVALIDATE_SECRET', secret);
  vi.stubEnv('RECON_REVALIDATE_URLS', destinations.join(','));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('recon cache webhook', () => {
  it('rejects unconfigured or unauthorized callers without invalidation', async () => {
    expect((await POST(request('{"id":2796}', 'wrong'))).status).toBe(401);
    vi.stubEnv('RECON_REVALIDATE_SECRET', '');
    expect((await POST(request('{"id":2796}'))).status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it.each(['{', '{}', '{"id":0}', '{"id":"2796-x"}', '{"id":"1e3"}', '{"id":9007199254740992}', '{"kind":"other","id":1}'])(
    'rejects invalid payload %s', async body => {
      expect((await POST(request(body))).status).toBe(400);
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );
  it('delivers a committed edit to both independent caches and immediately expires related cards', async () => {
    const fetcher = vi.fn((url: string, init: RequestInit) => POST(new Request(url, init)));
    vi.stubGlobal('fetch', fetcher);
    await revalidateReconPages(2796);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(destinations);
    for (const [, init] of fetcher.mock.calls) {
      expect(init.redirect).toBe('error');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([
      ['recon-2796', { expire: 0 }], ['recon-same-scramble', { expire: 0 }],
      ['recon-2796', { expire: 0 }], ['recon-same-scramble', { expire: 0 }],
    ]);
  });
  it('retries only the failed destination and does not fail an already saved edit', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url === destinations[0]) throw new TypeError('network failure');
      return POST(new Request(url, init));
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(revalidateReconPages(2796)).resolves.toBeUndefined();
    expect(fetcher.mock.calls.filter(([url]) => url === destinations[0])).toHaveLength(2);
    expect(fetcher.mock.calls.filter(([url]) => url === destinations[1])).toHaveLength(1);
    expect(log).toHaveBeenCalledWith('[recon-cache] invalidation failed', { id: '2796', url: destinations[0] });
  });
  it('does not mistake an HTML access gate for successful invalidation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi.fn(async () => new Response('<html>Sign in</html>'));
    vi.stubGlobal('fetch', fetcher);
    await revalidateReconPages(2796);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

 it('expires forum metadata for a thread and for moderation affecting multiple threads', async () => {
  expect((await POST(request('{"kind":"forum","id":42}'))).status).toBe(200);
  expect((await POST(request('{"kind":"forum"}'))).status).toBe(200);
  expect(vi.mocked(revalidateTag).mock.calls).toEqual([
    ['forum-thread-42', { expire: 0 }], ['forum-threads', { expire: 0 }],
  ]);
});
