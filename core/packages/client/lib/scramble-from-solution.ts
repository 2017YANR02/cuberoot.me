/**
 * Derive the scramble that a reconstruction (solution) solves.
 *
 * cubedb.net's "magnifying glass" feature: paste a full solve (multi-line,
 * `// stage` comments, regrip/inspection markers) and get back the clean,
 * rotation-free WCA-style scramble it solves.
 *
 * Pipeline (all via cubing.js — no custom rotation/slice math):
 *   1. cleanForPlayer — strip comments / regrip markers / zero-width chars,
 *      split glued tokens. Keeps rotations (x y z), wide (Rw r), slices (M E S).
 *   2. invert — the scramble is the inverse of the solution.
 *   3. re-orient — the solution's inspection / mid-solve rotations leave a net
 *      whole-cube rotation, so the inverted state has non-standard centers and
 *      the 3x3 solver rejects it. Find the rotation r (of 24) that, *prepended*,
 *      brings centers home. Prepend (not append) so corner/edge state vs the
 *      solution is preserved: r·invert(sol) · sol = r (a pure rotation).
 *   4. solve the oriented state ignoring center orientation → ~20-move solution.
 *   5. invert that solution → a clean, minimal, rotation-free scramble.
 *
 * 3x3-only (the solver is 3x3). Verified: for every fixture, derived scramble +
 * cleaned full solution returns to solved up to a whole-cube rotation.
 */
import { Alg } from 'cubing/alg';
import { equivalentClean333Scramble } from '@cuberoot/shared/timer';
import { cleanForPlayer } from '@/lib/recon-alg-utils';

/**
 * 给「从还原态出发到某个状态的一段 setup(可含转体/宽转/slice)」找一条无转体、
 * 纯面转的等价打乱(两阶段求解器解出该状态再取逆,≈20 步,cstimer 随机态风格)。
 * 状态本身已还原(纯转体也算)或解析失败时返回 `''`。
 */
export async function equivalentCleanScramble(setupAlg: string): Promise<string> {
  return equivalentClean333Scramble(setupAlg);
}

/**
 * @param solutionText raw reconstruction (any of the recon textarea formats)
 * @returns clean rotation-free scramble, or `''` if the solution is empty /
 *          unparseable / already-solved.
 */
export async function deriveScrambleFromSolution(solutionText: string): Promise<string> {
  const cleaned = cleanForPlayer(solutionText).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  let inverted: Alg;
  try {
    inverted = new Alg(cleaned).invert();
  } catch {
    return '';
  }
  // The scramble is whatever reaches the state the solution solves — i.e. the
  // state of the *inverted* solution.
  return equivalentCleanScramble(inverted.toString());
}
