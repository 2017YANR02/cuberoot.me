import { describe, it, expect, beforeAll } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { FM_SCRAMBLE, FM_SOLUTION, FM_COUNT } from '@/app/[lang]/regulation/fewest-moves/_example';

// Guards the worked FMC example shown on /regulation/fewest-moves: the displayed
// solution must genuinely solve the displayed scramble (a page that teaches
// "a wrong solution is a DNF" must not itself show a DNF solution as the model),
// the move counter must match the real OBTM, and the solution must not be the
// scramble's inverse (which Regulation E2e forbids).

let kpuzzle: KPuzzle;
let solved: KPattern;

beforeAll(async () => {
  kpuzzle = await cube3x3x3.kpuzzle();
  solved = kpuzzle.defaultPattern();
});

describe('regulation /fewest-moves worked example', () => {
  it('scramble + solution returns a fully solved cube', () => {
    const final = solved.applyAlg(new Alg(FM_SCRAMBLE)).applyAlg(new Alg(FM_SOLUTION));
    expect(final.isIdentical(solved)).toBe(true);
  });

  it('FM_COUNT equals the OBTM of the solution (rotations excluded)', () => {
    const obtm = FM_SOLUTION.trim().split(/\s+/).filter(Boolean)
      .filter((m) => !/^[xyz]/i.test(m)).length;
    expect(obtm).toBe(FM_COUNT);
  });

  it('solution is not the scramble inverse (Regulation E2e)', () => {
    const inverse = new Alg(FM_SCRAMBLE).invert().toString().trim();
    expect(FM_SOLUTION.trim()).not.toBe(inverse);
  });
});
