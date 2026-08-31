import { describe, expect, it } from 'vitest';

import { solvePyra, solvePyraV } from '@cuberoot/puzzle-solvers/pyra';
import {
  solveTimerSmallHints,
  type TimerSmallHintEvent,
  type TimerSmallHintResult,
} from '@cuberoot/puzzle-solvers/timer-small-hints';
import {
  solve2x2,
  solve2x2Face,
} from '../app/[lang]/timer/_lib/solver/cube2x2';
import { solveSkewb, solveSkewbFace } from '../lib/skewb-face-solver';

const CASES: Readonly<Record<TimerSmallHintEvent, readonly string[]>> = {
  '222': ["R U R' U' F' U F R2", "U2 R F2 U' R2"],
  pyra: ["R U' L B' r u'", "L R' U B U' l'"],
  skewb: ["R U' L' B R' L U' B'", "U R' B L' U'"],
};

const GOLDEN = [
  ['222', "R U R' U' F' U F R2", [7, "U |R2|U'|R2|F'|U |F "], [
    ['U', "U2|F'|U |F |U'"], ['R', "F2|R'|F "], ['F', "R'|F'|U2"],
    ['D', "U |R'|U'|R2"], ['L', "R |U2|R'|U2"], ['B', "R'|U2|R'"],
  ]],
  ['222', "U2 R F2 U' R2", [5, "R2|U |F2|R'|U2"], [
    ['U', "R2|U |F2|R'"], ['R', 'U |F2|U |R2'], ['F', "U'|R'|U'|F'"],
    ['D', "R2|U |F2|R'"], ['L', 'U |R2|U |F2'], ['B', "U |R |U |F'|U2"],
  ]],
  ['pyra', "R U' L B' r u'", [6, "B |L'|U |R'|r'|u "], [
    ['D', "B |L'|R'"], ['L', "B |L'|U "], ['R', "L'|R'|B |U "], ['F', "B |L'|U |R'"],
  ]],
  ['pyra', "L R' U B U' l'", [6, "U |B'|U'|R |L'|l "], [
    ['D', "B'|R |L'"], ['L', "B'|U'|L'|U "], ['R', "B'|R "], ['F', "B'|R |L'"],
  ]],
  ['skewb', "R U' L' B R' L U' B'", [8, "B|U|L'|R|B'|L|U|R'"], [
    ['U', "U |L'|U'|L'|R "], ['R', "R'|U |R |L'|U |L "],
    ['F', "R |L'|R'|U |R'"], ['D', "L'|B |R'|B |U |B "],
    ['L', "R |B |U'|R'|U'"], ['B', "R |B |R'|B'|R'"],
  ]],
  ['skewb', "U R' B L' U'", [5, "U|L|B'|R|U'"], [
    ['U', "L'|B'|U |L'"], ['R', "R |B'|L'|R'"], ['F', "R |U |R'|L |B'"],
    ['D', 'U |L |B |L '], ['L', "U |L |B'|R |U'"], ['B', "U |L |B'|R |U'"],
  ]],
] as const;

function legacyWebHints(event: TimerSmallHintEvent, scramble: string): TimerSmallHintResult {
  switch (event) {
    case '222':
      return { full: solve2x2(scramble), faces: solve2x2Face(scramble) };
    case 'pyra':
      return { full: solvePyra(scramble), faces: solvePyraV(scramble) };
    case 'skewb':
      return { full: solveSkewb(scramble), faces: solveSkewbFace(scramble) };
  }
}

function summarize(event: TimerSmallHintEvent, scramble: string, result: TimerSmallHintResult) {
  return [
    event,
    scramble,
    [result.full.length, result.full.moves.join('|')],
    result.faces.map((face) => [face.face, face.moves.join('|')]),
  ];
}

describe('Timer small-hints Web-to-shared migration', () => {
  it('keeps the thin Web adapters exactly equal to the shared dispatcher', () => {
    for (const event of Object.keys(CASES) as TimerSmallHintEvent[]) {
      for (const scramble of CASES[event]) {
        expect(legacyWebHints(event, scramble)).toEqual(
          solveTimerSmallHints(event, scramble),
        );
      }
    }
  });

  it('locks full moves, lengths, face order and every face answer', () => {
    const actual = (Object.keys(CASES) as TimerSmallHintEvent[]).flatMap((event) => (
      CASES[event].map((scramble) => summarize(
        event,
        scramble,
        solveTimerSmallHints(event, scramble),
      ))
    ));
    expect(actual).toEqual(GOLDEN);
  });
});
