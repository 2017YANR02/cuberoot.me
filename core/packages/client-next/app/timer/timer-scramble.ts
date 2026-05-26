/**
 * Scramble generator — thin wrapper over cubing.js random-state scramble.
 *
 * Maps timer EventId → cubing.js eventId. Falls back to inline random-move
 * NxN for events cubing.js can't handle (high-N, mirror blocks, custom).
 *
 * NOTE: minimal port; the original timer pipeline at
 * packages/client/src/pages/timer/scramble/index.ts supports drill / training /
 * bld / relay / CFOP-step scrambles. Those are deferred.
 */

import type { EventId } from './timer-db';

const TIMER_TO_WCA: Partial<Record<EventId, string>> = {
  '222': '222', '333': '333', '444': '444', '555': '555', '666': '666', '777': '777',
  '333oh': '333oh', '333fm': '333fm',
  pyra: 'pyram', skewb: 'skewb', sq1: 'sq1', mega: 'minx', clock: 'clock',
  '333bld': '333bld', '444bld': '444bld', '555bld': '555bld', '333mbld': '333bld',
};

const FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
const AXIS: Record<string, number> = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
const SUFFIXES = ['', "'", '2'] as const;

function randomMoveNxN(N: number): string {
  if (N < 2) return '';
  const length = N >= 5 ? 20 * (N - 2) : Math.max(20, 9 * N);
  const maxDepth = Math.max(1, Math.floor(N / 2));
  const moves: string[] = [];
  let prevAxis = -1;
  let prevPrevAxis = -1;
  let prevFace = '';
  while (moves.length < length) {
    const face = FACES[Math.floor(Math.random() * 6)];
    const axis = AXIS[face];
    if (face === prevFace) continue;
    if (axis === prevAxis && axis === prevPrevAxis) continue;
    const depth = 1 + Math.floor(Math.random() * maxDepth);
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    const prefix = depth >= 3 ? String(depth) : '';
    const wide = depth >= 2 ? 'w' : '';
    moves.push(`${prefix}${face}${wide}${suffix}`);
    prevPrevAxis = prevAxis;
    prevAxis = axis;
    prevFace = face;
  }
  return moves.join(' ');
}

export async function generateScramble(event: EventId): Promise<string> {
  const wca = TIMER_TO_WCA[event];
  if (wca) {
    try {
      const { randomScrambleForEvent } = await import('cubing/scramble');
      const a = await randomScrambleForEvent(wca);
      return a.toString();
    } catch (err) {
      console.warn('[timer] random-state scramble failed:', err);
    }
  }
  // 333mr / custom etc. fall through to NxN random-move on 3x3.
  return randomMoveNxN(3);
}
