/**
 * Color-neutral scramble wrapper.
 *
 * Standard 333 scrambles assume a fixed (white-top) starting orientation. To
 * simulate color-neutral solving without breaking the random-state property
 * of the underlying generator, we prepend a random cube rotation. The cube
 * state is the same; only the user's perceived cross color changes.
 *
 *   - none   : identity (white cross)
 *   - dual   : white / yellow (50% identity, 50% x2)
 *   - single : random one of 6 orientations
 *   - six    : same as single
 *
 * Only meaningful for 3x3-shaped events. Other events return the scramble
 * unchanged.
 */
import type { EventId } from '../types';

export type CnMode = 'none' | 'single' | 'dual' | 'six';

const SIX_ROTATIONS = ['', 'x', "x'", 'x2', 'z', "z'"] as const;
const DUAL_ROTATIONS = ['', 'x2'] as const;

const CN_3X3_EVENTS = new Set<EventId>([
  '333', '333oh', '333fm',
  'oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2',
  'cross', 'f2l', 'll',
]);

export function isCnEligible(event: EventId): boolean {
  return CN_3X3_EVENTS.has(event);
}

export function applyColorNeutral(
  scramble: string,
  mode: CnMode,
  rng: () => number = Math.random,
): string {
  if (mode === 'none') return scramble;
  const pool = mode === 'dual' ? DUAL_ROTATIONS : SIX_ROTATIONS;
  const pick = pool[Math.floor(rng() * pool.length)] ?? '';
  if (!pick) return scramble;
  return `${pick} ${scramble}`;
}
