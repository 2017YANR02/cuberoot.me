/**
 * Auto-tagging for solves based on time, penalty, stage segments and
 * personal-best context. Tags are derived on the fly from a solve plus
 * the full event history; nothing is persisted to the Solve record.
 *
 * Design notes:
 *   - All rules are pure / cheap so HistoryPanel can compute them per-row
 *     inside a useMemo over the whole history.
 *   - "PB" rules use a *prefix* view of history: a solve gets the PB tag
 *     iff it is the best (non-DNF / window-eligible) up to and including
 *     itself. That way an old PB still wears its tag even after later
 *     solves beat it.
 *   - DNF / +2 / skip / fast/slow-cross rules don't need history at all.
 */

import type { Solve } from '../types';
import { effectiveMs } from '../types';

export type TagId =
  | 'fast-cross'
  | 'slow-cross'
  | 'oll-skip'
  | 'pll-skip'
  | 'pb-single'
  | 'pb-ao5'
  | 'pb-ao12'
  | 'dnf'
  | 'plus2';

export interface TagDef {
  id: TagId;
  /** Visual category for chip color. */
  tone: 'gold' | 'green' | 'red' | 'muted';
  labelEn: string;
  labelZh: string;
    labelZhHant?: string;
}

export const TAG_DEFS: Record<TagId, TagDef> = {
  'pb-single': { id: 'pb-single', tone: 'gold',  labelEn: 'PB',          labelZh: 'PB' },
  'pb-ao5':    { id: 'pb-ao5',    tone: 'gold',  labelEn: 'PB ao5',      labelZh: 'PB ao5' },
  'pb-ao12':   { id: 'pb-ao12',   tone: 'gold',  labelEn: 'PB ao12',     labelZh: 'PB ao12' },
  'oll-skip':  { id: 'oll-skip',  tone: 'gold',  labelEn: 'OLL skip',    labelZh: 'OLL 跳' },
  'pll-skip':  { id: 'pll-skip',  tone: 'gold',  labelEn: 'PLL skip',    labelZh: 'PLL 跳' },
  'fast-cross':{ id: 'fast-cross',tone: 'green', labelEn: 'fast cross',  labelZh: '十字快' },
  'slow-cross':{ id: 'slow-cross',tone: 'red',   labelEn: 'slow cross',  labelZh: '十字慢' },
  'dnf':       { id: 'dnf',       tone: 'muted', labelEn: 'DNF',         labelZh: 'DNF' },
  'plus2':     { id: 'plus2',     tone: 'muted', labelEn: '+2',          labelZh: '+2' },
};

export const ALL_TAG_IDS: TagId[] = [
  'pb-single', 'pb-ao5', 'pb-ao12',
  'oll-skip', 'pll-skip',
  'fast-cross', 'slow-cross',
  'dnf', 'plus2',
];

const FAST_CROSS_MS = 1500;
const SLOW_CROSS_MS = 4000;

/**
 * Trimmed-mean ao{n} of the last n entries of `prefix`, matching the rules
 * used elsewhere (1 trim each side for n<=12, ceil(n/20) otherwise; DNF cap
 * = 1 for n<=12 else trim). Returns null if window is too short or invalid.
 */
function aoOfPrefixTail(prefix: Solve[], n: number): number | null {
  if (prefix.length < n) return null;
  const trim = Math.max(1, Math.ceil(n / 20));
  const dnfCap = n <= 12 ? 1 : trim;
  const window = prefix.slice(prefix.length - n).map(effectiveMs);
  const sorted = [...window].sort((a, b) => a - b);
  const dnfCount = sorted.filter(t => t === Infinity).length;
  if (dnfCount > dnfCap) return null;
  const middle = sorted.slice(trim, n - trim);
  if (middle.some(t => t === Infinity)) return null;
  return middle.reduce((a, b) => a + b, 0) / middle.length;
}

/**
 * Per-solve tag map computed across an entire (chronologically-ordered)
 * event history. Returns Map<solveId, TagId[]> so HistoryPanel can index
 * by id regardless of filter / reverse order.
 */
export function computeAllTags(history: Solve[]): Map<string, TagId[]> {
  const out = new Map<string, TagId[]>();

  // Track running best non-DNF single, best ao5, best ao12 seen so far.
  let bestSingle = Infinity;
  let bestAo5 = Infinity;
  let bestAo12 = Infinity;

  for (let i = 0; i < history.length; i++) {
    const s = history[i];
    const tags: TagId[] = [];

    // Penalty-based.
    if (s.penalty === 'DNF') tags.push('dnf');
    else if (s.penalty === '+2') tags.push('plus2');

    // Cross / skip from stage segments.
    const seg = s.stageSegments;
    if (seg) {
      if (seg.crossMs !== null) {
        if (seg.crossMs < FAST_CROSS_MS) tags.push('fast-cross');
        else if (seg.crossMs > SLOW_CROSS_MS) tags.push('slow-cross');
      }
      if (seg.ollCase === 'OLL skip') tags.push('oll-skip');
      if (seg.pllCase === 'PLL skip') tags.push('pll-skip');
    }

    // PB single — best non-DNF up to and including this solve.
    const eff = effectiveMs(s);
    if (Number.isFinite(eff) && eff < bestSingle) {
      bestSingle = eff;
      tags.push('pb-single');
    }

    // PB ao5 / ao12 — beats every prior window of the same length.
    const prefix = history.slice(0, i + 1);
    const ao5 = aoOfPrefixTail(prefix, 5);
    if (ao5 !== null && ao5 < bestAo5) {
      bestAo5 = ao5;
      tags.push('pb-ao5');
    }
    const ao12 = aoOfPrefixTail(prefix, 12);
    if (ao12 !== null && ao12 < bestAo12) {
      bestAo12 = ao12;
      tags.push('pb-ao12');
    }

    out.set(s.id, tags);
  }

  return out;
}
