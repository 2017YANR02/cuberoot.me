import {
  LENGTH_VARIANT,
  WHOLE_VARIANT,
  dataVariantOfStage,
  uiStagesOf,
  uiVariantOf,
  uiVariantOptions,
  usesStepsIndex,
  variantDataRef,
} from './scramble-variants';
import {
  normalizeTimerColorSubsetKey,
} from './color-subsets';

export const TIMER_WCA_DIFFICULTY_EVENTS = [
  '333', '333oh', '333bf', '333fm', '333ft', '333mbf',
] as const;

export const TIMER_WCA_MERGE_EVENTS = [
  '333', '333oh', '333bf', '333fm', '333ft',
] as const;

export const TIMER_WCA_OPTIMAL_EVENTS = [
  '333', '333oh', '333ft', '333fm', '222', 'pyram', 'skewb',
] as const;

export const TIMER_WCA_DIFFICULTY_STEP_MIN = 0;
export const TIMER_WCA_DIFFICULTY_STEP_MAX = 14;
export const TIMER_WCA_DEFAULT_DIFFICULTY_RANGE = [4, 6] as const;

export interface TimerWcaDifficultySettings {
  wcaUseOptimal: boolean;
  wcaDifficultyOn: boolean;
  wcaDiffVariant: string;
  wcaDiffStage: string;
  wcaDiffColors: string;
  wcaDiffSteps: number[];
  wcaDiffMerged: boolean;
}

export const DEFAULT_TIMER_WCA_DIFFICULTY_SETTINGS: TimerWcaDifficultySettings = {
  wcaUseOptimal: true,
  wcaDifficultyOn: false,
  wcaDiffVariant: 'std',
  wcaDiffStage: 'cross',
  wcaDiffColors: 'BGORWY',
  wcaDiffSteps: [],
  wcaDiffMerged: true,
};

function cleanKey(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const key = value.trim();
  return key && key.length <= 64 ? key : fallback;
}

export function timerInclusiveRange(from: number, to: number): number[] {
  const lo = Math.ceil(Math.min(from, to));
  const hi = Math.floor(Math.max(from, to));
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || hi - lo > 500) return [];
  return Array.from({ length: hi - lo + 1 }, (_, index) => lo + index);
}

function normalizeSteps(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((step): step is number => (
    Number.isSafeInteger(step) && step >= 0 && step <= 500
  )))].sort((left, right) => left - right);
}

export function normalizeTimerWcaDifficultySettings(
  value: Partial<TimerWcaDifficultySettings> | null | undefined,
): TimerWcaDifficultySettings {
  return {
    wcaUseOptimal: typeof value?.wcaUseOptimal === 'boolean'
      ? value.wcaUseOptimal
      : DEFAULT_TIMER_WCA_DIFFICULTY_SETTINGS.wcaUseOptimal,
    wcaDifficultyOn: typeof value?.wcaDifficultyOn === 'boolean'
      ? value.wcaDifficultyOn
      : DEFAULT_TIMER_WCA_DIFFICULTY_SETTINGS.wcaDifficultyOn,
    wcaDiffVariant: cleanKey(
      value?.wcaDiffVariant,
      DEFAULT_TIMER_WCA_DIFFICULTY_SETTINGS.wcaDiffVariant,
    ),
    wcaDiffStage: cleanKey(
      value?.wcaDiffStage,
      DEFAULT_TIMER_WCA_DIFFICULTY_SETTINGS.wcaDiffStage,
    ),
    wcaDiffColors: normalizeTimerColorSubsetKey(value?.wcaDiffColors),
    wcaDiffSteps: normalizeSteps(value?.wcaDiffSteps),
    wcaDiffMerged: typeof value?.wcaDiffMerged === 'boolean'
      ? value.wcaDiffMerged
      : DEFAULT_TIMER_WCA_DIFFICULTY_SETTINGS.wcaDiffMerged,
  };
}

export function timerWcaSupportsDifficulty(wcaEventId: string | null | undefined): boolean {
  return !!wcaEventId && TIMER_WCA_DIFFICULTY_EVENTS.includes(
    wcaEventId as (typeof TIMER_WCA_DIFFICULTY_EVENTS)[number],
  );
}

export function timerWcaSupportsMerge(wcaEventId: string | null | undefined): boolean {
  return !!wcaEventId && TIMER_WCA_MERGE_EVENTS.includes(
    wcaEventId as (typeof TIMER_WCA_MERGE_EVENTS)[number],
  );
}

