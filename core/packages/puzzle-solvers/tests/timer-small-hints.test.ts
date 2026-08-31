import { describe, expect, it } from 'vitest';

import { cube222MetricOfScramble } from '../src/cube222';
import { solvePyra } from '../src/pyra';
import { skewbFaceletFromMoves, solveSkewbFacelet } from '../src/skewb';
import {
  TIMER_SMALL_HINT_EVENTS,
  solveTimerSmallHints,
} from '../src/timer-small-hints';

describe('shared Timer small-puzzle hints', () => {
  it('keeps the support matrix exact and explicit', () => {
    expect(TIMER_SMALL_HINT_EVENTS).toEqual(['222', 'pyra', 'skewb']);
  });

  it('returns an independently verifiable 2x2 full solve and all six colours', () => {
    const scramble = "R U R' U' F' U F R2";
    const result = solveTimerSmallHints('222', scramble);

    expect(result.full.length).toBe(7);
    expect(cube222MetricOfScramble(
      `${scramble} ${result.full.moves.join(' ')}`,
      'htm',
    )).toBe(0);
    expect(result.faces.map(({ face, moves }) => [face, moves.length])).toEqual([
      ['U', 5], ['R', 3], ['F', 3], ['D', 4], ['L', 4], ['B', 3],
    ]);
  });

  it('solves a Pyraminx including tips and exposes every V orientation', () => {
    const scramble = "R U' L B' r u'";
    const result = solveTimerSmallHints('pyra', scramble);

    expect(solvePyra(`${scramble} ${result.full.moves.join(' ')}`).length).toBe(0);
    expect(result.full.length).toBe(result.full.moves.length);
    expect(result.faces.map(({ face }) => face)).toEqual(['D', 'L', 'R', 'F']);
  });

  it('preserves the Web Skewb Face answers while sharing one engine', () => {
    const scramble = "R U' L' B R' L U' B'";
    const result = solveTimerSmallHints('skewb', scramble);

    expect(solveSkewbFacelet(skewbFaceletFromMoves(
      `${scramble} ${result.full.moves.join(' ')}`,
    )).length).toBe(0);
    expect(result.faces).toEqual([
      { face: 'U', moves: ['U ', "L'", "U'", "L'", 'R '] },
      { face: 'R', moves: ["R'", 'U ', 'R ', "L'", 'U ', 'L '] },
      { face: 'F', moves: ['R ', "L'", "R'", 'U ', "R'"] },
      { face: 'D', moves: ["L'", 'B ', "R'", 'B ', 'U ', 'B '] },
      { face: 'L', moves: ['R ', 'B ', "U'", "R'", "U'"] },
      { face: 'B', moves: ['R ', 'B ', "R'", "B'", "R'"] },
    ]);
  }, 30_000);

  it('fails closed for an invalid 2x2 move set', () => {
    expect(() => solveTimerSmallHints('222', 'D')).toThrow(
      'expected a U/R/F scramble',
    );
  });
});
