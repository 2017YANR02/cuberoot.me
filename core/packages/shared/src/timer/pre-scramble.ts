/**
 * Pre-scramble orientation — csTimer parity (`preScr` / `preScrT`).
 *
 * A fixed cube rotation applied BEFORE the scramble: the orientation you hold
 * the cube in when you start scrambling. The scramble text stays local to
 * that grip. Training also maps the smart cube's physical target, guidance
 * and recorded scramble to this grip; raw BLE moves stay in the device frame.
 *
 * The 24 orientations themselves live in `./cube-orientation`
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
import type { EventId } from './types';
import { timerEventNxnSize as nxnSizeForEvent, timerPuzzleSelection } from './event-catalog';
import { normalizeWcaScramble } from '../normalize_wca_scramble';

export interface TimerPreScrambleSettings {
  preScr: string;
  preScrT: string;
}

export function normalizeTimerPreScrambleSettings(value: Partial<Record<keyof TimerPreScrambleSettings, unknown>> = {}): TimerPreScrambleSettings {
  const rotation = (input: unknown, fallback: string) => typeof input === 'string'
    && input.length <= 128 && /^(?:[xyz](?:2|')?(?:\s+[xyz](?:2|')?)*)?$/.test(input.trim()) ? input.trim() : fallback;
  return { preScr: rotation(value.preScr, ''), preScrT: rotation(value.preScrT, 'z2') };
}

/** CFOP-step + LL-subset trainers — these use `preScrT`, not `preScr`. */
const TRAINING_EVENTS = new Set<EventId>([
  'cross', 'f2l', 'll', 'oll', 'pll',
  'coll', 'cmll', 'zbll', 'eg1', 'eg2',
  'cll', 'ell', 'eocp', '2gll', 'ollcp', 'zzll', 'zbls', 'lse', 'l10p',
]);

export function isTrainingEvent(event: EventId): boolean {
  return TRAINING_EVENTS.has(event);
}

/** Smart 3x3 drills share the preview's training grip; WCA keeps its device frame. */
export function timerSmartCubeTrainingOrientation(event: EventId, preScrT = 'z2'): string {
  const selection = timerPuzzleSelection(event);
  return selection.puzzle === '333' && selection.scrambleType !== 'wca'
    ? normalizeTimerPreScrambleSettings({ preScrT }).preScrT : '';
}

/** Snapshot the performed scramble in the same physical frame as recorded BLE moves. */
export function timerSmartCubeAttemptScramble(event: EventId, scramble: string, preScrT = 'z2'): string {
  const orientation = timerSmartCubeTrainingOrientation(event, preScrT);
  const selection = timerPuzzleSelection(event);
  return selection.puzzle === '333' && selection.scrambleType !== 'wca'
    ? normalizeWcaScramble(`${orientation} ${scramble}`) ?? scramble : scramble;
}

/** Which of the two settings applies to this event; '' when not cube-shaped. */
export function preScrambleFor(event: EventId, preScr: string, preScrT: string): string {
  if (nxnSizeForEvent(event) === null) return '';
  return isTrainingEvent(event) ? preScrT : preScr;
}
