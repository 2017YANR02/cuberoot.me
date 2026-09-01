import { averageOfN, bestMbldSolve, compareMbld } from './stats';
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

function averageAt(history: readonly Solve[], end: number, size: 5 | 12): number | null {
  if (end + 1 < size) return null;
  return averageOfN(history.slice(end - size + 1, end + 1), size);
}

/** Derived tags for one chronologically ordered event history. Never persist this map. */
export function computeTimerHistoryTags(
  history: readonly Solve[],
): Map<string, readonly TimerHistoryTagId[]> {
  const tagsBySolveId = new Map<string, readonly TimerHistoryTagId[]>();
  let bestSingle = Infinity;
  let bestMbld: Solve | null = null;
  let bestAo5 = Infinity;
  let bestAo12 = Infinity;

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

    if (!isMbld) {
      const ao5 = averageAt(history, index, 5);
      if (ao5 !== null && ao5 < bestAo5) {
        bestAo5 = ao5;
        tags.push('pb-ao5');
      }
      const ao12 = averageAt(history, index, 12);
      if (ao12 !== null && ao12 < bestAo12) {
        bestAo12 = ao12;
        tags.push('pb-ao12');
      }
    }

    tagsBySolveId.set(solve.id, tags);
  }

  return tagsBySolveId;
}