export function timerWcaSupportsOptimal(wcaEventId: string | null | undefined): boolean {
  return !!wcaEventId && TIMER_WCA_OPTIMAL_EVENTS.includes(
    wcaEventId as (typeof TIMER_WCA_OPTIMAL_EVENTS)[number],
  );
}

export interface TimerWcaDifficultyHistogram {
  min: number;
  max: number;
  counts?: Readonly<Record<string, number>>;
}

export interface TimerWcaDifficultyStepsLayout {
  variants: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, number>>>>>>;
}

export interface TimerWcaDifficultyDistribution {
  sets: Readonly<Record<string, {
    variants: Readonly<Record<string, {
      data: Readonly<Record<string, Readonly<Record<string, TimerWcaDifficultyHistogram>>>>;
    }>>;
  }>>;
}

export interface TimerWcaEventLengths {
  events: Readonly<Record<string, {
    counts: Readonly<Record<string, number>>;
  }>>;
}

export interface TimerWcaDifficultyCatalog {
  distribution: TimerWcaDifficultyDistribution | null;
  eventLengths: TimerWcaEventLengths | null;
  layout: TimerWcaDifficultyStepsLayout | null;
}

export type TimerWcaDifficultyCoverage = 'idle' | 'loading' | 'indexed' | 'unindexed' | 'unknown';

export interface TimerWcaDifficultyUiModel {
  canDifficulty: boolean;
  canLength: boolean;
  canMerge: boolean;
  canOptimal: boolean;
  canWhole: boolean;
  dataStage: string;
  dataVariant: string;
  isLength: boolean;
  isWhole: boolean;
  locked: boolean;
  marks: number[];
  selectedRange: readonly [number, number];
  showColors: boolean;
  showStage: boolean;
  stageOptions: string[];
  stepMax: number;
  stepMin: number;
  uiVariant: string;
  variantOptions: string[];
}

function validHistogramBounds(value: unknown): readonly [number, number] | null {
  if (!value || typeof value !== 'object') return null;
  const histogram = value as Partial<TimerWcaDifficultyHistogram>;
  return Number.isFinite(histogram.min)
    && Number.isFinite(histogram.max)
    && histogram.max! >= histogram.min!
    ? [histogram.min!, histogram.max!]
    : null;
}

function lengthBounds(
  eventIds: readonly string[],
  eventLengths: TimerWcaEventLengths | null,
): readonly [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const eventId of eventIds) {
    for (const raw of Object.keys(eventLengths?.events?.[eventId]?.counts ?? {})) {
      const value = Number(raw);
      if (!Number.isSafeInteger(value)) continue;
      lo = Math.min(lo, value);
      hi = Math.max(hi, value);
    }
  }
  return hi >= lo ? [lo, hi] : null;
}

function difficultyBounds(
  setKeys: readonly string[],
  variant: string,
  stage: string,
  colors: string,
  distribution: TimerWcaDifficultyDistribution | null,
): readonly [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const setKey of setKeys) {
    const bounds = validHistogramBounds(
      distribution?.sets?.[setKey]?.variants?.[variant]?.data?.[stage]?.[colors],
    );
    if (!bounds) continue;
    lo = Math.min(lo, bounds[0]);
    hi = Math.max(hi, bounds[1]);
  }
  return hi >= lo ? [lo, hi] : null;
}

function difficultyMarks(min: number, max: number): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const stride = [1, 2, 5, 10, 20, 50]
    .find((step) => Math.floor(span / step) + 1 <= 16) ?? span;
  const marks: number[] = [];
  for (let value = min; value <= max; value += stride) marks.push(value);
  if (marks[marks.length - 1] !== max) marks.push(max);
  return marks;
}

