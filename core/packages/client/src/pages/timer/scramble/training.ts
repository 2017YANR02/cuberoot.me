/**
 * Last-layer / EG training scrambles. For each set we pick a random alg from
 * the corresponding list and emit its inverse — applying that to a solved
 * cube produces the case the user then practices.
 *
 * OLL / PLL also honour user-selected case subsets from settings
 * (`ollSubset` / `pllSubset`) when non-empty.
 */

import { invertAlg } from './invert';
import { COLL_ALGS } from './algs/coll';
import { CMLL_ALGS } from './algs/cmll';
import { ZBLL_ALGS } from './algs/zbll';
import { EG1_ALGS } from './algs/eg1';
import { EG2_ALGS } from './algs/eg2';
import { OLL_CASES } from './algs/oll_cases';
import { PLL_CASES } from './algs/pll_cases';
import { getSettings } from '../settings';

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function makeTrainer(set: readonly string[]): (rng: () => number) => string {
  return (rng) => invertAlg(pick(set, rng));
}

function pickFromCases<T extends { id: string; alg: string }>(
  all: readonly T[],
  subset: string[] | undefined,
  rng: () => number,
): T {
  if (subset && subset.length > 0) {
    const filtered = all.filter(c => subset.includes(c.id));
    if (filtered.length > 0) return pick(filtered, rng);
  }
  return pick(all, rng);
}

export function scrambleOll(rng: () => number): string {
  const c = pickFromCases(OLL_CASES, getSettings().ollSubset, rng);
  return invertAlg(c.alg);
}

export function scramblePll(rng: () => number): string {
  const c = pickFromCases(PLL_CASES, getSettings().pllSubset, rng);
  return invertAlg(c.alg);
}

export const scrambleColl = makeTrainer(COLL_ALGS);
export const scrambleCmll = makeTrainer(CMLL_ALGS);
export const scrambleZbll = makeTrainer(ZBLL_ALGS);
export const scrambleEg1 = makeTrainer(EG1_ALGS);
export const scrambleEg2 = makeTrainer(EG2_ALGS);
