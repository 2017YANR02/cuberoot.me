/**
 * FMC solution validation — the pieces ManualEntryModal's `isFmc` branch runs
 * on every keystroke.
 *
 * Two independent claims are locked here:
 *   1. `parseScrambleStrict` REPORTS unparsable tokens instead of silently
 *      dropping them (plain `parseScramble` returns [] for garbage, so a typo
 *      would otherwise be scored as a valid, shorter solution).
 *   2. `obtmCount` follows WCA 12a2 / E2b (Outer Block Turn Metric): face = 1,
 *      wide = 1, rotation = 0, slice = 2. Notably NOT `slice.ts`'s `htmCount`,
 *      which scores slices as 0.
 *
 * Solvedness is checked with `isSolvedFaces`, which compares each face against
 * its own first sticker — so a solution ending in a whole-cube rotation still
 * reads as solved, matching WCA A3b1.
 */

import { describe, it, expect } from 'vitest';
import type { EventId, Solve } from '@/app/[lang]/timer/_lib/types';
import { obtmCount, parseScramble, parseScrambleStrict } from '@/app/[lang]/timer/_lib/cube/moves';
import { applyMoves, applyScramble, isSolvedFaces } from '@/app/[lang]/timer/_lib/cube/state';
import {
  bestMeanOfN, formatEventMs, formatMs, formatSolveResult, meanOfN,
} from '@/app/[lang]/timer/_lib/stats';

/** Mirror of what the modal does: parse, apply, ask. */
function solves(scramble: string, solution: string): boolean {
  const { moves, bad } = parseScrambleStrict(solution);
  if (bad.length > 0) return false;
  return isSolvedFaces(applyMoves(applyScramble(3, scramble), 3, moves));
}

function count(solution: string): number {
  return obtmCount(parseScrambleStrict(solution).moves);
}

describe('FMC — solution correctness', () => {
  it('accepts the exact inverse of the scramble', () => {
    expect(solves("R U R' U'", "U R U' R'")).toBe(true);
  });

  it('rejects a solution that leaves the cube scrambled', () => {
    expect(solves("R U R' U'", 'R')).toBe(false);
    expect(solves("R U R' U'", "U R U'")).toBe(false);
  });

  it('accepts a solution that differs only by a whole-cube rotation', () => {
    // Same solution, then y / x2 / z' tacked on. WCA A3b1: the cube may end in
    // any orientation, and isSolvedFaces is rotation-invariant by construction.
    expect(solves("R U R' U'", "U R U' R' y")).toBe(true);
    expect(solves("R U R' U'", "U R U' R' x2")).toBe(true);
    expect(solves("R U R' U'", "U R U' R' x y' z2")).toBe(true);
    // The underlying property: rotations alone never break "solved".
    expect(isSolvedFaces(applyScramble(3, "x y z"))).toBe(true);
    expect(isSolvedFaces(applyScramble(3, "x2 y' z2 x"))).toBe(true);
  });

  it('handles slice moves in both scramble and solution', () => {
    expect(solves('M2', 'M2')).toBe(true);
    expect(solves("M' U M", "M' U' M")).toBe(true);
  });

  it('handles wide turns and lowercase wide shorthand', () => {
    expect(solves('Rw', "Rw'")).toBe(true);
    expect(solves('Rw', "r'")).toBe(true);
    expect(solves('3Rw', "3Rw'")).toBe(true);
  });

  it('an empty solution does not "solve" a real scramble', () => {
    expect(solves("R U R' U'", '')).toBe(false);
    // …but it does leave an unscrambled cube solved.
    expect(solves('', '')).toBe(true);
  });
});

describe('FMC — invalid tokens are reported, not swallowed', () => {
  it('flags a garbage token', () => {
    const { bad } = parseScrambleStrict("R U Q R'");
    expect(bad).toEqual(['Q']);
  });

  it('flags megaminx notation on a 3x3 solution', () => {
    expect(parseScrambleStrict('R++ D--').bad).toEqual(['R++', 'D--']);
  });

  it('the lenient parser would have silently dropped it — that is the bug', () => {
    // parseScramble sees 3 moves and no error; parseScrambleStrict sees 3 moves
    // AND one bad token. Only the latter can reject the input.
    expect(parseScramble("R U Q R'")).toHaveLength(3);
    expect(parseScrambleStrict("R U Q R'").moves).toHaveLength(3);
    expect(parseScrambleStrict("R U Q R'").bad).toHaveLength(1);
  });

  it('accepts every shape the parser really supports', () => {
    expect(parseScrambleStrict("R U' F2 Rw Uw' 3Rw2 r u2 M E' S x y2 z'").bad).toEqual([]);
  });

  it('drops end-of-line comments whole without flagging the prose', () => {
    expect(parseScrambleStrict('R U // setup moves').bad).toEqual([]);
    expect(parseScrambleStrict('R U # a note').bad).toEqual([]);
    expect(parseScrambleStrict('R U // setup moves').moves).toHaveLength(2);
    // Multi-line, annotated — the shape people paste out of a solve write-up.
    const annotated = parseScrambleStrict("R U R' // pair 1\nU R U' R' // pair 2");
    expect(annotated.bad).toEqual([]);
    expect(obtmCount(annotated.moves)).toBe(7);
  });
});

