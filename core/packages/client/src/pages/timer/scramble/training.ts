/**
 * Last-layer / EG training scrambles. For each set we pick a random alg from
 * the corresponding list and emit its inverse — applying that to a solved
 * cube produces the case the user then practices.
 */

import { invertAlg } from './invert';
import { OLL_ALGS } from './algs/oll';
import { PLL_ALGS } from './algs/pll';
import { COLL_ALGS } from './algs/coll';
import { CMLL_ALGS } from './algs/cmll';
import { ZBLL_ALGS } from './algs/zbll';
import { EG1_ALGS } from './algs/eg1';
import { EG2_ALGS } from './algs/eg2';

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function makeTrainer(set: readonly string[]): (rng: () => number) => string {
  return (rng) => invertAlg(pick(set, rng));
}

export const scrambleOll = makeTrainer(OLL_ALGS);
export const scramblePll = makeTrainer(PLL_ALGS);
export const scrambleColl = makeTrainer(COLL_ALGS);
export const scrambleCmll = makeTrainer(CMLL_ALGS);
export const scrambleZbll = makeTrainer(ZBLL_ALGS);
export const scrambleEg1 = makeTrainer(EG1_ALGS);
export const scrambleEg2 = makeTrainer(EG2_ALGS);
