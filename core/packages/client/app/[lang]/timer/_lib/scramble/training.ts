/**
 * Last-layer / EG training scrambles. For each set we pick a random alg from
 * the corresponding list and emit its inverse — applying that to a solved
 * cube produces the case the user then practices.
 *
 * OLL / PLL also honour user-selected case subsets from settings
 * (`ollSubset` / `pllSubset`) when non-empty.
 *
 * Each scrambler also records the picked case id in a module-level map so
 * `recordSolve` (in TimerPage) can attach it to the resulting `Solve.caseId`.
 * For OLL/PLL the id is the case key (e.g. "OLL 1"); for the other trainers
 * we use the raw alg string itself as the id.
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

export type TrainerKind = 'oll' | 'pll' | 'coll' | 'cmll' | 'zbll' | 'eg1' | 'eg2';

const lastPickedCase = new Map<TrainerKind, string>();

export function getLastPickedCase(kind: TrainerKind): string | null {
  return lastPickedCase.get(kind) ?? null;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function makeTrainer(kind: TrainerKind, set: readonly string[]): (rng: () => number) => string {
  return (rng) => {
    const alg = pick(set, rng);
    lastPickedCase.set(kind, alg);
    return invertAlg(alg);
  };
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
  lastPickedCase.set('oll', c.id);
  return invertAlg(c.alg);
}

export function scramblePll(rng: () => number): string {
  const c = pickFromCases(PLL_CASES, getSettings().pllSubset, rng);
  lastPickedCase.set('pll', c.id);
  return invertAlg(c.alg);
}

export const scrambleColl = makeTrainer('coll', COLL_ALGS);
export const scrambleCmll = makeTrainer('cmll', CMLL_ALGS);
export const scrambleZbll = makeTrainer('zbll', ZBLL_ALGS);
export const scrambleEg1 = makeTrainer('eg1', EG1_ALGS);
export const scrambleEg2 = makeTrainer('eg2', EG2_ALGS);
