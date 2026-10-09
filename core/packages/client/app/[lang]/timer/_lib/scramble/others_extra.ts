/**
 * Extra puzzle scrambles not covered by others.ts.
 *
 *   magic   — Rubik's Magic (8 tiles): choose "Forward" or "Backward" practice.
 *   mmagic  — Master Magic (12 tiles): the same directions, prefixed with "M ".
 *             These are CubeRoot's practice directions, not random scrambles.
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
