import { GSolver } from '@cuberoot/puzzle-solvers/cstimer-gsolver';
import { solve222TimerHints } from '@cuberoot/puzzle-solvers/cube222';
import { solvePyra, solvePyraV } from '@cuberoot/puzzle-solvers/pyra';
import {
  SKEWB_FACES,
  SKEWB_MOVE_NAMES,
  SOLVED_SKEWB_FACELET,
  skewbFaceletFromMoves,
  solveSkewbFacelet,
} from '@cuberoot/puzzle-solvers/skewb';

export const TIMER_SMALL_HINT_EVENTS = ['222', 'pyra', 'skewb'] as const;
export type TimerSmallHintEvent = (typeof TIMER_SMALL_HINT_EVENTS)[number];

export interface TimerSmallHintLine {
  readonly face: string;
  readonly moves: readonly string[];
}

export interface TimerSmallHintResult {
  readonly full: {
    readonly moves: readonly string[];
    readonly length: number;
  };
  readonly faces: readonly TimerSmallHintLine[];
}

/** csTimer's six Skewb Face targets, now owned by the shared solver package. */
const SKEWB_FACE_TARGETS: string[] = [
  'UUUUU?RR???FF????????LL???BB??',
  '???BBUUUUU??L?L?FF????????R?R?',
  '?B?B??R?R?UUUUU?F?F???L?L?????',
  '????????RR???BBUUUUU???LL???FF',
  '?BB????????R?R????FFUUUUU??L?L',
  '??F?F??R?R???????B?B?L?L?UUUUU',
];

const SKEWB_AXES = 'RULB';

/*
 * csTimer's Skewb Face coordinate uses a different facelet orientation from
 * the WCA full-state solver. These four cycle sets are its exact canonical
 * coordinate, now kept in one runtime-neutral module instead of each host.
 * Slot order is URFDLB, five stickers per face.
 */
const SKEWB_FACE_MOVE_CYCLES: readonly (readonly (readonly number[])[])[] = [
  [[5, 25, 15], [9, 28, 17], [7, 29, 16], [8, 26, 19], [23, 14, 4]],
  [[0, 20, 25], [2, 21, 27], [4, 22, 29], [1, 23, 26], [19, 7, 11]],
  [[10, 15, 20], [13, 18, 24], [11, 16, 23], [14, 19, 22], [29, 1, 8]],
  [[25, 20, 15], [29, 23, 19], [28, 21, 18], [27, 24, 17], [13, 9, 2]],
];

function cycleSlots(state: string[], cycle: readonly number[], turns: number): void {
  const prior = cycle.map((slot) => state[slot]);
  for (let index = 0; index < cycle.length; index++) {
    state[cycle[(index + turns) % cycle.length]] = prior[index];
  }
}

export function timerSkewbFaceMove(state: string, move: string): string {
  const axis = SKEWB_AXES.indexOf(move.trim()[0]?.toUpperCase() ?? '');
  if (axis < 0) return state;
  const turns = move.trim().endsWith("'") ? 2 : 1;
  const result = state.split('');
  for (const cycle of SKEWB_FACE_MOVE_CYCLES[axis]) cycleSlots(result, cycle, turns);
  return result.join('');
}

function withSkewbSuffixes(): Record<string, number> {
  const moves: Record<string, number> = {};
  for (let axis = 0; axis < SKEWB_AXES.length; axis++) {
    moves[`${SKEWB_AXES[axis]} `] = axis * 0x11;
    moves[`${SKEWB_AXES[axis]}'`] = axis * 0x11;
  }
  return moves;
}

export const TIMER_SKEWB_FACE_MOVES: Record<string, number> = withSkewbSuffixes();

let skewbFaceSolver: GSolver | null = null;

function getSkewbFaceSolver(): GSolver {
  if (!skewbFaceSolver) {
    skewbFaceSolver = new GSolver(SKEWB_FACE_TARGETS, timerSkewbFaceMove, TIMER_SKEWB_FACE_MOVES);
  }
  return skewbFaceSolver;
}

function parseSkewbScramble(scramble: string): string[] {
  const moves: string[] = [];
  for (const token of scramble.trim().split(/\s+/).filter(Boolean)) {
    const match = /^([RULB])(2|'?)$/.exec(token);
    if (!match) continue;
    moves.push(`${match[1]}${match[2] === '2' ? "'" : match[2] || ' '}`);
  }
  return moves;
}

export function applyTimerSkewbFaceScramble(
  scramble: string,
  start: string = SOLVED_SKEWB_FACELET,
): string {
  let state = start;
  for (const move of parseSkewbScramble(scramble)) state = timerSkewbFaceMove(state, move);
  return state;
}

export function solveTimerSkewbFaces(scramble: string): TimerSmallHintLine[] {
  const solver = getSkewbFaceSolver();
  const scrambleMoves = parseSkewbScramble(scramble);
  return SKEWB_FACE_TARGETS.map((target, index) => {
    let state = target;
    for (const move of scrambleMoves) state = timerSkewbFaceMove(state, move);
    return {
      face: SKEWB_FACES[index],
      moves: solver.search(state, 0, 11) ?? [],
    };
  });
}

export function solveTimerSkewb(scramble: string): TimerSmallHintResult['full'] {
  const full = solveSkewbFacelet(skewbFaceletFromMoves(scramble));
  return {
    moves: full.moves.map((move) => SKEWB_MOVE_NAMES[move]),
    length: full.length,
  };
}

/** One runtime-neutral solver dispatcher consumed by both Timer hosts. */
export function solveTimerSmallHints(
  event: TimerSmallHintEvent,
  scramble: string,
): TimerSmallHintResult {
  switch (event) {
    case '222':
      return solve222TimerHints(scramble);
    case 'pyra':
      return {
        full: solvePyra(scramble),
        faces: solvePyraV(scramble),
      };
    case 'skewb': {
      return {
        full: solveTimerSkewb(scramble),
        faces: solveTimerSkewbFaces(scramble),
      };
    }
  }
}
