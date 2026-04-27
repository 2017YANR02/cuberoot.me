/**
 * Relay scrambles — emit one scramble per line, each prefixed with the cube's
 * label so the user knows which puzzle to solve next.
 *
 *   r3 = 2x2 + 3x3
 *   r4 = 2x2 + 3x3 + 4x4
 *   r5 = 2x2 + 3x3 + 4x4 + 5x5
 */

import { scramble222, scramble333, scramble444, scramble555 } from './nxnxn';

export function scrambleR3(rng: () => number): string {
  return [
    `2x2: ${scramble222(rng)}`,
    `3x3: ${scramble333(rng)}`,
  ].join('\n');
}

export function scrambleR4(rng: () => number): string {
  return [
    `2x2: ${scramble222(rng)}`,
    `3x3: ${scramble333(rng)}`,
    `4x4: ${scramble444(rng)}`,
  ].join('\n');
}

export function scrambleR5(rng: () => number): string {
  return [
    `2x2: ${scramble222(rng)}`,
    `3x3: ${scramble333(rng)}`,
    `4x4: ${scramble444(rng)}`,
    `5x5: ${scramble555(rng)}`,
  ].join('\n');
}
