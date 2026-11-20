import {
  canTrain,
  EO_AXIS_LABELS,
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
import { dataVariantOfStage, uiStagesOf, uiVariantOf, uiVariantOptions, stageLabel, variantLabel } from './scramble-variants';

export { EO_AXIS_LABELS };

export const TIMER_RANDOM_DIFFICULTY_EVENTS = [
  '333', '333oh', '333bld', '333fm',
] as const;

export const TIMER_RANDOM_DIFFICULTY_BEST_SLOT = -1;

export interface TimerRandomDifficultySettings {
  genDiffOn: boolean;
  genDiffVariant: string;
  genDiffStage: string;
  genDiffColors: string;
  /** -1 means the best eligible slot. */
  genDiffSlot: number;
  /** Pure EO: omitted / best preserves the existing colour-based axis selection. */
  genDiffEoAxis?: 'best' | 0 | 1 | 2;
  genDiffSteps: number[];
}

export const DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS: TimerRandomDifficultySettings = {
  genDiffOn: false,
  genDiffVariant: 'std',
  genDiffStage: 'cross',
  genDiffColors: 'BGORWY',
  genDiffSlot: TIMER_RANDOM_DIFFICULTY_BEST_SLOT,
  genDiffEoAxis: 'best',
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
      : TIMER_RANDOM_DIFFICULTY_BEST_SLOT,
    genDiffSteps: steps,
    genDiffEoAxis: value?.genDiffEoAxis === 0 || value?.genDiffEoAxis === 1 || value?.genDiffEoAxis === 2
      ? value.genDiffEoAxis : 'best',
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
    ...(settings.genDiffVariant === 'eoline' && settings.genDiffStage === 'eo'
      && settings.genDiffEoAxis !== 'best' && settings.genDiffEoAxis !== undefined
      ? { eoAxis: settings.genDiffEoAxis } : {}),
    lo,
    hi,
  };
}

export function trainerSig(event: string, settings: TimerRandomDifficultySettings): string {
  const spec = trainerSpecOf(event, settings);
  return spec ? trainerSpecKey(spec) : '';
}

/** Methods group engine variants the same way as the rest of the timer. */
export function timerRandomDifficultyStagesOf(method: string): string[] {
  return uiStagesOf(method).filter(stage => canTrain(dataVariantOfStage(method, stage), stage));
}

const methods = uiVariantOptions(variant => trainerStagesOf(variant).length > 0)
  .filter(method => timerRandomDifficultyStagesOf(method).length > 0);

export function timerRandomDifficultySelection(method: string, stage: string): Partial<TimerRandomDifficultySettings> {
  return {
    genDiffVariant: dataVariantOfStage(method, stage),
    genDiffStage: stage,
    genDiffSteps: [],
    genDiffSlot: TIMER_RANDOM_DIFFICULTY_BEST_SLOT,
  };
}

function describeGaps(steps: readonly number[], allowed: readonly number[]): string {
  const spans: Array<[number, number]> = [];
  for (const step of steps) {
    if (allowed.includes(step)) continue;
    const last = spans[spans.length - 1];
    if (last && step === last[1] + 1) last[1] = step;
    else spans.push([step, step]);
  }
  return spans.map(([from, to]) => from === to ? String(from) : `${from}–${to}`).join('、');
}

/** Canonical options and ranges for the existing random difficulty dialog. */
export function timerRandomDifficultyUiModel(settings: TimerRandomDifficultySettings) {
  const storedMethod = uiVariantOf(settings.genDiffVariant);
  const method = methods.includes(storedMethod) ? storedMethod : methods[0]!;
  const stages = timerRandomDifficultyStagesOf(method);
  const stage = stages.includes(settings.genDiffStage) ? settings.genDiffStage : stages[0]!;
  const variant = dataVariantOfStage(method, stage);
  const caps = trainerCaps(variant, stage);
  const pureEo = variant === 'eoline' && stage === 'eo';
  const eoAxis = settings.genDiffEoAxis ?? 'best';
  const faces = facesOfSubset(normalizeTimerColorSubsetKey(settings.genDiffColors));
  const showSlots = !!caps?.slots && faces.length === 1;
  const slotNames = showSlots ? trainerSlotOptions(variant, stage, faces[0]!) : [];
  const slot = settings.genDiffSlot >= 0 && settings.genDiffSlot < slotNames.length
    ? settings.genDiffSlot
    : TIMER_RANDOM_DIFFICULTY_BEST_SLOT;
  const stepMin = caps?.range[0] ?? 0;
  const bounds = caps
    ? trainerDepthBounds(variant, stage, faces.length, slot >= 0 ? 'fixed' : 'best', caps.range[1], stepMin)
    : { god: 0, allowed: [] as number[] };
  const stepMax = bounds.god;
  const allowed = bounds.allowed;
  const marks = rangeOf([stepMin, stepMax]);
  const rawLo = settings.genDiffSteps[0] ?? caps?.band[0] ?? 0;
  const rawHi = settings.genDiffSteps[settings.genDiffSteps.length - 1] ?? caps?.band[1] ?? 0;
  const lo = snapAllowed(Math.min(rawLo, rawHi), allowed);
  const hi = snapAllowed(Math.max(rawLo, rawHi), allowed);
  const body = Boolean(settings.genDiffOn && caps);
  return {
    methods, stages, method, stage, variant, body, pureEo, eoAxis,
    showColors: !pureEo || eoAxis === 'best',
    showSlots, slotNames, slot, allowed, marks, stepMin, stepMax, lo, hi,
    gapText: body ? describeGaps(marks, allowed) : '',
  };
}

