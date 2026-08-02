/*
 * trainer-source — "difficulty" for the timer's RANDOM source on 3×3-shaped events.
 *
 * The WCA-real-scramble source has had a difficulty filter for a while (pick a method, stage,
 * cross colours and a step range; the server serves matching competition scrambles). The
 * random source could not: filtering generated scrambles by re-solving them would be both slow
 * and hopeless for the rare bins. Instead we generate the state directly at the requested
 * difficulty — see lib/cross-trainer, which is the same job the vendored or18 trainers do.
 *
 * The settings vocabulary is deliberately the SAME as the WCA filter's (method / stage /
 * colour subset / step range from lib/scramble-variants), so "std · cross · BGORWY · 5 moves"
 * means one thing on the site, whichever source you draw from. The one extra dimension is the
 * F2L slot, which only or18's paired stages have.
 */

import { canTrain, trainerCaps, trainerSpecKey, type TrainerSpec } from '@/lib/cross-trainer';

/** Events whose scramble is one 3×3 random state (so a cross/F2L difficulty is meaningful). */
const TRAINER_EVENTS = new Set(['333', '333oh', '333bf', '333ft', '333fm']);
export const canTrainerDifficulty = (event: string): boolean => TRAINER_EVENTS.has(event);

/** `genDiffSlot` sentinel: the easiest of the four F2L slots rather than a fixed one. */
export const SLOT_BEST = -1;

export interface GenDiffSettings {
  genDiffOn: boolean;
  genDiffVariant: string;
  genDiffStage: string;
  genDiffColors: string;
  genDiffSlot: number;
  genDiffSteps: number[];
}

/**
 * The spec to generate from, or null when the trainer source doesn't apply
 * (wrong event, switched off, unsupported stage, or an empty step range).
 */
export function trainerSpecOf(event: string, s: GenDiffSettings): TrainerSpec | null {
  if (!s.genDiffOn || !canTrainerDifficulty(event)) return null;
  if (!canTrain(s.genDiffVariant, s.genDiffStage)) return null;
  const caps = trainerCaps(s.genDiffVariant, s.genDiffStage)!;
  const steps = s.genDiffSteps.length ? s.genDiffSteps : rangeOf(caps.band);
  const lo = Math.max(steps[0], caps.range[0]);
  const hi = Math.min(steps[steps.length - 1], caps.range[1]);
  if (lo > hi || !s.genDiffColors) return null;
  return {
    variant: s.genDiffVariant,
    stage: s.genDiffStage,
    colors: s.genDiffColors,
    slot: caps.slots && s.genDiffSlot >= 0 ? s.genDiffSlot : (caps.slots ? 'best' : 0),
    lo,
    hi,
  };
}

const rangeOf = ([a, b]: [number, number]): number[] =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Stable signature for regenerate-on-change (empty when the trainer source is inactive). */
export function trainerSig(event: string, s: GenDiffSettings): string {
  const spec = trainerSpecOf(event, s);
  return spec ? trainerSpecKey(spec) : '';
}
