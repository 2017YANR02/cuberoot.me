/**
 * Drill mode — generate a scramble that, when solved with cross+F2L, leaves
 * the user with a *specific* OLL or PLL case to drill repeatedly.
 *
 * Strategy (matches the established trainer pattern in `training.ts`):
 *   1. Take the case's solving algorithm.
 *   2. Invert it. Applying the inverse to a solved cube yields the case
 *      pre-state (cross + F2L solved, only the LL pattern is the chosen case).
 *   3. Prepend a random AUF (nothing / U / U2 / U') so the case isn't always
 *      identically oriented.
 *
 * For PLL we use the `noAuf` alg — same shape as `pll_cases.ts`.
 *
 * Invalid case names yield an empty scramble (caller treats as "no-op"); the
 * timer never crashes on a stale id.
 */

import { invertAlg } from './invert';
import { OLL_CASES } from './algs/oll_cases';
import { PLL_CASES } from './algs/pll_cases';

export type DrillType = 'oll' | 'pll';

export interface DrillScramble {
  scramble: string;
  targetCase: string;
}

const AUFS = ['', 'U', 'U2', "U'"] as const;

function pickAuf(rng: () => number): string {
  return AUFS[Math.floor(rng() * AUFS.length)];
}

function findCase(type: DrillType, caseName: string): { id: string; alg: string } | null {
  const list = type === 'oll' ? OLL_CASES : PLL_CASES;
  const hit = list.find(c => c.id === caseName);
  if (!hit) return null;
  return { id: hit.id, alg: hit.alg };
}

export function generateDrillScramble(
  type: DrillType,
  caseName: string,
  rng: () => number = Math.random,
): DrillScramble | null {
  const c = findCase(type, caseName);
  if (!c) return null;
  const inv = invertAlg(c.alg);
  if (!inv) return null;
  const auf = pickAuf(rng);
  const scramble = auf ? `${auf} ${inv}` : inv;
  return { scramble, targetCase: c.id };
}

export function listDrillCases(type: DrillType): string[] {
  const list = type === 'oll' ? OLL_CASES : PLL_CASES;
  return list.map(c => c.id);
}
