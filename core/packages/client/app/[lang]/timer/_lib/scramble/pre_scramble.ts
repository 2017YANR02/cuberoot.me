/**
 * Pre-scramble orientation — csTimer parity (`preScr` / `preScrT`).
 *
 * A fixed cube rotation applied BEFORE the scramble: the orientation you hold
 * the cube in when you start scrambling. It only affects the rendered scramble
 * image — the scramble text stays canonical (same as csTimer, which prepends
 * the prefix inside its image module, see tools/cstimer/js/cstimer.js:244).
 *
 * Labels read "(<up><front>) <rotation>": (UF) = white up / green front = no
 * rotation; (DF) z2 = yellow up / green front.
 *
 * Two independent settings, mirroring csTimer: `preScr` for normal scrambles,
 * `preScrT` for training scrambles (CFOP-step / LL-subset events). csTimer
 * defaults the latter to z2 because last-layer cases are read yellow-up.
 *
 * Cube-shaped events only (rotations are NxN notation) — see nxnSizeForEvent.
 */
import type { EventId } from '../types';
import { nxnSizeForEvent } from '../cube/colors';

export interface PreScrambleOption {
  /** Rotation prefix, '' = identity (UF). */
  value: string;
  /** csTimer-style label: up-face + front-face, then the rotation. */
  label: string;
}

/** The 24 cube orientations, in csTimer's order (cstimer.js:468). */
export const PRE_SCRAMBLES: readonly PreScrambleOption[] = [
  { value: '',      label: '(UF)' },
  { value: 'y',     label: "(UR) y" },
  { value: 'y2',    label: '(UB) y2' },
  { value: "y'",    label: "(UL) y'" },
  { value: 'z2',    label: '(DF) z2' },
  { value: 'z2 y',  label: '(DL) z2 y' },
  { value: 'z2 y2', label: '(DB) z2 y2' },
  { value: "z2 y'", label: "(DR) z2 y'" },
  { value: "z'",    label: "(RF) z'" },
  { value: "z' y",  label: "(RD) z' y" },
  { value: "z' y2", label: "(RB) z' y2" },
  { value: "z' y'", label: "(RU) z' y'" },
  { value: 'z',     label: '(LF) z' },
  { value: 'z y',   label: '(LU) z y' },
  { value: 'z y2',  label: '(LB) z y2' },
  { value: "z y'",  label: "(LD) z y'" },
  { value: "x'",    label: "(BU) x'" },
  { value: "x' y",  label: "(BR) x' y" },
  { value: "x' y2", label: "(BD) x' y2" },
  { value: "x' y'", label: "(BL) x' y'" },
  { value: 'x',     label: '(FD) x' },
  { value: 'x y',   label: '(FR) x y' },
  { value: 'x y2',  label: '(FU) x y2' },
  { value: "x y'",  label: "(FL) x y'" },
];

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

/** Prepend the orientation prefix to a scramble (for image rendering only). */
export function applyPreScramble(scramble: string, prefix: string): string {
  return prefix ? `${prefix} ${scramble}` : scramble;
}
