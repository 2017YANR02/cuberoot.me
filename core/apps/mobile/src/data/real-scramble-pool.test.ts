import { describe, expect, it, vi } from 'vitest';

import {
  fetchRealScrambles,
  readRealScrambleCache,
  writeRealScrambleCache,
  type RealScramble,
} from './real-scramble-pool';

const sample: RealScramble = {
  competitionId: 'Example2016',
  competitionName: 'Example Open 2016',
  eventId: '333',
  groupId: 'A',
  roundTypeId: '1',
  scramble: "R U R'",
  scrambleNumber: 1,
};

describe('real scramble pool', () => {
  it('normalizes and validates API rows', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [
        { scramble: ' R U R’ ', ci: 'Example2016', cn: 'Example Open 2016', e: '333', r: '1', g: 'A', n: 1 },
        { scramble: 'R U', ci: 'wrong-event', e: '222', r: '1', g: 'A', n: 2 },
        { scramble: 'R nope', ci: 'bad-moves', e: '333', r: '1', g: 'A', n: 3 },
        { scramble: '', ci: 'bad' },
      ],
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles(fetcher)).resolves.toEqual([sample]);
  });

  it('keeps a bounded, deduplicated seven-day cache', () => {
    let raw = '';
    const storage = {
      getItem: () => raw || null,
      setItem: (_key: string, value: string) => { raw = value; },
    };
    writeRealScrambleCache([sample, sample], storage, 1000);
    expect(readRealScrambleCache(storage, 1001)).toEqual([sample]);
    writeRealScrambleCache([sample], storage);
    expect(readRealScrambleCache(storage, 1000 + 8 * 24 * 60 * 60 * 1000)).toEqual([]);
  });

  it('rejects an API response without a valid 3x3 scramble', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      scrambles: [{ scramble: 'R X', ci: 'bad', e: '333', r: '1', g: 'A', n: 1 }],
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchRealScrambles(fetcher)).rejects.toThrow('no valid 3x3 rows');
  });
});
