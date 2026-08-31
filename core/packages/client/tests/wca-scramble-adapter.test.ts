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
  it('falls back after a malformed non-empty proxy payload', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{}]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([validRow]), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const { fetchWcaScrambles } = await import('@/lib/wca-results-api');

    await expect(fetchWcaScrambles('MalformedWebFixture2026')).resolves.toEqual([validRow]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('treats an actual empty array as authoritative without direct fallback', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const { fetchWcaScrambles } = await import('@/lib/wca-results-api');

    await expect(fetchWcaScrambles('EmptyWebFixture2026')).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
