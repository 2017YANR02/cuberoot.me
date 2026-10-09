/**
 * What a smart cube needs to know to drill an alg set: where to put the cube,
 * and what counts as finishing.
 *
 * Two questions, both answered here so the wiring in `useTrainerCube` has no
 * cube knowledge of its own and both can be tested without a browser.
 *
 * 1. **Where to put the cube.** Every case in the library is stored as a `setup`
 *    that BUILDS it from a solved cube, and the trainer draws its picture from
 *    exactly that string. So the state we want the cube to report is
 *    solved · scramble — no library lookup, no second convention.
 *
 * 2. **What counts as finishing.** A PLL drill ends solved, but an OLL drill
 *    ends with the last layer merely oriented and a COLL drill with its edges
 *    still scrambled. Stopping the clock only on a full solve would make every
 *    partial set unusable, so each set names the step that IS its finish line
 *    (`@cuberoot/shared/timer/reconstruct/steps`). csTimer keeps the same table for the eight
 *    scramble types it can drill (`bluetoothutil.js` `isGiiSolved`); ours covers
 *    the library, which is bigger.
 *
 * Sets with no entry are not broken — they still get the cube placed for them,
 * which is the part that saves real work. They just have no auto-stop, because
 * inventing one would mean either stopping early (a mask that the case already
 * satisfies before you touch it) or never stopping at all. Some 3x3 sets are in
 * that position and they are listed, with the reason, below.
 */

import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { stepSolved, type CubeStep } from '@cuberoot/shared/timer/reconstruct/steps';
import { applyMoves, solved, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { parseScrambleStrict } from '@cuberoot/puzzle-solvers/cube-moves';
import { ALG_SET_TRAINING_STEPS } from '@cuberoot/shared/timer/smart-cube-training';
import { purifyScramble } from '@/lib/trainer-scramble';

/** Does this puzzle have smart cubes at all? */
export function puzzleHasSmartCube(puzzle: AlgPuzzle | null | undefined): boolean {
  return puzzle === '3x3';
}

/**
 * The step that ends a repetition of `setSlug`, or null when we cannot say.
 * Null means "place the cube but let the user stop the clock".
 */
export function algSetStep(puzzle: AlgPuzzle | null | undefined, setSlug: string | null | undefined): CubeStep | null {
  if (!puzzleHasSmartCube(puzzle) || !setSlug) return null;
  return ALG_SET_TRAINING_STEPS[setSlug] ?? null;
}

/**
 * The step for one case. Differs from `algSetStep` only for a mixed session,
 * where each case remembers the set it came from (`srcSet`) and the finish line
 * therefore changes case by case — a PLL drawn next to an OLL has to stop at a
 * different place.
 */
export function caseStep(
  puzzle: AlgPuzzle | null | undefined,
  sessionSet: string | null | undefined,
  c: Pick<AlgCase, 'srcSet'> | null | undefined,
): CubeStep | null {
  return algSetStep(puzzle, c?.srcSet ?? sessionSet);
}

/**
 * The 54-character state the cube should report for this scramble, or null if
 * the scramble cannot be applied.
 *
 * Whole-cube rotations in the scramble (the library prefixes F2L cases with a
 * random `y`) survive as a change of frame only: the state is read relative to
 * its own centres downstream, so the reported case comes out in the frame the
 * cube is already being tracked in. Which is what we want — the user holds the
 * cube however they like, and every step test sweeps orientations anyway.
 *
 * A scramble we cannot fully parse returns null rather than a best guess.
 * Library setups carry regrip marks, grouping brackets and upstream annotations;
 * `purifyScramble` is what strips and expands those, and anything still
 * unrecognised after it would otherwise be dropped silently — leaving the cube
 * reporting a state that is a legal cube but the wrong case, which nothing
 * downstream could detect.
 */
export function caseTargetFacelets(scramble: string | null | undefined): string | null {
  if (!scramble || !scramble.trim()) return null;
  try {
    const { moves, bad } = parseScrambleStrict(purifyScramble('3x3', scramble));
    if (bad.length > 0 || moves.length === 0) return null;
    return toFaceletString(applyMoves(solved(3), 3, moves));
  } catch {
    return null;
  }
}

/**
 * The step to stop this repetition on, or null to leave the stopping to the user.
 *
 * Everything `caseStep` says, plus one guard that has to be here rather than in
 * the table: a case whose finish is ALREADY true the moment it appears would
 * stop the clock on the first turn, every time, and read as a broken timer
 * rather than a wrong table. That is not hypothetical — the library's 302 ZBLS
 * scrambles contain one whose state has the last slot already filled, and a
 * hand-written set of hundreds of cases will always have a few of those. It
 * costs one mask evaluation per case to notice and hand that repetition back to
 * the space bar.
 */
export function autoStopStep(
  puzzle: AlgPuzzle | null | undefined,
  sessionSet: string | null | undefined,
  c: Pick<AlgCase, 'srcSet'> | null | undefined,
  targetFacelets: string | null,
): CubeStep | null {
  const step = caseStep(puzzle, sessionSet, c);
  if (!step || !targetFacelets) return null;
  if (stepSolved(step, targetFacelets)) return null;
  return step;
}

/** For the UI: which 3x3 sets can auto-stop, for a "why not here?" explanation. */
export function setsWithAutoStop(): string[] {
  return Object.keys(ALG_SET_TRAINING_STEPS);
}
