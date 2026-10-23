import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMP_STEP_STAGES, fetchCompSteps, minimumCompSteps } from '@/lib/comp-steps';
import { fetchScrambleStatistics, findStatisticsScramble } from '@/lib/scramble-statistics';

const official = "B2 U2 F2 D L2 D B D2 R2 B2 U D B2 U F D' F2 R";
const optimal = "U' L F L2 U' F L2 U R2 D B' F D' U2 R D R'";
const row = {
  event_id: '333', round_type_id: '2', group_id: 'A', is_extra: false,
  scramble_num: 1, scramble: official, optimal_scramble: optimal,
};
afterEach(() => vi.unstubAllGlobals());

describe('precomputed scramble statistics', () => {
  it('matches reconstruction 2795 through its published optimal equivalent', () => {
    expect(findStatisticsScramble([row], `  ${optimal}  `)?.scramble).toBe(official);
    expect(findStatisticsScramble([row], official.replaceAll(' ', '  '))?.scramble).toBe(official);
    expect(findStatisticsScramble([row], 'R U')).toBeUndefined();
  });

  it('reads stage offsets in W Y R O B G order and preserves zero', () => {
    const values = [5, 5, 6, 5, 7, 6, 8, 9, 10, 11, 12, 13];
    expect(minimumCompSteps(values, 0, ['W', 'Y'])).toBe(5);
    expect(minimumCompSteps(values, 1, ['B', 'G'])).toBe(12);
    expect(minimumCompSteps([0, 1, 2, 3, 4, 5], 0, ['W'])).toBe(0);
  });

  it('does not call incomplete subsets a minimum, or confuse block shard layouts with solver menus', () => {
    expect(minimumCompSteps([-1, 5, 6, 7, 8, 9], 0, ['W', 'Y'])).toBeNull();
    expect(minimumCompSteps([5], 0, ['W', 'Y'])).toBeNull();
    expect(minimumCompSteps(undefined, 0, ['W'])).toBeNull();
    expect(COMP_STEP_STAGES['223']).toEqual(['block223']);
    expect(COMP_STEP_STAGES['123']).toEqual(['fbsquare', 'rouxs1']);
  });

  it('shares in-flight shards, normalizes keys, and does not convert null to zero', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ' R  U ': [null, 0, 6, 5, 7, 6] })));
    vi.stubGlobal('fetch', fetcher);
    const [a, b] = await Promise.all([fetchCompSteps('StatsShared2026', 'std'), fetchCompSteps('StatsShared2026', 'std')]);
    expect(a).toBe(b);
    expect(a?.get('R U')).toEqual([-1, 0, 6, 5, 7, 6]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries failed shards and distinguishes errors from unpublished data', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchCompSteps('StatsRetry2026', 'std')).rejects.toThrow('503');
    expect((await fetchCompSteps('StatsRetry2026', 'std'))?.size).toBe(0);
    expect(await fetchCompSteps('StatsMissing2026', 'std')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('loads the original row for an optimal-only reconstruction and keeps partial results', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/v1/wca/scrambles?')) return new Response(JSON.stringify([row]));
      if (url.includes('/comp_steps/')) return new Response(JSON.stringify({ [official]: [5, 6, 7, 8, 9, 10] }));
      if (url.includes('/comp_steps_eo/')) return new Response('', { status: 503 });
      return new Response('', { status: 404 });
    }));
    const data = await fetchScrambleStatistics('StatsRecon2026', optimal, true);
    expect(data.steps.std).toEqual([5, 6, 7, 8, 9, 10]);
    expect(data.steps.eo).toBeUndefined();
    expect(data.optimalScramble).toBe(optimal);
    expect(data.failed).toBe(true);
  });
});
