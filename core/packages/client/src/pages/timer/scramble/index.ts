/**
 * Scramble dispatcher — picks the right generator per event id.
 *
 * RNG default uses Math.random; tests can pass a seeded RNG for determinism.
 */

import type { EventId } from '../types';
import {
  scramble222,
  scramble333,
  scramble444,
  scramble555,
  scramble666,
  scramble777,
} from './nxnxn';
import {
  scramblePyra,
  scrambleSkewb,
  scrambleSq1,
  scrambleMega,
  scrambleClock,
} from './others';

export function generateScramble(event: EventId, rng: () => number = Math.random): string {
  switch (event) {
    case '222':   return scramble222(rng);
    case '333':   return scramble333(rng);
    case '333oh': return scramble333(rng);
    case '333bld':return scramble333(rng);
    case '333fm': return scramble333(rng);
    case '444':   return scramble444(rng);
    case '555':   return scramble555(rng);
    case '666':   return scramble666(rng);
    case '777':   return scramble777(rng);
    case 'pyra':  return scramblePyra(rng);
    case 'skewb': return scrambleSkewb(rng);
    case 'sq1':   return scrambleSq1(rng);
    case 'mega':  return scrambleMega(rng);
    case 'clock': return scrambleClock(rng);
  }
}

/**
 * Mulberry32 — small deterministic PRNG, useful for tests.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
