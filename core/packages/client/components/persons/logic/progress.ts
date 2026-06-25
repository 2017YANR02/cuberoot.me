// 选手成绩 PB(progress) 检测.
// 一条 result 是 PB iff 该选手在该项目下,所有更早(comp.start_date 较小)的成绩里没有更好的值.
// 注意 best/average 分别判断,DNF/DNS/0 一律不是 PB(且不参与最佳值更新).

import type { WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';

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

export interface RankFlag {
  /** 该成绩发生当时,在本 person 此 (event, metric) 历史已有成绩中的名次 (dense rank).
   *  1 = 当时是 PR (含并列), 2 = 当时第 2 快, ... null = 无效 (DNF/DNS/0)
   *  rank 一经赋值即冻结,后续更好成绩不会"挤掉"它. */
  singleRank: number | null;
  averageRank: number | null;
  /** 每把单次的时间序 dense rank,口径同 singleRank(在该轮开始前、本人各轮最佳单次集合里).
   *  下标对齐 result.attempts;最好那把 == singleRank(同值同名次,与单次列一致).无效次 = null. */
  attemptRanks: (number | null)[];
}

// 时间序轮次顺序: 用于同一比赛内 round 排序 (老轮次在前). 与展示用的 ROUND_ORDER 相反.
// h=0 round (extras / heat-like), 1/d=first round, 2/g=quarter, 3=semi, b/c/f=finals.
const CHRONO_ROUND_ORDER: Record<string, number> = {
  'h': 0, '1': 1, 'd': 1, '2': 2, 'g': 2, '3': 3, 'sf': 3, 'b': 4, 'c': 4, 'f': 5,
};

/** 时间序 PR rank: 按 (comp.start_date, round, result.id) 时间序遍历本 person 全部成绩,
 *  每条新成绩 v 的 rank = (已见过的、严格优于 v 的不同值数 + 1) (dense rank, 并列同 rank).
 *  旧成绩 rank 在它发生时就被冻结,后续更好成绩不影响.
 *  无效成绩 (DNF/DNS/0) rank = null,渲染时不出 badge. */
export function computePrRank(
  results: WcaResultRow[],
  comps: WcaCompetition[],
): Map<number, RankFlag> {
  const compDate = new Map(comps.map(c => [c.id, c.start_date]));

  const sorted = results.slice().sort((a, b) => {
    const da = compDate.get(a.competition_id) ?? '';
    const db = compDate.get(b.competition_id) ?? '';
    if (da !== db) return da.localeCompare(db);
    if (a.competition_id !== b.competition_id) return a.competition_id.localeCompare(b.competition_id);
    const ra = CHRONO_ROUND_ORDER[a.round_type_id] ?? 99;
    const rb = CHRONO_ROUND_ORDER[b.round_type_id] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.id - b.id;
  });

  const out = new Map<number, RankFlag>();
  // 每个 (event, metric) 各维护一个 "已见过的值" 集合 (用于算 dense rank)
  const singlesSeen = new Map<string, Set<number>>();
  const averagesSeen = new Map<string, Set<number>>();

  const rankFor = (v: number, seen: Set<number>): number => {
    let distinctLess = 0;
    for (const s of seen) if (s < v) distinctLess++;
    return distinctLess + 1;
  };

  for (const r of sorted) {
    const eid = r.event_id;
    let singleRank: number | null = null;
    let averageRank: number | null = null;
    // 每把单次都按「该轮开始前的 seen 集合」算名次(口径同单次列).先全部算完再把 r.best 并入,
    // 这样最好那把(== r.best)与单次列的 singleRank 取自同一 seen、值相同 → 名次必然相等.
    const seen = singlesSeen.get(eid) ?? new Set<number>();
    // 逐把名次:在「该轮开始前的 round-best 集合 + 同轮更早的把」里算 dense rank.
    //   - 用 temp(seen 的副本)逐把累积,不污染持久 round-best 集合(列口径只认各轮最佳).
    //   - 同轮更早更快的把会压低后面把的名次(如 30.67 在前 → 38.75 不再是 PR).
    //   - 最好那把 = 全轮最小,同轮更早的把都 ≥ 它、不影响其名次 → 仍等于单次列 singleRank.
    //   - DNF/DNS(v<0)视作 +∞:名次 = 已见 distinct 数 + 1(不加入集合).v===0(空位)不出名次.
    const temp = new Set(seen);
    const attemptRanks = (r.attempts ?? []).map(v => {
      if (isValidValue(v)) { const rk = rankFor(v, temp); temp.add(v); return rk; }
      return v < 0 ? temp.size + 1 : null;
    });
    if (isValidValue(r.best)) {
      singleRank = rankFor(r.best, seen);
      seen.add(r.best);
      singlesSeen.set(eid, seen);
    }
    if (isValidValue(r.average)) {
      const seenA = averagesSeen.get(eid) ?? new Set<number>();
      averageRank = rankFor(r.average, seenA);
      seenA.add(r.average);
      averagesSeen.set(eid, seenA);
    }
    out.set(r.id, { singleRank, averageRank, attemptRanks });
  }
  return out;
}