export function timerWcaDifficultyUiModel(
  wcaEventId: string | null | undefined,
  rawSettings: TimerWcaDifficultySettings,
  catalog: TimerWcaDifficultyCatalog,
  coverage: TimerWcaDifficultyCoverage = 'idle',
): TimerWcaDifficultyUiModel {
  const settings = normalizeTimerWcaDifficultySettings(rawSettings);
  const canDifficulty = timerWcaSupportsDifficulty(wcaEventId);
  const canMerge = timerWcaSupportsMerge(wcaEventId);
  const canWhole = timerWcaSupportsOptimal(wcaEventId);
  const lenCounts = wcaEventId ? catalog.eventLengths?.events?.[wcaEventId]?.counts : undefined;
  const canLength = Object.keys(lenCounts ?? {}).length > 1;
  const hasStage = (variant: string, stage: string): boolean => {
    if (variant === WHOLE_VARIANT) return canWhole;
    if (variant === LENGTH_VARIANT) return canLength;
    const reference = variantDataRef(variant, stage);
    return catalog.layout ? !!catalog.layout.variants[reference.variant]?.[reference.stage] : true;
  };
  const hasVariant = (variant: string): boolean => (
    variant === WHOLE_VARIANT
      ? canWhole
      : catalog.layout ? !!catalog.layout.variants[variant] : true
  );
  const variantOptions = [
    ...uiVariantOptions(hasVariant),
    ...(canLength ? [LENGTH_VARIANT] : []),
  ];
  const requestedUiVariant = uiVariantOf(settings.wcaDiffVariant);
  const uiVariant = variantOptions.includes(requestedUiVariant)
    ? requestedUiVariant
    : variantOptions[0] ?? 'std';
  const stageOptions = uiStagesOf(uiVariant)
    .filter((stage) => hasStage(dataVariantOfStage(uiVariant, stage), stage));
  const dataStage = stageOptions.includes(settings.wcaDiffStage)
    ? settings.wcaDiffStage
    : stageOptions[0] ?? settings.wcaDiffStage;
  const dataVariant = dataVariantOfStage(uiVariant, dataStage);
  const isWhole = dataVariant === WHOLE_VARIANT;
  const isLength = dataVariant === LENGTH_VARIANT;
  const locked = coverage === 'unindexed' && usesStepsIndex(dataVariant);
  const selectedColors = isWhole ? 'ALL' : settings.wcaDiffColors;
  const mergeEvents = canMerge && settings.wcaDiffMerged
    ? TIMER_WCA_MERGE_EVENTS
    : wcaEventId ? [wcaEventId] : [];
  const bounds = isLength
    ? lengthBounds(mergeEvents, catalog.eventLengths)
    : difficultyBounds(
      mergeEvents.map((eventId) => `wca_${eventId}`),
      dataVariant,
      dataStage,
      selectedColors,
      catalog.distribution,
    ) ?? difficultyBounds(
      ['wca'],
      dataVariant,
      dataStage,
      selectedColors,
      catalog.distribution,
    );
  const [stepMin, stepMax] = bounds ?? [
    TIMER_WCA_DIFFICULTY_STEP_MIN,
    TIMER_WCA_DIFFICULTY_STEP_MAX,
  ];
  const savedMin = settings.wcaDiffSteps[0] ?? TIMER_WCA_DEFAULT_DIFFICULTY_RANGE[0];
  const savedMax = settings.wcaDiffSteps.at(-1) ?? TIMER_WCA_DEFAULT_DIFFICULTY_RANGE[1];
  const disjoint = savedMax < stepMin || savedMin > stepMax;
  const selectedRange: readonly [number, number] = disjoint
    ? [stepMin, stepMax]
    : [
      Math.min(Math.max(savedMin, stepMin), stepMax),
      Math.max(Math.min(savedMax, stepMax), stepMin),
    ];
  return {
    canDifficulty,
    canLength,
    canMerge,
    canOptimal: timerWcaSupportsOptimal(wcaEventId),
    canWhole,
    dataStage,
    dataVariant,
    isLength,
    isWhole,
    locked,
    marks: difficultyMarks(stepMin, stepMax),
    selectedRange,
    showColors: !isWhole && !isLength,
    showStage: !isLength,
    stageOptions,
    stepMax,
    stepMin,
    uiVariant,
    variantOptions,
  };
}

export function reconcileTimerWcaDifficultySettings(
  settings: TimerWcaDifficultySettings,
  model: TimerWcaDifficultyUiModel,
): Partial<TimerWcaDifficultySettings> {
  const normalized = normalizeTimerWcaDifficultySettings(settings);
  const patch: Partial<TimerWcaDifficultySettings> = {};
  if (!model.canDifficulty && normalized.wcaDifficultyOn) patch.wcaDifficultyOn = false;
  if (normalized.wcaDiffVariant !== model.dataVariant) patch.wcaDiffVariant = model.dataVariant;
  if (normalized.wcaDiffStage !== model.dataStage) patch.wcaDiffStage = model.dataStage;
  if (normalized.wcaDiffColors !== settings.wcaDiffColors) patch.wcaDiffColors = normalized.wcaDiffColors;
  if (normalized.wcaDifficultyOn) {
    const expected = timerInclusiveRange(...model.selectedRange);
    if (normalized.wcaDiffSteps.length === 0
      || normalized.wcaDiffSteps.length !== expected.length
      || normalized.wcaDiffSteps[0] !== expected[0]
      || normalized.wcaDiffSteps.at(-1) !== expected.at(-1)
      || normalized.wcaDiffSteps.some((step, index) => step !== expected[index])) {
      patch.wcaDiffSteps = expected;
    }
  }
  return patch;
}

