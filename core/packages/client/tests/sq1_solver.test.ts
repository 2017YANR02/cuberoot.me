import { describe, it, expect } from 'vitest';
import { sq1MoveCounts } from '@/lib/sq1-metrics';
import { solveSq1, __sq1SelfTest } from '@/app/[lang]/timer/_lib/solver/sq1';

describe('sq1 move-count metrics (lib/sq1-metrics)', () => {
  it('counts the three metrics on known sequences', () => {
    // "/" always 1 in every metric; only layer turns differ.
    expect(sq1MoveCounts('')).toMatchObject({ twist: 0, wca: 0, face: 0 });
    expect(sq1MoveCounts('/')).toMatchObject({ twist: 1, wca: 1, face: 1 });
    // single-layer (3,0): twist 1 (slice only), wca 2 (turn+slice), face 2 (1 face turn + slice)
    expect(sq1MoveCounts('(3,0)/')).toMatchObject({ twist: 1, wca: 2, face: 2, doubleTurns: 0 });
    // double (3,3): twist 1, wca 2, face 3 (2 face turns + slice)
    expect(sq1MoveCounts('(3,3)/')).toMatchObject({ twist: 1, wca: 2, face: 3, doubleTurns: 1 });
  });

  it('aggregates a multi-move sequence correctly', () => {
    const c = sq1MoveCounts('(1,0)/(-3,3)/(0,-3)/');
    expect(c.slices).toBe(3);
    expect(c.turns).toBe(3);
    expect(c.twist).toBe(3); // only the 3 slices
    expect(c.wca).toBe(6); // 3 non-trivial turns + 3 slices
    expect(c.face).toBe(7); // 1 + 2 + 1 face turns + 3 slices
    expect(c.doubleTurns).toBe(1); // (-3,3)
  });

  it('an identity (0,0) turn is free in every metric', () => {
    const c = sq1MoveCounts('(0,0)/');
    expect(c).toMatchObject({ twist: 1, wca: 1, face: 1, nonIdentityTurns: 0 });
  });
});

describe('solveSq1 (two-phase engine)', () => {
  it('built-in self-test passes', () => {
    expect(__sq1SelfTest()).toMatch(/^OK:/);
  });

  // Known-legal scrambles: the engine self-test scramble and a real cubing.js
  // random-state scramble. Correctness is checked by the solver round-trip —
  // applying the solution after the scramble must leave the puzzle solved
  // (solveSq1 reports 0 moves). The displayed 2D net rendering was additionally
  // confirmed solved out-of-band via Playwright (independent renderer).
  const SCRAMBLES = [
    '(1,2)/(6,6)/(4,-3)/(6,5)/(6,-3)/(-5,3)/(-1,-3)/(6,6)/(-3,-3)/',
    '(1,3)/(5,5)/(3,0)/(-5,-2)/(-4,5)/(-5,-5)/(-1,0)/(3,0)/(-5,0)/(-4,0)/(-2,0)/(-2,0)/',
  ];

  it.each(SCRAMBLES)('solves; scramble + solution is solved (0 moves): %s', (scramble) => {
    const res = solveSq1(scramble);
    expect(res.stages.length).toBe(2);
    expect(res.stages.some((s) => s.failed)).toBe(false);

    const solution = res.stages.flatMap((s) => s.moves).join(' ');
    // Round-trip: solving the scramble followed by its own solution must be a no-op.
    expect(solveSq1(`${scramble} ${solution}`).totalMoves).toBe(0);

    // Metric invariant on the produced solution: twist ≤ WCA ≤ face.
    const c = sq1MoveCounts(solution);
    expect(c.twist).toBeLessThanOrEqual(c.wca);
    expect(c.wca).toBeLessThanOrEqual(c.face);
    // The engine minimises face turns (raw tokens); pretty-merging never inflates it.
    expect(c.face).toBeLessThanOrEqual(res.totalMoves);
  });
});
