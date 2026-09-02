import { invertAlg } from '../alg_transform';
import {
  TIMER_OLL_CASE_DATA,
  TIMER_PLL_CASE_DATA,
  TIMER_ZBLL_CASE_DATA,
} from './trainer-case-data.generated';
import { CMLL_ALGS, COLL_ALGS, EG1_ALGS, EG2_ALGS } from './trainer-alg-data';
import { TIMER_MORE_ACTION_COPY } from './more-actions';

export { CMLL_ALGS, COLL_ALGS, EG1_ALGS, EG2_ALGS } from './trainer-alg-data';

export const TIMER_TRAINER_EVENT_IDS = [
  'll',
  'oll',
  'pll',
  'coll',
  'cmll',
  'zbll',
  'eg1',
  'eg2',
] as const;

export type TimerTrainerEventId = (typeof TIMER_TRAINER_EVENT_IDS)[number];

export type TimerDrillType = 'oll' | 'pll';

export interface TimerDrillTarget {
  readonly type: TimerDrillType;
  readonly id: string;
}

export interface TimerDrillScramble {
  readonly scramble: string;
  readonly targetCase: string;
}

type TimerDrillPickerText = Readonly<Record<'en' | 'zh', string>>;

export interface TimerDrillPickerCopy {
  readonly title: TimerDrillPickerText;
  readonly typeLabel: TimerDrillPickerText;
  readonly searchLabel: TimerDrillPickerText;
  readonly clearSearch: TimerDrillPickerText;
  readonly searchPlaceholder: Readonly<Record<TimerDrillType, TimerDrillPickerText>>;
  readonly noMatches: TimerDrillPickerText;
  readonly exit: TimerDrillPickerText;
  readonly close: TimerDrillPickerText;
}

export const TIMER_DRILL_PICKER_COPY: TimerDrillPickerCopy = Object.freeze({
  title: TIMER_MORE_ACTION_COPY['more.drill'],
  typeLabel: Object.freeze({ en: 'Drill type: OLL or PLL', zh: '专项类型：OLL 或 PLL' }),
  searchLabel: Object.freeze({ en: 'Search cases', zh: '搜索 case' }),
  clearSearch: Object.freeze({ en: 'Clear search', zh: '清除搜索' }),
  searchPlaceholder: Object.freeze({
    oll: Object.freeze({ en: 'Search (e.g. 21)', zh: '搜索 (例如 21)' }),
    pll: Object.freeze({ en: 'Search (e.g. T)', zh: '搜索 (例如 T)' }),
  }),
  noMatches: Object.freeze({ en: 'No matches', zh: '无匹配结果' }),
  exit: Object.freeze({ en: 'Exit drill', zh: '退出专项' }),
  close: Object.freeze({ en: 'Close', zh: '关闭' }),
});

export const TIMER_DRILL_AUFS = ['', 'U', 'U2', "U'"] as const;

/** Trainer events whose case identity is persisted on a solve by the Web Timer. */
export const TIMER_TRAINER_CASE_TRACKED_EVENT_IDS = [
  'oll',
  'pll',
  'coll',
  'cmll',
  'zbll',
  'eg1',
  'eg2',
] as const satisfies readonly TimerTrainerEventId[];

export type TimerTrainerCaseTrackedEventId =
  (typeof TIMER_TRAINER_CASE_TRACKED_EVENT_IDS)[number];

export function timerTracksTrainerCase(
  event: string,
): event is TimerTrainerCaseTrackedEventId {
  return (TIMER_TRAINER_CASE_TRACKED_EVENT_IDS as readonly string[]).includes(event);
}

export interface TimerTrainerCase {
  /** Existing Solve.caseId identity; do not synthesize a host-specific id. */
  readonly id: string;
  /** Algorithm that solves the case. Its inverse is the Timer scramble. */
  readonly solutionAlg: string;
  readonly name?: string;
  readonly group?: string;
}

export interface TimerTrainerScramble {
  readonly event: TimerTrainerEventId;
  readonly scramble: string;
  readonly caseId: string;
  readonly solutionAlg: string;
}

function freezeCases<T extends TimerTrainerCase>(cases: readonly T[]): readonly Readonly<T>[] {
  for (const item of cases) Object.freeze(item);
  return Object.freeze(cases);
}

export const OLL_CASES = freezeCases(TIMER_OLL_CASE_DATA
  .map(([id, name, group, solutionAlg]) => ({
    id,
    name,
    group,
    solutionAlg,
  })));

export const PLL_CASES = freezeCases(TIMER_PLL_CASE_DATA
  .map(([id, solutionAlg]) => ({
    id,
    name: id,
    solutionAlg,
  })));

/** Preserve the Timer's historical raw-alg case id while sourcing algorithms from shared JSON. */
export const ZBLL_CASES = freezeCases(TIMER_ZBLL_CASE_DATA
  .map(([name, solutionAlg]) => ({
    id: solutionAlg,
    name,
    solutionAlg,
  })));

