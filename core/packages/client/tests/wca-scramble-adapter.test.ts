import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => `https://api.test${path}` }));

const validRow = {
  event_id: '333',
  round_type_id: '1',
  group_id: 'A',
  is_extra: false,
  scramble_num: 1,
  scramble: "R U R'",
  optimal_scramble: null,
};

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('Web WCA competition-scramble adapter', () => {
  it('uses our server first and skips WCA when scrambles are available', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([validRow])));
    vi.stubGlobal('fetch', fetcher);
    const { fetchWcaScrambles } = await import('@/lib/wca-results-api');

    await expect(fetchWcaScrambles('Available2026')).resolves.toEqual([validRow]);
    await expect(fetchWcaScrambles('Available2026')).resolves.toEqual([validRow]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe('https://api.test/v1/wca/scrambles?compId=Available2026');
  });

  it('falls back after a malformed non-empty proxy payload', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{}]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([validRow]), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const { fetchWcaScrambles } = await import('@/lib/wca-results-api');

    await expect(fetchWcaScrambles('MalformedWebFixture2026')).resolves.toEqual([validRow]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('checks WCA after an empty server result, without caching a temporary empty result', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('[]'))
      .mockResolvedValueOnce(new Response('[]'))
      .mockResolvedValueOnce(new Response('[]'))
      .mockResolvedValueOnce(new Response(JSON.stringify([validRow])));
    vi.stubGlobal('fetch', fetcher);
    const { fetchWcaScrambles } = await import('@/lib/wca-results-api');

    await expect(fetchWcaScrambles('EmptyWebFixture2026')).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(fetchWcaScrambles('EmptyWebFixture2026')).resolves.toEqual([validRow]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.test/v1/wca/scrambles?compId=EmptyWebFixture2026',
      'https://www.worldcubeassociation.org/api/v0/competitions/EmptyWebFixture2026/scrambles',
      'https://api.test/v1/wca/scrambles?compId=EmptyWebFixture2026',
      'https://www.worldcubeassociation.org/api/v0/competitions/EmptyWebFixture2026/scrambles',
    ]);
  });

  it('does not mistake an official request failure for confirmed missing scrambles', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('[]'))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetcher);
    const { fetchWcaScrambles } = await import('@/lib/wca-results-api');
    await expect(fetchWcaScrambles('Unavailable2026')).resolves.toBeNull();
  });

  it('does not start a fallback when the request was cancelled', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementationOnce(async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    });
    vi.stubGlobal('fetch', fetcher);
    const { fetchWcaScrambles } = await import('@/lib/wca-results-api');
    await expect(fetchWcaScrambles('Cancelled2026', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
