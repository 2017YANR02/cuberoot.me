/**
 * Pre-scramble orientation — csTimer parity (`preScr` / `preScrT`).
 *
 * A fixed cube rotation applied BEFORE the scramble: the orientation you hold
 * the cube in when you start scrambling. It only affects the rendered scramble
 * image — the scramble text stays canonical (same as csTimer, which prepends
 * the prefix inside its image module, see tools/cstimer/js/cstimer.js:244).
 *
 * The 24 orientations themselves live in `@/lib/cube-orientation`
 * (`CUBE_ORIENTATIONS` / `applyOrientationPrefix`) — /predict reads the same
 * table. What stays here is the csTimer-specific part: which of the two
 * settings applies to which event.
 *
 * Two independent settings, mirroring csTimer: `preScr` for normal scrambles,
 * `preScrT` for training scrambles (CFOP-step / LL-subset events). csTimer
 * defaults the latter to z2 because last-layer cases are read yellow-up.
 *
 * Cube-shaped events only (rotations are NxN notation) — see nxnSizeForEvent.
 */
import type { EventId } from '../types';
import { nxnSizeForEvent } from '../cube/colors';

/** CFOP-step + LL-subset trainers — these use `preScrT`, not `preScr`. */
const TRAINING_EVENTS = new Set<EventId>([
  'cross', 'f2l', 'll', 'oll', 'pll',
  'coll', 'cmll', 'zbll', 'eg1', 'eg2',
]);

export function isTrainingEvent(event: EventId): boolean {
  return TRAINING_EVENTS.has(event);
}

/** Which of the two settings applies to this event; '' when not cube-shaped. */
export function preScrambleFor(event: EventId, preScr: string, preScrT: string): string {
  if (nxnSizeForEvent(event) === null) return '';
  return isTrainingEvent(event) ? preScrT : preScr;
}
