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
import { faceletToCubie, validateCubie, type CubieCube } from '@/lib/cube-facelet';
import { inverseCubie, isSolvedCubie, multiply } from '../scramble/kociemba/cube';
import { solve333 } from '../scramble/kociemba/random_state';
import { hintScramble, parseHintableScramble, type ScrambleHint } from './scramble_hint';

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
  let a: CubieCube;
  let b: CubieCube;
  try {
    a = faceletToCubie(toFaceletString(from));
    b = faceletToCubie(toFaceletString(target));
  } catch {
    return null;
  }
  const composite = multiply(inverseCubie(a), b);
  if (isSolvedCubie(composite)) return null;
  if (validateCubie(composite) !== null) return null;
  return composite;
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

/* ────────────────────────────────────────────────────────────────────── *
 *  Asking for one, at the speed a cube is actually turned
 * ────────────────────────────────────────────────────────────────────── */

export interface FixupDeps {
  /** Where the cube is right now. Null if there is no cube. */
  faces: () => CubeFaces | null;
  /** Solve `from` → `target`. Defaults to `fixupScramble`. */
  solve?: (from: CubeFaces, target: CubeFaces) => Promise<string | null>;
  /**
   * Is a correction still wanted? False once the scramble has been replaced or
   * the solve has started — checked before every attempt, since each one waits
   * on the solver.
   */
  valid: (target: CubeFaces) => boolean;
}

export interface FixupResult {
  /** The state the path starts from — the hint walk needs it. */
  from: CubeFaces;
  /** The path, in plain face turns. */
  seq: string;
  /** Where the cube is along it, as of now. */
  hint: ScrambleHint;
}

export interface FixupRequester {
  /** Null when there is nothing to offer. Never rejects. */
  request(target: CubeFaces): Promise<FixupResult | null>;
  busy(): boolean;
}

/**
 * Serialises fix-up requests and re-solves when the cube moves mid-solve.
 *
 * The solve takes ~100-200 ms — less than one turn of a cube. So by the time an
 * answer arrives the cube may already be somewhere else, and a path from where
 * it WAS fits nothing. Re-solving from the new state is the difference between
 * a correction that appears every time and one that appears every other time.
 *
 * Lives here rather than in the view because it is the part with branches:
 * fits / cube moved / already home / superseded / still moving.
 */
export function createFixupRequester(deps: FixupDeps, opts: { attempts?: number } = {}): FixupRequester {
  const solve = deps.solve ?? fixupScramble;
  const attempts = opts.attempts ?? 3;
  let working = false;
  return {
    busy: () => working,
    async request(target: CubeFaces): Promise<FixupResult | null> {
      // One at a time: every off-path turn would otherwise queue another solve.
      if (working) return null;
      working = true;
      try {
        for (let i = 0; i < attempts; i++) {
          const from = deps.faces();
          if (!from) return null;
          if (!deps.valid(target)) return null;
          const seq = await solve(from, target);
          if (!seq) return null;
          const now = deps.faces() ?? from;
          const hint = hintScramble(seq, now, from);
          // Reached the scramble while we were solving — the plain "scrambled"
          // verdict says everything, so offer nothing.
          if (hint?.complete) return null;
          if (hint) return { from, seq, hint };
          // Turned again mid-solve: try from wherever it is now.
        }
        return null;
      } finally {
        working = false;
      }
    },
  };
}
