import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicApi } from '@/lib/public-api-fetch-server';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('public prerender reads', () => {
  it.each([502, 503, 504, 'network', 'timeout'])('recovers from a transient %s without caching or sending credentials', async failure => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementationOnce(() => {
      if (failure === 'network') throw new TypeError('fetch failed');
      if (failure === 'timeout') throw new DOMException('Timed out', 'TimeoutError');
      return new Response('Unavailable', { status: failure as number });
    }).mockResolvedValueOnce(Response.json({ value: 'current' }));
    vi.stubGlobal('fetch', fetcher);
    const pending = fetchPublicApi('https://api.example.test/public', 5000);
    await vi.runAllTimersAsync();
    expect(await (await pending).json()).toEqual({ value: 'current' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toEqual({ cache: 'no-store', signal: expect.any(AbortSignal) });
    }
    expect(fetcher.mock.calls[0][1].signal).not.toBe(fetcher.mock.calls[1][1].signal);
  });

  it('stops after three attempts and rejects instead of returning fallback data', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response('Unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetcher);
    const rejected = expect(fetchPublicApi('https://api.example.test/public', 5000)).rejects.toThrow('503');
    await vi.runAllTimersAsync();
    await rejected;
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([401, 404, 429, 500])('does not retry HTTP %s', async status => {
    const fetcher = vi.fn(async () => new Response('Error', { status }));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchPublicApi('https://api.example.test/public', 5000)).rejects.toThrow(String(status));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('leaves malformed content validation to the caller without retrying it', async () => {
    const fetcher = vi.fn(async () => new Response('not json'));
    vi.stubGlobal('fetch', fetcher);
    await expect((await fetchPublicApi('https://api.example.test/public', 5000)).json()).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
