import { describe, expect, it, vi } from 'vitest';
import { cube222MetricOfScramble } from '@cuberoot/puzzle-solvers/cube222';
import {
  generateTimerNon222ByStepsScramble,
  timerNon222StepFilterMatchesScramble,
  type TimerNon222StepPuzzle,
} from '@cuberoot/puzzle-solvers/timer-by-steps';
import type { TimerByStepsFilter } from '@cuberoot/shared/timer';

const filterNon222Mock = vi.hoisted(() => vi.fn());

vi.mock('./cube222-step-filter', () => ({
  filterMobileCube222BySteps: async <T extends { scramble: string }>(
    rows: readonly T[],
    filter: { metric: 'face' | 'layer' | 'htm' | 'qtm'; lo: number; hi: number },
    signal: AbortSignal,
  ) => {
    if (signal.aborted) throw new Error('aborted');
    return rows.filter((row) => {
      const value = cube222MetricOfScramble(row.scramble, filter.metric);
      return value !== null && value >= filter.lo && value <= filter.hi;
    });
  },
}));

vi.mock('./non222-steps-pool', () => ({
  filterMobileNon222BySteps: filterNon222Mock,
}));

describe('mobile real 2x2 by-steps source', () => {
  it('keys full-state filters, suppresses them for special types, and filters the batch', async () => {
    const { fetchRealScrambles, realScrambleSourceKey } = await import('./real-scramble-pool');
    const match = 'U R F U';
    expect(cube222MetricOfScramble(match, 'htm')).toBe(4);
    const spec = {
      event: '222' as const,
      scramble222Mode: 'wca' as const,
      scramble222Type: 'full' as const,
      genByStepsOn: true,
      genStepsMetric: 'htm',
      genSteps: [4],
    };
    expect(realScrambleSourceKey(spec)).not.toBe(realScrambleSourceKey({
      ...spec,
      genSteps: [5],
    }));
    expect(realScrambleSourceKey({ ...spec, scramble222Type: 'eg1' })).toBe(
      realScrambleSourceKey({ ...spec, scramble222Type: 'eg1', genSteps: [5] }),
    );

    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [
        { scramble: match, ci: 'Steps2026', cn: 'Steps 2026', e: '222', r: '1', g: 'A', n: 1, x: 0 },
        { scramble: 'U R', ci: 'Steps2026', cn: 'Steps 2026', e: '222', r: '1', g: 'A', n: 2, x: 0 },
      ],
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchRealScrambles(spec, fetcher)).resolves.toMatchObject([
      { scramble: match, competitionId: 'Steps2026' },
    ]);
  });

  it('preserves duplicate-text precomputed step occurrences by official slot', async () => {
    const { fetchRealScrambles } = await import('./real-scramble-pool');
    const match = 'U R F U';
    expect(cube222MetricOfScramble(match, 'htm')).toBe(4);
    const examplesFetcher = vi.fn(async () => new Response(JSON.stringify({
      meta: { generated_at: '2026-08-22T00:00:00Z' },
      puzzles: {
        222: {
          comps: { Steps2026: ['Steps 2026', '2026-08-22'] },
          idMeta: {
            first: ['Steps2026', '222', 1, '1', 'A', 0],
            second: ['Steps2026', '222', 2, '1', 'A', 0],
            firstAgain: ['Steps2026', '222', 1, '1', 'A', 0],
          },
          metrics: {
            htm: {
              bins: {
                4: [
                  ['first', match, match],
                  ['second', match, match],
                  ['firstAgain', match, match],
                ],
              },
            },
          },
        },
      },
    }), { status: 200 })) as unknown as typeof fetch;
    const liveFetcher = vi.fn(async () => new Response('unavailable', {
      status: 503,
    })) as unknown as typeof fetch;

    const rows = await fetchRealScrambles({
      event: '222',
      scramble222Mode: 'wca',
      scramble222Type: 'full',
      genByStepsOn: true,
      genStepsMetric: 'htm',
      genSteps: [4],
    }, liveFetcher, undefined, examplesFetcher);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.scrambleNumber).sort((left, right) => left - right))
      .toEqual([1, 2]);
  });
});