describe('FMC — OBTM move count (WCA 12a2 / E2b)', () => {
  it('a face turn is 1', () => {
    expect(count('R')).toBe(1);
    expect(count("U'")).toBe(1);
    expect(count('F2')).toBe(1);
  });

  it('a wide turn is 1', () => {
    expect(count('Rw')).toBe(1);
    expect(count("Rw'")).toBe(1);
    expect(count('3Rw2')).toBe(1);
    expect(count('r')).toBe(1); // lowercase shorthand for Rw
  });

  it('a rotation is 0', () => {
    expect(count('x')).toBe(0);
    expect(count("y'")).toBe(0);
    expect(count('z2')).toBe(0);
    expect(count('x y z')).toBe(0);
  });

  it('a slice is 2', () => {
    expect(count('M')).toBe(2);
    expect(count("M'")).toBe(2);
    expect(count('M2')).toBe(2);
    expect(count('E')).toBe(2);
    expect(count('S')).toBe(2);
  });

  it('a mixed solution sums correctly', () => {
    // Rw(1) + U(1) + x(0) + M(2) = 4
    expect(count('Rw U x M')).toBe(4);
    // R(1) U(1) R'(1) U'(1) = 4
    expect(count("R U R' U'")).toBe(4);
    // 10 face turns + 1 wide + 1 slice(2) + 2 rotations(0) = 13
    expect(count("R U R' U' F R U R' U' F' Rw M x y")).toBe(13);
  });

  it('is NOT the slice-blind htmCount — slices must not score 0', () => {
    expect(count("R M U M'")).toBe(6);
  });
});

/* ------------------------------------------------------------------ */
/* FMC display: moves*1000 ms must not render as a time                */
/* ------------------------------------------------------------------ */

let seq = 0;
function fmcSolve(moves: number, event: EventId = '333fm'): Solve {
  seq++;
  return {
    id: 'f' + seq, timeMs: moves * 1000, penalty: 'ok',
    scramble: '', event, ts: 1_700_000_000_000 + seq * 1000,
  };
}

describe('FMC — result display', () => {
  it('a single renders as an integer move count, not a time', () => {
    // The bug this replaces: formatMs(27_330) → "27.330".
    expect(formatSolveResult(fmcSolve(27))).toBe('27');
    expect(formatEventMs('333fm', 27_000)).toBe('27');
    expect(formatMs(27_000)).toBe('27.00'); // the untouched time formatter
  });

  it('a fractional aggregate renders at 2 dp', () => {
    expect(formatEventMs('333fm', 26_330)).toBe('26.33');
    expect(formatEventMs('333fm', 25_670)).toBe('25.67');
  });

  it('non-FMC events are untouched', () => {
    expect(formatSolveResult(fmcSolve(27, '333'))).toBe('27.00');
    expect(formatEventMs('333', 12_345)).toBe('12.34');
  });

  it('DNF / DNS still read as themselves', () => {
    expect(formatEventMs('333fm', Infinity)).toBe('DNF');
    expect(formatEventMs('333fm', null)).toBe('-');
    expect(formatSolveResult({ ...fmcSolve(27), penalty: 'DNS' })).toBe('DNS');
    expect(formatSolveResult({ ...fmcSolve(27), penalty: 'DNF' })).toBe('DNF');
  });
});

describe('FMC — mo3 is ROUNDED to 2 dp, not truncated (WCA A7c vs 9f7)', () => {
  it('rounds up where the time rule would truncate down', () => {
    // (25 + 26 + 26) / 3 = 25.666… moves. WCA rounds to 25.67; the time rule
    // (truncate to centiseconds) would have produced 25.66.
    const solves = [fmcSolve(25), fmcSolve(26), fmcSolve(26)];
    expect(meanOfN(solves, 3)).toBe(25_670);
    expect(formatEventMs('333fm', meanOfN(solves, 3))).toBe('25.67');
  });

  it('bestMeanOfN uses the same rule so best mo3 agrees with mo3', () => {
    const solves = [fmcSolve(30), fmcSolve(25), fmcSolve(26), fmcSolve(26)];
    expect(bestMeanOfN(solves, 3)).toBe(25_670);
  });

  it('non-FMC means still TRUNCATE to centiseconds', () => {
    // (10.000 + 11.000 + 11.002) / 3 = 10.667333s → truncate 10.660, not 10.670.
    const solves = [
      { ...fmcSolve(0, '333'), timeMs: 10_000 },
      { ...fmcSolve(0, '333'), timeMs: 11_000 },
      { ...fmcSolve(0, '333'), timeMs: 11_002 },
    ];
    expect(meanOfN(solves, 3)).toBe(10_660);
  });
});