function casesFromHistoricalAlgs(algs: readonly string[]): readonly TimerTrainerCase[] {
  return freezeCases(algs.map((solutionAlg) => ({ id: solutionAlg, solutionAlg })));
}

export const COLL_CASES = casesFromHistoricalAlgs(COLL_ALGS);
export const CMLL_CASES = casesFromHistoricalAlgs(CMLL_ALGS);
export const EG1_CASES = casesFromHistoricalAlgs(EG1_ALGS);
export const EG2_CASES = casesFromHistoricalAlgs(EG2_ALGS);

/** Thin compatibility projections for existing Web components. */
export const OLL_ALGS = Object.freeze(OLL_CASES.map((item) => item.solutionAlg));
export const PLL_ALGS = Object.freeze(PLL_CASES.map((item) => item.solutionAlg));
export const ZBLL_ALGS = Object.freeze(ZBLL_CASES.map((item) => item.solutionAlg));

const OLL_CASE_IDS = new Set(OLL_CASES.map((item) => item.id));
const PLL_CASE_IDS = new Set(PLL_CASES.map((item) => item.id));

const TRAINER_CASES = Object.freeze({
  oll: OLL_CASES,
  pll: PLL_CASES,
  coll: COLL_CASES,
  cmll: CMLL_CASES,
  zbll: ZBLL_CASES,
  eg1: EG1_CASES,
  eg2: EG2_CASES,
});

export function isTimerTrainerEvent(event: string): event is TimerTrainerEventId {
  return (TIMER_TRAINER_EVENT_IDS as readonly string[]).includes(event);
}

export function timerTrainerCases(
  event: Exclude<TimerTrainerEventId, 'll'>,
): readonly TimerTrainerCase[] {
  return TRAINER_CASES[event];
}

function randomIndex(length: number, random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return length - 1;
  return Math.floor(value * length);
}

function subsetCases(
  cases: readonly TimerTrainerCase[],
  caseIds: readonly string[] | undefined,
): readonly TimerTrainerCase[] {
  if (!caseIds || caseIds.length === 0) return cases;
  const allowed = new Set(caseIds);
  const subset = cases.filter((item) => allowed.has(item.id));
  // Match the existing Web subset contract: stale/unknown selections do not
  // produce an empty scramble; they fall back to the canonical complete set.
  return subset.length > 0 ? subset : cases;
}

function pickCase(
  cases: readonly TimerTrainerCase[],
  caseIds: readonly string[] | undefined,
  random: () => number,
): TimerTrainerCase {
  const available = subsetCases(cases, caseIds);
  return available[randomIndex(available.length, random)];
}

/** Generate the selected OLL/PLL drill exactly; stale targets fail closed. */
export function generateTimerDrillScramble(
  target: TimerDrillTarget,
  random: () => number = Math.random,
): TimerDrillScramble | null {
  if (!target || (target.type !== 'oll' && target.type !== 'pll')) return null;
  const cases = target.type === 'oll' ? OLL_CASES : PLL_CASES;
  const item = cases.find((candidate) => candidate.id === target.id);
  if (!item) return null;
  const inverse = invertAlg(item.solutionAlg);
  if (!inverse) return null;
  const auf = TIMER_DRILL_AUFS[randomIndex(TIMER_DRILL_AUFS.length, random)];
  return {
    scramble: auf ? `${auf} ${inverse}` : inverse,
    targetCase: item.id,
  };
}

/**
 * Generate one last-layer trainer case from the canonical shared corpus.
 *
 * `caseIds` uses the exact Solve.caseId values exposed by `timerTrainerCases`.
 * `ll` keeps the website's independent OLL + PLL sampling; when a host passes
 * case ids, matching OLL and PLL ids constrain their respective draw.
 */
export function generateTimerTrainerScramble(
  event: TimerTrainerEventId,
  options: {
    readonly caseIds?: readonly string[];
    readonly random?: () => number;
  } = {},
): TimerTrainerScramble {
  const random = options.random ?? Math.random;
  if (event === 'll') {
    const ollIds = options.caseIds?.filter((id) => OLL_CASE_IDS.has(id));
    const pllIds = options.caseIds?.filter((id) => PLL_CASE_IDS.has(id));
    const oll = pickCase(OLL_CASES, ollIds, random);
    const pll = pickCase(PLL_CASES, pllIds, random);
    const solutionAlg = `${oll.solutionAlg} ${pll.solutionAlg}`;
    const scramble = invertAlg(solutionAlg);
    if (!scramble) throw new Error('Failed to invert LL trainer algorithm');
    return {
      event,
      scramble,
      caseId: `${oll.id} + ${pll.id}`,
      solutionAlg,
    };
  }

  const item = pickCase(TRAINER_CASES[event], options.caseIds, random);
  const scramble = invertAlg(item.solutionAlg);
  if (!scramble) throw new Error(`Failed to invert ${event} trainer algorithm`);
  return {
    event,
    scramble,
    caseId: item.id,
    solutionAlg: item.solutionAlg,
  };
}
