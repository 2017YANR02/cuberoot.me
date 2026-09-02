import { afterEach, describe, expect, it, vi } from 'vitest';

const distribution = {
  sets: {
    wca: {
      variants: {
        std: { data: { cross: { BGORWY: { min: 4, max: 4 } } } },
      },
    },
  },
};

function byDifficultyPayload(
  scrambles: readonly Record<string, unknown>[],
  total = scrambles.length,
  pageSize = 200,
) {
  return { total, page: 1, pageSize, scrambles };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('mobile WCA difficulty pool integration', () => {
  it('uses shared merged difficulty queries and retains exact WCA event provenance', async () => {
    vi.resetModules();
    const requested: URL[] = [];
    const globalFetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requested.push(url);
      if (url.pathname.endsWith('/distribution.json')) {
        return new Response(JSON.stringify(distribution), { status: 200 });
      }
      if (url.pathname.endsWith('/by-difficulty')) {
        if (url.searchParams.get('pageSize') === '1') {
          return new Response(JSON.stringify(byDifficultyPayload([], 1, 1)), { status: 200 });
        }
        const bin = url.searchParams.get('bin');
        const rows = bin === '4' ? [{
          scramble: 'raw 333', o: 'optimal 333', ci: 'Selected2026',
          cn: 'Selected Open 2026', e: '333', r: '2', g: 'B', n: 1, x: 0,
        }] : [{
          scramble: 'raw one-handed', o: 'optimal one-handed', ci: 'Selected2026',
          cn: 'Selected Open 2026', e: '333oh', r: '2', g: 'B', n: 1, x: 0,
        }, {
          scramble: 'wrong competition', o: 'wrong competition optimal', ci: 'Other2026',
          cn: 'Other Open 2026', e: '333', r: '2', g: 'B', n: 1, x: 0,
        }, {
          scramble: 'invalid event', o: 'invalid event optimal', ci: 'Selected2026',
          cn: 'Selected Open 2026', e: 'not-wca', r: '2', g: 'B', n: 2, x: 0,
        }];
        return new Response(JSON.stringify(byDifficultyPayload(rows)), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', globalFetcher);
    const { fetchRealScrambles } = await import('./real-scramble-pool');
    const rawFetcher = vi.fn(async () => {
      throw new Error('difficulty mode must not call the raw competition endpoint');
    }) as unknown as typeof fetch;

    await expect(fetchRealScrambles({
      event: '333',
      wcaScrambleMode: 'comp',
      wcaComp: 'Selected2026',
      wcaCompName: 'Selected Open 2026',
      wcaRound: '2',
      wcaGroup: 'B',
      wcaDifficultyOn: true,
      wcaDiffVariant: 'std',
      wcaDiffStage: 'cross',
      wcaDiffColors: 'WY',
      wcaDiffSteps: [4, 5],
      wcaDiffMerged: true,
    }, rawFetcher)).resolves.toMatchObject([
      { eventId: '333', scramble: 'optimal 333', competitionId: 'Selected2026' },
      { eventId: '333oh', scramble: 'optimal one-handed', competitionId: 'Selected2026' },
    ]);
    expect(rawFetcher).not.toHaveBeenCalled();

    const dataQueries = requested.filter((url) => url.searchParams.get('pageSize') === '200');
    expect(dataQueries).toHaveLength(2);
    expect(dataQueries.map((url) => url.searchParams.get('bin'))).toEqual(['4', '5']);
    for (const url of dataQueries) {
      expect(url.searchParams.get('variant')).toBe('std');
      expect(url.searchParams.get('stage')).toBe('cross');
      expect(url.searchParams.get('colors')).toBe('WY');
      expect(url.searchParams.get('names')).toBe('Selected Open 2026');
      expect(url.searchParams.has('event')).toBe(false);
    }
  });

  it('bypasses only indexed difficulty on a confirmed unindexed competition', async () => {
    vi.resetModules();
    const requested: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requested.push(url);
      if (url.pathname.endsWith('/distribution.json')) {
        return new Response(JSON.stringify(distribution), { status: 200 });
      }
      if (url.pathname.endsWith('/by-difficulty')) {
        return new Response(JSON.stringify(byDifficultyPayload([], 0, 1)), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }));
    const { fetchRealScrambles } = await import('./real-scramble-pool');
    const rawFetcher = vi.fn(async () => new Response(JSON.stringify([{
      event_id: '333', round_type_id: '1', group_id: 'A', is_extra: false,
      scramble_num: 1, scramble: "R U R'",
    }]), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles({
      event: '333',
      wcaUseOptimal: false,
      wcaScrambleMode: 'comp',
      wcaComp: 'Unindexed2026',
      wcaCompName: 'Unindexed Open 2026',
      wcaDifficultyOn: true,
      wcaDiffVariant: 'std',
      wcaDiffStage: 'cross',
      wcaDiffSteps: [4],
    }, rawFetcher)).resolves.toMatchObject([{ scramble: "R U R'" }]);

    expect(rawFetcher).toHaveBeenCalledOnce();
    expect(requested.filter((url) => url.pathname.endsWith('/by-difficulty'))).toHaveLength(1);
    expect(requested.some((url) => url.searchParams.get('pageSize') === '200')).toBe(false);
  });

  it('keeps transport failure, missing optimal text, and authoritative empty distinct', async () => {
    vi.resetModules();
    let mode: 'error' | 'missing-optimal' | 'empty' = 'error';
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/distribution.json')) {
        return new Response(JSON.stringify(distribution), { status: 200 });
      }
      if (url.pathname.endsWith('/by-difficulty') && url.searchParams.get('pageSize') === '1') {
        return new Response(JSON.stringify(byDifficultyPayload([], 1, 1)), { status: 200 });
      }
      if (mode === 'error') return new Response('unavailable', { status: 503 });
      if (mode === 'missing-optimal') {
        return new Response(JSON.stringify(byDifficultyPayload([{
          scramble: 'raw only', ci: 'Rare2026', cn: 'Rare Open 2026',
          e: '333', r: '1', g: 'A', n: 1, x: 0,
        }])), { status: 200 });
      }
      return new Response(JSON.stringify(byDifficultyPayload([])), { status: 200 });
    }));
    const { fetchRealScrambles } = await import('./real-scramble-pool');
    const spec = {
      event: '333' as const,
      wcaScrambleMode: 'comp' as const,
      wcaComp: 'Rare2026',
      wcaCompName: 'Rare Open 2026',
      wcaDifficultyOn: true,
      wcaDiffVariant: 'std',
      wcaDiffStage: 'cross',
      wcaDiffSteps: [4],
    };

    await expect(fetchRealScrambles(spec)).rejects.toMatchObject({ kind: 'transient-error' });
    mode = 'missing-optimal';
    await expect(fetchRealScrambles(spec)).rejects.toMatchObject({ kind: 'transient-error' });
    mode = 'empty';
    await expect(fetchRealScrambles(spec)).rejects.toMatchObject({ kind: 'confirmed-empty' });
  });

  it('does not turn one failed difficulty bin plus one empty bin into authoritative empty', async () => {
    vi.resetModules();
    let partialFailure = true;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (!url.pathname.endsWith('/by-difficulty')) return new Response('{}', { status: 404 });
      if (partialFailure && url.searchParams.get('bin') === '5') {
        return new Response('unavailable', { status: 503 });
      }
      if (url.searchParams.get('bin') === '4') {
        return new Response(JSON.stringify(byDifficultyPayload([{
          scramble: 'R U', ci: 'Partial2026', cn: 'Partial Open 2026',
          e: '333', r: '1', g: 'A', n: 1, x: 0,
        }])), { status: 200 });
      }
      return new Response(JSON.stringify(byDifficultyPayload([])), { status: 200 });
    }));
    const { fetchRealScrambles } = await import('./real-scramble-pool');
    const spec = {
      event: '333' as const,
      wcaScrambleMode: 'comp' as const,
      wcaComp: 'Partial2026',
      wcaCompName: 'Partial Open 2026',
      wcaDifficultyOn: true,
      wcaDiffVariant: 'std',
      wcaDiffStage: 'cross',
      wcaDiffSteps: [4, 5],
      wcaUseOptimal: false,
    };

    await expect(fetchRealScrambles(spec)).rejects.toMatchObject({ kind: 'transient-error' });
    partialFailure = false;
    await expect(fetchRealScrambles(spec)).resolves.toMatchObject([
      { competitionId: 'Partial2026', scramble: 'R U' },
    ]);
  });
});
