import { afterEach, describe, expect, it, vi } from 'vitest';
import { unstable_cache } from 'next/cache';
import { fetchHomeLayout } from '@/lib/home-layout-server';

vi.mock('next/cache', () => ({ unstable_cache: vi.fn(fn => fn) }));
afterEach(() => vi.unstubAllGlobals());

describe('prerendered homepage layout', () => {
  it('fetches public visibility and order in parallel without session credentials', async () => {
    const requests: Array<{ url: string; init: RequestInit; finish: (value: Response) => void }> = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => new Promise<Response>(finish => requests.push({ url, init, finish })));
    const result = fetchHomeLayout();
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.url).toMatch(/^https:\/\/api\.cuberoot\.me\/v1\/nav\/home-/);
      expect(request.init.cache).toBe('no-store');
      expect(request.init.signal).toBeInstanceOf(AbortSignal);
      expect(request.init.headers).toBeUndefined();
      request.finish(Response.json(request.url.endsWith('home-locks')
        ? { locks: { timer: true } } : { orders: { main: ['algdb', 'timer'] } }));
    }
    await expect(result).resolves.toEqual({ locks: { timer: true }, orders: { main: ['algdb', 'timer'] } });
    expect(unstable_cache).toHaveBeenCalledWith(expect.any(Function), ['home-layout-v1'], {
      revalidate: 60, tags: ['home-layout'],
    });
  });

  it.each(['http', 'network', 'malformed locks', 'malformed orders'])('rejects %s rather than publishing an empty or partially verified homepage', async failure => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (failure === 'http') return new Response('Unavailable', { status: 503 });
      if (failure === 'network') throw new TypeError('network error');
      if (url.endsWith('home-locks')) return Response.json({ locks: failure === 'malformed locks' ? { timer: 'false' } : {} });
      return Response.json({ orders: failure === 'malformed orders' ? null : {} });
    });
    await expect(fetchHomeLayout()).rejects.toThrow();
  });
});
