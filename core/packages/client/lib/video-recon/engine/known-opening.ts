import { toMoveStringStrict } from '@cuberoot/shared/alg-notation';
import { getCube3 } from '@cuberoot/shared/recon/cube3';
import { CUBE_GRIP_ROTATIONS } from './cube-orientation';
import type { MoveSearchResult } from './move-search-types';

/** Keep the timer's scramble and express the observed moves in that frame.
 * Color evidence can miss hidden pieces, so require the full opening state. */
export async function alignKnownOpening(scramble: string, result: MoveSearchResult, lastMoveFrame = Infinity) {
  if (result.status !== 'solved' || !result.inferred_scramble || !result.steps.length) return;
  const solved = (await getCube3()).defaultPattern();
  try {
    const given = solved.applyAlg(toMoveStringStrict(scramble));
    const observed = solved.applyAlg(result.inferred_scramble);
    const grip = CUBE_GRIP_ROTATIONS.find(rotation => given.applyAlg(rotation).isIdentical(observed));
    if (grip === undefined) return;
    const moves = result.steps.filter(step => step.frame_index <= lastMoveFrame).flatMap(step => step.state_moves);
    if (!moves.length || !observed.applyAlg(moves.join(' ')).experimentalIsSolved({
      ignorePuzzleOrientation: true, ignoreCenterOrientation: true,
    })) return;
    const [first, ...rest] = result.steps;
    return { ...result, inferred_scramble: undefined, unprocessed_steps: undefined,
      steps: grip ? [{ ...first, state_moves: [...grip.split(' '), ...first.state_moves] }, ...rest] : result.steps };
  } catch {
    // Unsupported notation cannot certify this candidate.
  }
}
