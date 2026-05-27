/**
 * Plain WCA-style scramble generation for callers that just want a random
 * scramble for a given recon event id ('3x3' / '3bld' / 'oh' / 'fmc' / ...).
 *
 * Ported from packages/client/src/utils/scramble.ts but routed through
 * client-next's own scramble registry under app/[lang]/timer/_lib/scramble.
 */

import {
  scramble222, scramble333, scramble444, scramble555, scramble666, scramble777,
} from '@/app/[lang]/timer/_lib/scramble/nxnxn';
import {
  scramblePyra, scrambleSkewb, scrambleSq1, scrambleMega, scrambleClock,
} from '@/app/[lang]/timer/_lib/scramble/others';

/**
 * Generate a scramble for the given recon event id (the '3x3' / '3bld' / 'oh' /
 * 'fmc' shapes used in ReconSubmitForm). Returns null for events we can't
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
    case 'fmc':   return `R' U' F ${scramble333(r)} R' U' F`;
    case 'mbld':  return null;
    default:      return null;
  }
}
