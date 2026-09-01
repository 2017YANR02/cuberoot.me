import { bestMbldSolve, compareMbld } from './stats';
import { rollingStatSeries } from './rolling-stats';
import { effectiveMs, type Solve } from './types';

export type TimerHistoryTagId =
  | 'oll-skip'
  | 'pll-skip'
  | 'pb-single'
  | 'pb-ao5'
  | 'pb-ao12'
  | 'dnf'
  | 'dns'
  | 'plus2';

export interface TimerHistoryTagDef {
  id: TimerHistoryTagId;
  label: Readonly<Record<'en' | 'zh', string>>;
  tone: 'gold' | 'green' | 'red' | 'muted';
}

export const TIMER_HISTORY_TAG_DEFS: Readonly<Record<TimerHistoryTagId, TimerHistoryTagDef>> = {
  'pb-single': { id: 'pb-single', tone: 'gold', label: { en: 'PB', zh: 'PB' } },
  'pb-ao5': { id: 'pb-ao5', tone: 'gold', label: { en: 'PB ao5', zh: 'PB ao5' } },
  'pb-ao12': { id: 'pb-ao12', tone: 'gold', label: { en: 'PB ao12', zh: 'PB ao12' } },
  'oll-skip': { id: 'oll-skip', tone: 'gold', label: { en: 'OLL skip', zh: '跳O' } },
  'pll-skip': { id: 'pll-skip', tone: 'gold', label: { en: 'PLL skip', zh: '跳P' } },
  dnf: { id: 'dnf', tone: 'muted', label: { en: 'DNF', zh: 'DNF' } },
  dns: { id: 'dns', tone: 'muted', label: { en: 'DNS', zh: 'DNS' } },
  plus2: { id: 'plus2', tone: 'muted', label: { en: '+2', zh: '+2' } },
};

export const TIMER_HISTORY_TAG_IDS: readonly TimerHistoryTagId[] = [
  'pb-single', 'pb-ao5', 'pb-ao12',
  'oll-skip', 'pll-skip',
  'dnf', 'dns', 'plus2',
];

export function toggleTimerHistoryTag(
  current: ReadonlySet<TimerHistoryTagId>,
  tagId: TimerHistoryTagId,
): Set<TimerHistoryTagId> {
  const next = new Set(current);
  if (next.has(tagId)) next.delete(tagId);
  else next.add(tagId);
  return next;
}

/** Derived tags for one chronologically ordered event history. Never persist this map. */
export function computeTimerHistoryTags(
  history: readonly Solve[],
): Map<string, readonly TimerHistoryTagId[]> {
  const tagsBySolveId = new Map<string, readonly TimerHistoryTagId[]>();
  const ao5 = rollingStatSeries(history, 'ao5');
  const ao12 = rollingStatSeries(history, 'ao12');
  let bestSingle = Infinity;
  let bestMbld: Solve | null = null;

  for (let index = 0; index < history.length; index++) {
    const solve = history[index]!;
    const tags: TimerHistoryTagId[] = [];

    if (solve.penalty === 'DNF') tags.push('dnf');
    else if (solve.penalty === 'DNS') tags.push('dns');
    else if (solve.penalty === '+2') tags.push('plus2');

    if (solve.stageSegments?.ollCase === 'OLL skip') tags.push('oll-skip');
    if (solve.stageSegments?.pllCase === 'PLL skip') tags.push('pll-skip');

    const isMbld = solve.event === '333mbld';
    if (isMbld) {
      const ranked = bestMbldSolve([solve]);
      if (ranked && (bestMbld === null || compareMbld(ranked, bestMbld) < 0)) {
        bestMbld = ranked;
        tags.push('pb-single');
      }
    } else {
      const effective = effectiveMs(solve);
      if (Number.isFinite(effective) && effective < bestSingle) {
        bestSingle = effective;
        tags.push('pb-single');
      }
    }

    if (!isMbld && ao5[index]?.isPb) tags.push('pb-ao5');
    if (!isMbld && ao12[index]?.isPb) tags.push('pb-ao12');

    tagsBySolveId.set(solve.id, tags);
  }

  return tagsBySolveId;
}
