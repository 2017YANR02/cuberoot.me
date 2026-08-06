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
  /** 该成绩发生当时,在本 person 此 (event, metric) 历史已有成绩中的名次.
   *  1 = 当时是 PR (含并列), null = 无效 (DNF/DNS/0)
   *  rank 一经赋值即冻结,后续更好成绩不会"挤掉"它.
   *  单次名次口径 = 该单次发生前本人此项目的「所有 solve」(含平均里非最佳的把)中严格更快的
   *  有效成绩条数 + 1.
   *  平均名次同理统计此前严格更快的有效平均条数.两者都是 standard competition rank:
   *  并列同名次,但每条并列成绩都会占据后续名次位. */
  singleRank: number | null;
  averageRank: number | null;
  /** 每把单次的时间序 standard competition rank,口径同 singleRank.
   *  下标对齐 result.attempts;最好那把 == singleRank(同值同名次,与单次列一致).无效次 = null. */
  attemptRanks: (number | null)[];
}

// 时间序轮次顺序: 用于同一比赛内 round 排序 (老轮次在前). 与展示用的 ROUND_ORDER 相反.
// h=0 round (extras / heat-like), 1/d=first round, 2/g=quarter, 3=semi, b/c/f=finals.
const CHRONO_ROUND_ORDER: Record<string, number> = {
  'h': 0, '1': 1, 'd': 1, '2': 2, 'g': 2, '3': 3, 'sf': 3, 'b': 4, 'c': 4, 'f': 5,
};

/** 标准竞赛排名跟踪器:rank(v)=此前严格更优的成绩条数+1;并列同名次但分别占后续位置。
 *  值域从完整输入预建坐标,Fenwick tree 让单次、逐把、平均共用同一套 O(log n) 计数。 */
class CompetitionRankTracker {
  private readonly indexByValue: Map<number, number>;
  private readonly tree: Uint32Array;
  count = 0;

  constructor(values: number[]) {
    const coordinates = [...new Set(values)].sort((a, b) => a - b);
    this.indexByValue = new Map(coordinates.map((value, index) => [value, index + 1]));
    this.tree = new Uint32Array(coordinates.length + 1);
  }

  rank(value: number): number {
    const index = this.indexByValue.get(value);
    if (index === undefined) return 1;
    let better = 0;
    for (let i = index - 1; i > 0; i -= i & -i) better += this.tree[i];
    return better + 1;
  }

  add(value: number): void {
    const index = this.indexByValue.get(value);
    if (index === undefined) return;
    for (let i = index; i < this.tree.length; i += i & -i) this.tree[i]++;
    this.count++;
  }
}

function rankTrackers(results: WcaResultRow[]): {
  single: Map<string, CompetitionRankTracker>;
  average: Map<string, CompetitionRankTracker>;
} {
  const singleValues = new Map<string, number[]>();
  const averageValues = new Map<string, number[]>();
  for (const r of results) {
    const singles = singleValues.get(r.event_id) ?? [];
    if (isValidValue(r.best)) singles.push(r.best);
    for (const value of r.attempts ?? []) if (isValidValue(value)) singles.push(value);
    singleValues.set(r.event_id, singles);

    const averages = averageValues.get(r.event_id) ?? [];
    if (isValidValue(r.average)) averages.push(r.average);
    averageValues.set(r.event_id, averages);
  }
  const build = (values: Map<string, number[]>) => new Map(
    [...values].map(([eventId, eventValues]) => [eventId, new CompetitionRankTracker(eventValues)]),
  );
  return { single: build(singleValues), average: build(averageValues) };
}

/** 时间序 PR rank: 按 (comp.start_date, round, result.id) 时间序遍历本 person 全部成绩.
 *  单次维度的「已见过」序列 = 此前所有 solve(含平均里非最佳的把),不是只算各轮最佳单次;
 *  这样一把更早更快的非最佳把(如某次平均里的 43.66)会压低后来更慢单次(如 43.88)的名次.
 *  平均维度按标准竞赛排名:并列平均同名次,但会分别占据后续名次位.
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
  const { single: singleRankers, average: averageRankers } = rankTrackers(results);

  for (const r of sorted) {
    const eid = r.event_id;
    let singleRank: number | null = null;
    let averageRank: number | null = null;
    const singleRanker = singleRankers.get(eid)!;
    // 单次列名次在本轮 attempts 入池前计算;本轮最快把因此与它自己的 attempt rank 一致.
    if (isValidValue(r.best)) singleRank = singleRanker.rank(r.best);
    // 逐把按本轮顺序入同一个标准竞赛排名器,同轮更早更快的把会压低后面把的名次.
    // DNF/DNS(v<0)视作 +∞:名次 = 已见有效 solve 条数 + 1(不入池).v===0(空位)不出名次.
    let hasValidAttempt = false;
    const attemptRanks = (r.attempts ?? []).map(v => {
      if (isValidValue(v)) {
        hasValidAttempt = true;
        const rank = singleRanker.rank(v);
        singleRanker.add(v);
        return rank;
      }
      return v < 0 ? singleRanker.count + 1 : null;
    });
    // 无逐把明细时(只有 best)退化为单值,保证单次维度仍能累积.
    if (!hasValidAttempt && isValidValue(r.best)) singleRanker.add(r.best);
    if (isValidValue(r.average)) {
      const averageRanker = averageRankers.get(eid)!;
      averageRank = averageRanker.rank(r.average);
      averageRanker.add(r.average);
    }
    out.set(r.id, { singleRank, averageRank, attemptRanks });
  }
  return out;
}
