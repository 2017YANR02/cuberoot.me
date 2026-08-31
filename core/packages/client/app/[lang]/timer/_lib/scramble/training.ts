/**
 * Web settings adapter over the canonical shared trainer provider.
 *
 * Case corpora, selection and inversion live in @cuberoot/shared/timer so
 * Android, iOS and Web always receive the same cases.
 */
import {
  generateTimerTrainerScramble,
  type TimerTrainerEventId,
} from '@cuberoot/shared/timer';
import { getSettings } from '../settings';

export type TrainerKind = Exclude<TimerTrainerEventId, 'll'>;

const lastPickedCase = new Map<TrainerKind, string>();

export function getLastPickedCase(kind: TrainerKind): string | null {
  return lastPickedCase.get(kind) ?? null;
}

function generate(
  kind: TrainerKind,
  rng: () => number,
  caseIds?: readonly string[],
): string {
  const generated = generateTimerTrainerScramble(kind, { caseIds, random: rng });
  lastPickedCase.set(kind, generated.caseId);
  return generated.scramble;
}

export function scrambleOll(rng: () => number): string {
  return generate('oll', rng, getSettings().ollSubset);
}

export function scramblePll(rng: () => number): string {
  return generate('pll', rng, getSettings().pllSubset);
}

export const scrambleColl = (rng: () => number): string => generate('coll', rng);
export const scrambleCmll = (rng: () => number): string => generate('cmll', rng);
export const scrambleZbll = (rng: () => number): string => generate('zbll', rng);
export const scrambleEg1 = (rng: () => number): string => generate('eg1', rng);
export const scrambleEg2 = (rng: () => number): string => generate('eg2', rng);