describe('mobile real non-2x2 by-steps source', () => {
  it.each([
    { event: 'pyra' as const, wcaEvent: 'pyram' as const, metric: 'cube', accepted: 8, rejected: 5 },
    { event: 'skewb' as const, wcaEvent: 'skewb' as const, metric: 'htm', accepted: 9, rejected: 7 },
  ])('filters real $event rows through the canonical shared predicate', async ({
    event,
    wcaEvent,
    metric,
    accepted,
    rejected,
  }) => {
    filterNon222Mock.mockReset();
    filterNon222Mock.mockImplementation(async (
      requestedEvent: TimerNon222StepPuzzle,
      rows: readonly { scramble: string }[],
      filter: TimerByStepsFilter,
      signal: AbortSignal,
    ) => {
      if (signal.aborted) throw new Error('aborted');
      return rows.filter((row) => timerNon222StepFilterMatchesScramble(row.scramble, {
        event: requestedEvent,
        ...filter,
      }));
    });
    const inside = generateTimerNon222ByStepsScramble({
      event, metric, lo: accepted, hi: accepted,
    }, () => 0);
    const outside = generateTimerNon222ByStepsScramble({
      event, metric, lo: rejected, hi: rejected,
    }, () => 0);
    const spec = {
      event,
      genByStepsOn: true,
      genStepsMetric: metric,
      genSteps: [accepted],
      wcaScrambleMode: 'date' as const,
    };
    const { fetchRealScrambles, realScrambleSourceKey } = await import('./real-scramble-pool');
    expect(realScrambleSourceKey(spec)).not.toBe(realScrambleSourceKey({
      ...spec,
      genSteps: [rejected],
    }));
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [
        { scramble: outside, ci: 'Steps2026', cn: 'Steps 2026', e: wcaEvent, r: '1', g: 'A', n: 1, x: 0 },
        { scramble: inside, ci: 'Steps2026', cn: 'Steps 2026', e: wcaEvent, r: '1', g: 'A', n: 2, x: 0 },
      ],
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles(spec, fetcher)).resolves.toMatchObject([
      { scramble: inside, eventId: wcaEvent, scrambleNumber: 2 },
    ]);
    expect(filterNon222Mock).toHaveBeenCalledWith(
      event,
      expect.any(Array),
      { metric, lo: accepted, hi: accepted },
      expect.any(AbortSignal),
    );
  });

  it('does not migrate an event-only cache into a configured step identity', async () => {
    const { readRealScrambleCache } = await import('./real-scramble-pool');
    const legacy = {
      savedAt: 1_000,
      scrambles: [{
        competitionId: 'Legacy2025',
        competitionName: 'Legacy 2025',
        eventId: 'pyram',
        groupId: 'A',
        roundTypeId: '1',
        scramble: 'U',
        scrambleNumber: 1,
        isExtra: false,
      }],
    };
    const storage = {
      getItem: (key: string) => key === 'cuberoot.mobile.real-scrambles.pyra.v2'
        ? JSON.stringify(legacy)
        : null,
    };
    expect(readRealScrambleCache('pyra', storage, 1_001)).toHaveLength(1);
    expect(readRealScrambleCache({
      event: 'pyra',
      genByStepsOn: true,
      genStepsMetric: 'cube',
      genSteps: [8],
    }, storage, 1_001)).toEqual([]);
  });

  it.each([
    ['ivy', 'htm', 5, 6],
    ['gear', 'ftm', 4, 5],
  ] as const)('keys retained-Real %s fallback by its local metric', async (
    event,
    metric,
    first,
    second,
  ) => {
    const { realScrambleSourceKey } = await import('./real-scramble-pool');
    const base = {
      event,
      genByStepsOn: true,
      genStepsMetric: metric,
    };
    const firstKey = realScrambleSourceKey({ ...base, genSteps: [first] });
    const secondKey = realScrambleSourceKey({ ...base, genSteps: [second] });
    expect(firstKey).toContain(`byst|${event}|${metric}|${first}.${first}`);
    expect(firstKey).not.toBe(secondKey);
  });
});
