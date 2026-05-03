/**
 * Plain WCA-style scramble generation for callers that just want a random
 * scramble for a given event — no timer settings (sync seed, color-neutral
 * mode), no side effects.
 *
 * Why this lives in utils but imports from pages/timer/scramble/: the
 * concrete random-move / random-state scramblers are pure (no React, no
 * settings, no DOM). Physically relocating them got tangled because
 * pages/timer/scramble/others.ts cross-imports pages/timer/solver/{pyra,skewb}
 * for random-state, and the kociemba worker has Vite-specific bundling. Until
 * that's untangled, a thin shim here is the cleanest decoupling we can do.
 */

import {
  scramble222, scramble333, scramble444, scramble555, scramble666, scramble777,
} from '../pages/timer/scramble/nxnxn';
import {
  scramblePyra, scrambleSkewb, scrambleSq1, scrambleMega, scrambleClock,
} from '../pages/timer/scramble/others';

/**
 * Generate a scramble for the given event id (the '3x3' / '3bld' / 'oh' /
 * 'fmc' shapes used in EVENTS inside ReconSubmitPage; pass '3x3' for plain
 * 3x3 needs like the analyze page). Returns null for events we can't
 * auto-generate (mbld) so callers can disable their UI.
 */
export function randomScrambleForEvent(event: string): string | null {
  const r = Math.random;
  switch (event) {
    case '2x2':   return scramble222(r);
    case '3x3':   return scramble333(r);
    case '4x4':   return scramble444(r);
    case '5x5':   return scramble555(r);
    case '6x6':   return scramble666(r);
    case '7x7':   return scramble777(r);
    case 'oh':    return scramble333(r);
    case '3bld':  return scramble333(r);
    case '4bld':  return scramble444(r);
    case '5bld':  return scramble555(r);
    case 'pyra':  return scramblePyra(r);
    case 'skewb': return scrambleSkewb(r);
    case 'sq1':   return scrambleSq1(r);
    case 'mega':  return scrambleMega(r);
    case 'clock': return scrambleClock(r);
    case 'fmc': {
      // WCA FMC scrambles are bracketed by `R' U' F` on both sides.
      return `R' U' F ${scramble333(r)} R' U' F`;
    }
    case 'mbld':  return null;
    default:      return null;
  }
}
