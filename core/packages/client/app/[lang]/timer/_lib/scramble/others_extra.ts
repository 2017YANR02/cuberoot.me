/**
 * Extra puzzle scrambles not covered by others.ts.
 *
 *   magic   — Rubik's Magic. cstimer convention: emit "Forward" or "Backward"
 *             for a 4-piece magic puzzle. We just pick one of those words.
 *   mmagic  — Master Magic (8-piece). Same pick, prefixed with "M ".
 *   custom  — empty string; UI lets the user type their own scramble.
 */

import { formatTimerCompoundScramble } from '@cuberoot/shared/timer';

export function scrambleMagic(rng: () => number): string {
  return formatTimerCompoundScramble('magic', [], rng);
}

export function scrambleMmagic(rng: () => number): string {
  return formatTimerCompoundScramble('mmagic', [], rng);
}

// Underscore-prefixed param so eslint's no-unused-vars accepts it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function scrambleCustom(_rng: () => number): string {
  return '';
}