export type TimerRandomDifficultyUiModel = ReturnType<typeof timerRandomDifficultyUiModel>;

export function timerRandomDifficultyRangePatch(
  model: Pick<TimerRandomDifficultyUiModel, 'allowed'>, from: number, to: number,
): Pick<TimerRandomDifficultySettings, 'genDiffSteps'> {
  return {
    genDiffSteps: rangeOf([snapAllowed(Math.min(from, to), model.allowed), snapAllowed(Math.max(from, to), model.allowed)]),
  };
}

export function reconcileTimerRandomDifficultySettings(
  settings: TimerRandomDifficultySettings,
  model: TimerRandomDifficultyUiModel,
): Partial<TimerRandomDifficultySettings> {
  if (settings.genDiffVariant !== model.variant || settings.genDiffStage !== model.stage) {
    return timerRandomDifficultySelection(model.method, model.stage);
  }
  if (!model.body) return {};
  const { genDiffSteps } = settings;
  if (!genDiffSteps.length || genDiffSteps[0] !== model.lo || genDiffSteps[genDiffSteps.length - 1] !== model.hi) {
    return timerRandomDifficultyRangePatch(model, model.lo, model.hi);
  }
  return {};
}

export const TIMER_RANDOM_DIFFICULTY_COPY = {
  answerWhy: {
    en: 'The axis runs to {god} because that difficulty really exists — the site\'s own data contains such states.\nBut deeper bands hold ever fewer states, and multi-colour / best-slot needs every colour and every slot to be that deep at once, which a uniform draw never hits. Where the whole band can be listed (40 states for six-colour cross at 8, 438 for six-colour XCross at 10) cases come straight off that list; only the bands we cannot list are greyed out.',
    zh: '刻度画到 {god} 步,是因为这个难度确实存在 —— 站内数据里见过这样的状态。\n但越深的档状态越少,多底色 / 最优槽还要每个底色、每个槽同时这么深,均匀随机撞不上。整档能一个不漏地列出来的(六色底十字 8 步共 40 个、六色底 XCross 10 步共 438 个)就直接从那份名单里出题,列不出来的才置灰。',
  },
  bestBlock: { en: 'Best block', zh: '最优块' },
  bestSlot: { en: 'Best slot', zh: '最优槽' },
  bestAxis: { en: 'Best axis for colours', zh: '按底色取最优轴' },
  eoAxis: { en: 'EO axis', zh: 'EO 轴' },
  fixedAxis: { en: 'Fixed {axis} axis', zh: '固定 {axis} 轴' },
  block: { en: 'Block', zh: '块' },
  difficulty: { en: 'Difficulty', zh: '难度' },
  difficultyAria: { en: 'Generate by difficulty', zh: '按难度生成' },
  f2lSlot: { en: 'F2L slot', zh: 'F2L 槽位' },
  method: { en: 'Method', zh: '方法' },
  moreInfo: { en: 'More info', zh: '更多信息' },
  rare: { en: '{gaps} moves: too rare to draw', zh: '{gaps} 步太罕见,抽不出来' },
  stage: { en: 'Stage', zh: '阶段' },
  steps: { en: 'Step range', zh: '步数范围' },
} as const;


export const TIMER_RANDOM_DIFFICULTY_CASE_COPY = {
  answer: { en: 'Answer', zh: '答案' },
  error: { en: 'Could not solve.', zh: '求解失败。' },
  hide: { en: 'Hide', zh: '收起' },
  retry: { en: 'Retry', zh: '重试' },
  solving: { en: 'Solving', zh: '求解中' },
} as const;

export function timerRandomDifficultyCaseLabels(spec: Pick<TrainerSpec, 'variant' | 'stage'>, depth: number, language: 'en' | 'zh') {
  const stage = stageLabel(spec.stage, language === 'zh');
  const variant = uiVariantOf(spec.variant);
  const method = variant === 'std' ? '' : variantLabel(variant, language === 'zh');
  return {
    label: method && !stage.startsWith(method) ? `${method} ${stage}` : stage,
    depth: language === 'zh' ? `${depth} 步` : `${depth} move${depth === 1 ? '' : 's'}`,
  };
}
