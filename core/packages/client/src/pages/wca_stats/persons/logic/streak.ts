// PR streak 分析:连续多少场比赛存在 PB.
// 输入:results + comps;
// 输出:current(从最新一场往后回溯,直到首场无 PB),longest(全程扫描最大值),breaks(每次断点).

import type { WcaResultRow, WcaCompetition } from '../wca_api';
import { computeProgress } from './progress';

export interface StreakBreak {
  /** 这场比赛及之前(降序角度)是 streak 的起点;它本身没 PB,导致 streak 终止 */
  brokenAtCompId: string;
  brokenAtDate: string;
  /** streak 的长度(场数) */
  length: number;
  /** streak 起止比赛 id(降序:newest, oldest) */
  startCompId: string;
  startDate: string;
  endCompId: string;
  endDate: string;
}

export interface StreakSummary {
  current: number;
  longest: number;
  breaks: StreakBreak[];
}

export function analyzeStreak(
  results: WcaResultRow[],
  comps: WcaCompetition[],
): StreakSummary {
  const progress = computeProgress(results, comps);

  // 比赛按时间降序(newest first).
  const compsDesc = comps.slice().sort((a, b) => b.start_date.localeCompare(a.start_date));

  // 每场比赛是否含至少 1 个 PB.
  const resultsByComp = new Map<string, WcaResultRow[]>();
  for (const r of results) {
    const arr = resultsByComp.get(r.competition_id);
    if (arr) arr.push(r); else resultsByComp.set(r.competition_id, [r]);
  }

  const hasPb = (compId: string) => {
    const arr = resultsByComp.get(compId);
    if (!arr) return false;
    for (const r of arr) {
      const f = progress.get(r.id);
      if (f && (f.bestIsPb || f.averageIsPb)) return true;
    }
    return false;
  };

  // current = 从最新场往老场,连续 hasPb 长度.
  let current = 0;
  for (const c of compsDesc) {
    if (hasPb(c.id)) current++;
    else break;
  }

  // longest + breaks(扫一遍即可).
  let longest = 0;
  let runLen = 0;
  let runStart: WcaCompetition | null = null;
  let runEnd: WcaCompetition | null = null;
  const breaks: StreakBreak[] = [];

  // 升序扫描更直观.
  const compsAsc = comps.slice().sort((a, b) => a.start_date.localeCompare(b.start_date));
  for (const c of compsAsc) {
    if (hasPb(c.id)) {
      if (runLen === 0) runStart = c;
      runLen++;
      runEnd = c;
    } else {
      if (runLen > 0 && runStart && runEnd) {
        breaks.push({
          brokenAtCompId: c.id,
          brokenAtDate: c.start_date,
          length: runLen,
          startCompId: runStart.id,
          startDate: runStart.start_date,
          endCompId: runEnd.id,
          endDate: runEnd.start_date,
        });
        if (runLen > longest) longest = runLen;
      }
      runLen = 0;
      runStart = null;
      runEnd = null;
    }
  }
  if (runLen > longest) longest = runLen;

  return { current, longest, breaks: breaks.reverse() };
}
