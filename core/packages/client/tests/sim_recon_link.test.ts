import { describe, expect, it } from 'vitest';
import { buildSimQuery, simPuzzleForReconEvent } from '@/lib/sim-recon-link';

describe('buildSimQuery', () => {
  it('anchors a solution-only reconstruction at the solved endpoint', () => {
    const puzzle = simPuzzleForReconEvent('oh');
    expect(puzzle).toBe('3');
    const solution = "D F L F' R D' R2 // W cross cancel into\nU' R' // RG";

    const query = new URLSearchParams(buildSimQuery(puzzle!, '', solution));

    expect(Object.fromEntries(query)).toEqual({
      puzzle: '3',
      alg: solution,
      anchor: 'end',
    });
  });

  it('keeps a reconstruction with a scramble anchored at its start', () => {
    const query = new URLSearchParams(buildSimQuery('3', "R U R'", "R U' R'"));

    expect(Object.fromEntries(query)).toEqual({
      puzzle: '3',
      setup: "R U R'",
      alg: "R U' R'",
    });
  });
});
