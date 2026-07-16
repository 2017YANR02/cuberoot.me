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
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { getCube3 } from '@/lib/cube3';
import { cleanForPlayer } from '@/lib/recon-alg-utils';

/** Lazily computed once: the 24 whole-cube rotations as Alg strings. */
let _rotationsPromise: Promise<string[]> | null = null;
async function rotationAlgs(kpuzzle: KPuzzle): Promise<string[]> {
  if (_rotationsPromise) return _rotationsPromise;
  _rotationsPromise = (async () => {
    const solved = kpuzzle.defaultPattern();
    const key = (p: KPattern) => JSON.stringify(p.patternData);
    const seen = new Set<string>([key(solved)]);
    const out: string[] = ['']; // identity first → prefer "no rotation"
    let frontier: string[] = [''];
    for (let depth = 0; depth < 6 && frontier.length; depth++) {
      const next: string[] = [];
      for (const seq of frontier) {
        for (const g of ['x', 'y', 'z']) {
          const ns = (seq ? seq + ' ' : '') + g;
          const k = key(solved.applyAlg(new Alg(ns)));
          if (!seen.has(k)) { seen.add(k); out.push(ns); next.push(ns); }
        }
      }
      frontier = next;
    }
    return out;
  })();
  return _rotationsPromise;
}

/**
 * 给「从还原态出发到某个状态的一段 setup(可含转体/宽转/slice)」找一条无转体、
 * 纯面转的等价打乱(两阶段求解器解出该状态再取逆,≈20 步,cstimer 随机态风格)。
 * 状态本身已还原(纯转体也算)或解析失败时返回 `''`。
 */
export async function equivalentCleanScramble(setupAlg: string): Promise<string> {
  const kpuzzle = await getCube3();
  const solved = kpuzzle.defaultPattern();

  let alg: Alg;
  try {
    alg = new Alg(setupAlg);
  } catch {
    return '';
  }

  const centersKey = (p: KPattern) => JSON.stringify(p.patternData.CENTERS);
  const solvedCentersKey = centersKey(solved);

  // setup 里的转体会留下净整体旋转,中心不在家求解器会拒解 —— 找一个 *前置*
  // 旋转 r(24 选一)把中心归位。前置(而非后置)保持棱角相对状态不变。
  const rots = await rotationAlgs(kpuzzle);
  let oriented: KPattern | null = null;
  for (const r of rots) {
    // state of (r · alg): apply r first, then the setup.
    const base = r ? solved.applyAlg(new Alg(r)) : solved;
    const cand = base.applyAlg(alg);
    if (centersKey(cand) === solvedCentersKey) { oriented = cand; break; }
  }
  if (!oriented || oriented.isIdentical(solved)) return '';

  const solution = await experimentalSolve3x3x3IgnoringCenters(oriented);
  // min2phase prints inverted doubles as `R2'`; `R2` reads cleaner for a scramble.
  return solution.invert().toString().replace(/2'/g, '2');
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