export function timerWcaDifficultyFilter(
  wcaEventId: string | null | undefined,
  settings: TimerWcaDifficultySettings,
  options: { competitionUnindexed?: boolean; suppress?: boolean } = {},
): {
  colors: string;
  merged: boolean;
  stage: string;
  steps: number[];
  variant: string;
} | null {
  const normalized = normalizeTimerWcaDifficultySettings(settings);
  if (options.suppress
    || !timerWcaSupportsDifficulty(wcaEventId)
    || !normalized.wcaDifficultyOn
    || normalized.wcaDiffSteps.length === 0) return null;
  const reference = variantDataRef(normalized.wcaDiffVariant, normalized.wcaDiffStage);
  if (reference.variant === 'second_layer') return null;
  if (options.competitionUnindexed && usesStepsIndex(reference.variant)) return null;
  return {
    colors: reference.variant === WHOLE_VARIANT ? 'ALL' : normalized.wcaDiffColors,
    merged: normalized.wcaDiffMerged && timerWcaSupportsMerge(wcaEventId),
    stage: reference.stage,
    steps: [...normalized.wcaDiffSteps],
    variant: reference.variant,
  };
}

export function timerWcaDifficultyIdentity(
  wcaEventId: string | null | undefined,
  settings: TimerWcaDifficultySettings,
  options: { competitionUnindexed?: boolean; suppress?: boolean } = {},
): string {
  const filter = timerWcaDifficultyFilter(wcaEventId, settings, options);
  const normalized = normalizeTimerWcaDifficultySettings(settings);
  return JSON.stringify([
    timerWcaSupportsOptimal(wcaEventId)
      && normalized.wcaUseOptimal
      && filter?.variant !== LENGTH_VARIANT ? 1 : 0,
    filter?.variant ?? '',
    filter?.stage ?? '',
    filter?.colors ?? '',
    filter?.steps ?? [],
    filter?.merged ? 1 : 0,
    options.competitionUnindexed ? 1 : 0,
  ]);
}

export interface TimerWcaByDifficultyRow {
  ci: string;
  cn: string;
  e: string;
  g: string;
  n: number;
  o?: string;
  r: string;
  scramble: string;
  x: 0 | 1;
}

export interface TimerWcaByDifficultyResult {
  page: number;
  pageSize: number;
  scrambles: TimerWcaByDifficultyRow[];
  total: number;
}

export interface TimerWcaByDifficultyRequest {
  bin: number;
  colors: string;
  event?: string;
  names?: readonly string[];
  pageSize?: number;
  stage: string;
  variant: string;
}

export function timerWcaByDifficultyQuery(
  request: TimerWcaByDifficultyRequest,
): URLSearchParams {
  const query = new URLSearchParams({
    variant: request.variant,
    stage: request.stage,
    colors: request.colors,
    bin: String(request.bin),
  });
  if (request.event) query.set('event', request.event);
  if (request.names?.length) query.set('names', request.names.join('\n'));
  if (request.pageSize) query.set('pageSize', String(request.pageSize));
  return query;
}

export function parseTimerWcaByDifficultyResult(
  value: unknown,
): TimerWcaByDifficultyResult | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  if (!Number.isSafeInteger(payload.total)
    || !Number.isSafeInteger(payload.page)
    || !Number.isSafeInteger(payload.pageSize)
    || !Array.isArray(payload.scrambles)) return null;
  const scrambles: TimerWcaByDifficultyRow[] = [];
  for (const item of payload.scrambles) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    if (typeof row.scramble !== 'string'
      || typeof row.ci !== 'string'
      || typeof row.cn !== 'string'
      || typeof row.e !== 'string'
      || typeof row.r !== 'string'
      || typeof row.g !== 'string'
      || !Number.isSafeInteger(row.n)
      || (row.x !== 0 && row.x !== 1)
      || (row.o !== undefined && typeof row.o !== 'string')) return null;
    scrambles.push({
      scramble: row.scramble,
      ci: row.ci,
      cn: row.cn,
      e: row.e,
      r: row.r,
      g: row.g,
      n: row.n as number,
      x: row.x,
      ...(typeof row.o === 'string' ? { o: row.o } : {}),
    });
  }
  return {
    total: payload.total as number,
    page: payload.page as number,
    pageSize: payload.pageSize as number,
    scrambles,
  };
}
