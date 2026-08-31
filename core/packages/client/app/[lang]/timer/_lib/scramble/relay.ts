/**
 * Relay scrambles — emit one scramble per line, each prefixed with the cube's
 * label so the user knows which puzzle to solve next.
 *
 *   r3 = 2x2 + 3x3
 *   r4 = 2x2 + 3x3 + 4x4
 *   r5 = 2x2 + 3x3 + 4x4 + 5x5
 */

import {
  TIMER_COMPOUND_SCRAMBLE_CHILDREN,
  formatRelayScramble,
  type TimerRelayChildEventId,
  type TimerRelayScrambleEventId,
} from '@cuberoot/shared/timer';
import { scramble222, scramble333, scramble444, scramble555 } from './nxnxn';

function generateRelayChild(event: TimerRelayChildEventId, rng: () => number): string {
  switch (event) {
    case '222': return scramble222(rng);
    case '333': return scramble333(rng);
    case '444': return scramble444(rng);
    case '555': return scramble555(rng);
  }
}

function generateRelay(event: TimerRelayScrambleEventId, rng: () => number): string {
  const children = TIMER_COMPOUND_SCRAMBLE_CHILDREN[event]
    .map((childEvent) => generateRelayChild(childEvent, rng));
  return formatRelayScramble(event, children);
}

export function scrambleR3(rng: () => number): string {
  return generateRelay('r3', rng);
}

export function scrambleR4(rng: () => number): string {
  return generateRelay('r4', rng);
}

export function scrambleR5(rng: () => number): string {
  return generateRelay('r5', rng);
}
