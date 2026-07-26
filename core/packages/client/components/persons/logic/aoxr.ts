// 选手页「AoXR」列 —— 一场比赛里某项目跨轮次的「平均的平均」。
//   · 前提:必须打满该场该项目的全部轮次。四轮的项目只打到复赛就被淘汰 → 不出 AoXR,
//     否则「只打了两轮」会冒充 Ao2R,与真·两轮赛制的 Ao2R 混在一起比。
//     判据:本人有决赛轮成绩(WCA 轮次是严格淘汰序列,进了决赛 ⇒ 前面每轮都打过)。
//   · 该场该项目「恰好 X 个」有效轮次(average > 0)时才成立,X ∈ [1,4]
//     (某轮平均 DNF → 该场掉一档:4 轮变 Ao3R,与世界榜同)
//   · 均值 Math.round 后再格式化(483.5 → 4.84;截断会写成 4.83,与世界榜差一个单位)
//   · 多盲无官方平均,整项排除
// 值的算法与世界榜 /wca/wr_aoxr(stats-build/src/core/ao_rounds.ts)一致;世界榜目前不带
// 「打满」前提,故它可能收录本页不显示的场次(榜取每人最小值,实际影响仅限极少数场次)。
// PR 名次口径同 logic/progress.ts 的 computePrRank:同「项目 × X 档」内按时间序 dense rank,
// 一经赋值冻结(Ao3R 只和 Ao3R 比 —— 轮数不同不可比)。直播(非官方)组不进官方序列,
// 自己另算一份「官方 + 直播」的名次,与成绩表 prRank / prRankLive 的分层一致。

import type { WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import { isMbldEvent } from '@/lib/mbf-average';

/** 世界榜只有 Ao1R…Ao4R 四档(ROUND_COUNTS)。WCA 一场比赛单项目不会超过 4 轮,
 *  这里只作防御上限:真出现异常数据时留空,而不是算出个查无此档的 Ao5R。 */
const MAX_ROUNDS = 4;

/** 决赛轮次 id:f 决赛 / c 组合决赛。b(B-决赛)不算 —— A 决赛在其之后照常举行,
 *  打 B-决赛的人并没有打满该项目的所有轮次。 */
const FINAL_ROUND_TYPES = new Set(['f', 'c']);

export interface AoxrCell {
  /** 轮数 X(1..4) */
  x: number;
  /** Math.round 后的均值,单位同 average(厘秒 / FMC moves×100) */
  value: number;
  /** 时间序 dense rank:1 = 当时本人该档最好 */
  prRank: number | null;
  /** 组内含直播轮次 → 非官方,不与官方场次同列比较 */
  unofficial: boolean;
}

export const aoxrKey = (compId: string, eventId: string): string => `${compId}|${eventId}`;

interface Bucket {
  compId: string;
  eventId: string;
  averages: number[];
  hasLive: boolean;
  /** 打过决赛轮 = 打满该项目所有轮次(决赛平均 DNF 也算打过) */
  reachedFinal: boolean;
}

/** 本人全部 results(需已叠加成绩变更链)+ comps → (比赛 × 项目) → AoXR 格 */
export function computeAoxr(
  results: WcaResultRow[],
  comps: WcaCompetition[],
): Map<string, AoxrCell> {
  const out = new Map<string, AoxrCell>();
  if (results.length === 0) return out;
  const compDate = new Map(comps.map((c) => [c.id, c.start_date]));

  const buckets = new Map<string, Bucket>();
  for (const r of results) {
    if (isMbldEvent(r.event_id)) continue;
    const key = aoxrKey(r.competition_id, r.event_id);
    let b = buckets.get(key);
    if (!b) {
      b = { compId: r.competition_id, eventId: r.event_id, averages: [], hasLive: false, reachedFinal: false };
      buckets.set(key, b);
    }
    if (r.average > 0) b.averages.push(r.average);
    if (r.live) b.hasLive = true;
    if (FINAL_ROUND_TYPES.has(r.round_type_id)) b.reachedFinal = true;
  }

  // 时间序 = 比赛日期 → 比赛 id(同日多场时稳定),与 computePrRank 同口径
  const ordered = [...buckets.entries()]
    .filter(([, b]) => b.reachedFinal && b.averages.length >= 1 && b.averages.length <= MAX_ROUNDS)
    .sort((a, b) => {
      const da = compDate.get(a[1].compId) ?? '';
      const db = compDate.get(b[1].compId) ?? '';
      if (da !== db) return da.localeCompare(db);
      return a[1].compId.localeCompare(b[1].compId);
    });
  if (ordered.length === 0) return out;

  const valueOf = (b: Bucket): number =>
    Math.round(b.averages.reduce((s, v) => s + v, 0) / b.averages.length);

  // dense rank:该场发生「当时」,同 (项目, X 档) 已见过的严格更优的不同值数 + 1
  const rankPass = (includeLive: boolean): Map<string, number> => {
    const ranks = new Map<string, number>();
    const seen = new Map<string, Set<number>>();
    for (const [key, b] of ordered) {
      if (!includeLive && b.hasLive) continue;
      const v = valueOf(b);
      const bk = `${b.eventId}|${b.averages.length}`;
      const s = seen.get(bk) ?? new Set<number>();
      let less = 0;
      for (const prev of s) if (prev < v) less++;
      ranks.set(key, less + 1);
      s.add(v);
      seen.set(bk, s);
    }
    return ranks;
  };

  const officialRanks = rankPass(false);
  const hasLive = ordered.some(([, b]) => b.hasLive);
  const liveRanks = hasLive ? rankPass(true) : null;

  for (const [key, b] of ordered) {
    out.set(key, {
      x: b.averages.length,
      value: valueOf(b),
      prRank: (b.hasLive ? liveRanks?.get(key) : officialRanks.get(key)) ?? null,
      unofficial: b.hasLive,
    });
  }
  return out;
}
