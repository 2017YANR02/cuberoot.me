/**
 * CFOP step trainers.
 *
 * cross — full random 3x3 scramble; the user practices solving the cross
 *         (which step they're on is up to them).
 *
 * f2l   — full random 3x3 scramble. NOTE: a "true" F2L trainer would scramble
 *         the cube but leave the D-cross solved. Doing that without a full
 *         optimal solver would require rewriting Kociemba in scramble/, which
 *         is out of scope for Round 1B; for now we emit a regular scramble and
 *         document this. Users can solve cross first then practice F2L cases.
 *
 * ll    — last-layer training. We pick a random PLL alg, concatenate a random
 *         OLL alg, and emit the inverse of the combined sequence as the
 *         scramble. Applying it to a solved cube produces a state where every
 *         layer except LL is solved (since we built the state purely from
 *         last-layer-only algs run on a solved cube — no other pieces move).
 */

import { scramble333 } from './nxnxn';
import { invertAlg } from './invert';
import { OLL_ALGS } from './algs/oll';
import { PLL_ALGS } from './algs/pll';

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function scrambleCross(rng: () => number): string {
  return scramble333(rng);
}

export function scrambleF2l(rng: () => number): string {
  // See file header — true F2L isolation requires a solver. v1: regular scramble.
  return scramble333(rng);
}

export function scrambleLl(rng: () => number): string {
  const oll = pick(OLL_ALGS, rng);
  const pll = pick(PLL_ALGS, rng);
  // Solving sequence = OLL then PLL. Setup = inverse of (OLL PLL) = PLL' OLL'.
  const combined = `${oll} ${pll}`;
  return invertAlg(combined);
}
