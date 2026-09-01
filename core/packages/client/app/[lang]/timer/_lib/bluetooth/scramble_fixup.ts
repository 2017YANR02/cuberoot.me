/**
 * When the cube is off the scramble's path: a fresh path from where it is now
 * to the same scrambled state.
 *
 * `hintScramble` can only tell the user which move they owe while the cube is
 * still ON the scramble's path. One wrong turn and it has nothing to say, which
 * is the moment csTimer does something better than "wrong, start over": it asks
 * the solver for a sequence from the cube's CURRENT state to the state the
 * scramble was going to reach, and hints on that instead
 * (`bluetoothutil.js:71`, the `genState` / `genScr` branch).
 *
 * The scramble RECORDED with the solve does not change — the correction path
 * ends at exactly the same state, so the solve is still that scramble. Only the
 * moves the user is told to make change.
 *
 * Direction, since this is the easy thing to get backwards: the worker's
 * `solve` op returns `invertSequence(solveCube(state))`, i.e. a sequence that
 * BUILDS the state from solved, not one that solves it. So we hand it the state
 * we want built — the composite below — and use its answer as-is. There is a
 * test that applies the returned moves to the starting facelets and checks they
 * land on the target, so the convention is pinned rather than trusted.
 */

import type { CubeFaces } from '../cube/state';
import { toFaceletString } from '../cube/state';
import type { CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { smartCubeFixupState } from '@cuberoot/shared/smart-cube/scramble-hint';
import { solve333 } from '../scramble/kociemba/random_state';
import { parseHintableScramble } from './scramble_hint';

/**
 * The state whose generator takes the cube from `from` to `target`.
 *
 * `from * X = target`, so `X = from⁻¹ * target`. Returns null when either state
 * is unreadable or the composite is not physically solvable (which would send
 * the two-phase search off to look for something that does not exist), and null
 * when the two states are already equal — there is nothing to fix.
 *
 * Split out from `fixupScramble` so it is testable without a Web Worker.
 */
export function fixupState(from: CubeFaces, target: CubeFaces): CubieCube | null {
  return smartCubeFixupState(toFaceletString(from), toFaceletString(target));
}

/**
 * A scramble taking the cube from `from` to `target`, in plain face turns.
 *
 * Runs the two-phase solver in its worker, so ~50-200 ms once the tables are
 * warm (they already are: the timer warms them to generate scrambles). Returns
 * null if there is nothing to fix, if the solver fails, or if what came back is
 * not something we can hint on — the caller then falls back to the binary
 * "doesn't match" verdict rather than showing a sequence it cannot track.
 */
export async function fixupScramble(from: CubeFaces, target: CubeFaces): Promise<string | null> {
  const st = fixupState(from, target);
  if (!st) return null;
  let scramble: string;
  try {
    scramble = await solve333(st);
  } catch {
    return null;
  }
  if (!scramble.trim()) return null;
  return parseHintableScramble(scramble) ? scramble : null;
}
