// 选手成绩 PB(progress) 检测.
// 一条 result 是 PB iff 该选手在该项目下,所有更早(comp.start_date 较小)的成绩里没有更好的值.
// 注意 best/average 分别判断,DNF/DNS/0 一律不是 PB(且不参与最佳值更新).

import type { WcaResultRow, WcaCompetition } from '../wca_api';

export interface ProgressFlag {
  bestIsPb: boolean;
  averageIsPb: boolean;
}

function isValidValue(v: number): boolean {
  // WCA encoding: -1 DNF / -2 DNS / 0 no-result.
  // 大于 0 才视为有效成绩;FMC moves / MBLD encoding 都满足 > 0.
  return v > 0;
}

/** 给定本 person 全部 results + 全部 comps,返回 result.id → ProgressFlag.
 *  对每个 event:按 comp.start_date 升序,逐条扫描;若 best/average 严格优于此前最优,标 PB. */
export function computeProgress(
  results: WcaResultRow[],
  comps: WcaCompetition[],
): Map<number, ProgressFlag> {
  const compDate = new Map<string, string>();
  for (const c of comps) compDate.set(c.id, c.start_date);

  const sorted = results.slice().sort((a, b) => {
    const da = compDate.get(a.competition_id) ?? '';
    const db = compDate.get(b.competition_id) ?? '';
    if (da !== db) return da.localeCompare(db);
    return a.id - b.id;
  });

  const out = new Map<number, ProgressFlag>();
  const bestSoFar = new Map<string, { single: number | null; average: number | null }>();

  for (const r of sorted) {
    const key = r.event_id;
    const cur = bestSoFar.get(key) ?? { single: null, average: null };
    let bestPb = false;
    let avgPb = false;
    if (isValidValue(r.best) && (cur.single === null || r.best < cur.single)) {
      bestPb = true;
      cur.single = r.best;
    }
    if (isValidValue(r.average) && (cur.average === null || r.average < cur.average)) {
      avgPb = true;
      cur.average = r.average;
    }
    bestSoFar.set(key, cur);
    out.set(r.id, { bestIsPb: bestPb, averageIsPb: avgPb });
  }
  return out;
}

/** Single 是否有效成绩(显示 progress 染色用). */
export function singleIsValid(v: number): boolean {
  return isValidValue(v);
}
