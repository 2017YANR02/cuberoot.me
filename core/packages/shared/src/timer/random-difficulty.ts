import {
  canTrain,
  facesOfSubset,
  trainerCaps,
  trainerSlotOptions,
  trainerSpecKey,
  trainerStagesOf,
  type TrainerSpec,
} from '@cuberoot/puzzle-solvers/cross-trainer';
import {
  snapAllowed,
  trainerDepthBounds,
} from '@cuberoot/puzzle-solvers/cross-trainer/reach';
import { normalizeTimerColorSubsetKey } from './color-subsets';

export const TIMER_RANDOM_DIFFICULTY_EVENTS = [
  '333', '333oh', '333bld', '333fm',
] as const;

export interface TimerRandomDifficultySettings {
  genDiffOn: boolean;
  genDiffVariant: string;
  genDiffStage: string;
  genDiffColors: string;
  /** -1 means the best eligible slot. */
  genDiffSlot: number;
  genDiffSteps: number[];
}

export const DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS: TimerRandomDifficultySettings = {
  genDiffOn: false,
  genDiffVariant: 'std',
  genDiffStage: 'cross',
  genDiffColors: 'BGORWY',
  genDiffSlot: -1,
  genDiffSteps: [],
};

export const canTrainerDifficulty = (event: string): boolean =>
  (TIMER_RANDOM_DIFFICULTY_EVENTS as readonly string[]).includes(event);

export function normalizeTimerRandomDifficultySettings(
  value: Partial<TimerRandomDifficultySettings> | null | undefined,
): TimerRandomDifficultySettings {
  const requestedVariant = typeof value?.genDiffVariant === 'string'
    ? value.genDiffVariant
    : DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS.genDiffVariant;
  const variant = trainerStagesOf(requestedVariant).length
    ? requestedVariant
    : DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS.genDiffVariant;
  const requestedStage = typeof value?.genDiffStage === 'string' ? value.genDiffStage : '';
  const stage = canTrain(variant, requestedStage)
    ? requestedStage
    : trainerStagesOf(variant)[0]!;
  const steps = Array.isArray(value?.genDiffSteps)
    ? [...new Set(value.genDiffSteps.filter(
      (step) => Number.isSafeInteger(step) && step >= 0 && step <= 500,
    ))].sort((a, b) => a - b)
    : [];
  return {
    genDiffOn: value?.genDiffOn === true,
    genDiffVariant: variant,
    genDiffStage: stage,
    genDiffColors: normalizeTimerColorSubsetKey(value?.genDiffColors),
    genDiffSlot: Number.isSafeInteger(value?.genDiffSlot) && value!.genDiffSlot! >= -1
      ? value!.genDiffSlot!
      : -1,
    genDiffSteps: steps,
  };
}

const rangeOf = ([a, b]: [number, number]): number[] =>
  Array.from({ length: b - a + 1 }, (_, index) => a + index);

export function trainerSpecOf(
  event: string,
  value: TimerRandomDifficultySettings,
): TrainerSpec | null {
  if (!value.genDiffOn || !canTrainerDifficulty(event)) return null;
  const settings = normalizeTimerRandomDifficultySettings(value);
  const caps = trainerCaps(settings.genDiffVariant, settings.genDiffStage);
  if (!caps) return null;
  const faces = facesOfSubset(settings.genDiffColors);
  if (!faces.length) return null;
  const slotCount = trainerSlotOptions(
    settings.genDiffVariant,
    settings.genDiffStage,
    faces[0]!,
  ).length;
  const fixedSlot = caps.slots
    && faces.length === 1
    && settings.genDiffSlot >= 0
    && settings.genDiffSlot < slotCount;
  const { allowed } = trainerDepthBounds(
    settings.genDiffVariant,
    settings.genDiffStage,
    faces.length,
    fixedSlot ? 'fixed' : 'best',
    caps.range[1],
    caps.range[0],
  );
  if (!allowed.length) return null;
  const steps = settings.genDiffSteps.length ? settings.genDiffSteps : rangeOf(caps.band);
  const lo = snapAllowed(steps[0]!, allowed);
  const hi = snapAllowed(steps[steps.length - 1]!, allowed);
  if (lo > hi) return null;
  return {
    variant: settings.genDiffVariant,
    stage: settings.genDiffStage,
    colors: settings.genDiffColors,
    slot: caps.slots ? (fixedSlot ? settings.genDiffSlot : 'best') : 0,
    lo,
    hi,
  };
}

export function trainerSig(event: string, settings: TimerRandomDifficultySettings): string {
  const spec = trainerSpecOf(event, settings);
  return spec ? trainerSpecKey(spec) : '';
}
