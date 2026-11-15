// 选手页「AoXR」列 —— 一场比赛里某项目跨轮次的「平均的平均」。
// 口径与世界榜 /wca/wr_aoxr 严格一致(stats-build/src/core/ao_rounds.ts):
//   · 前提一「打满」:必须参加该场该项目的全部轮次。四轮的项目只打到复赛就被淘汰 → 不出
//     AoXR,否则「只打了两轮」会冒充 Ao2R,与真·两轮赛制的 Ao2R 混在一起比。
//     判据:本人有决赛轮成绩(WCA 轮次是严格淘汰序列,进了决赛 ⇒ 前面每轮都打过)。
//   · 前提二「无 DNF」:每一轮都得有有效平均(average > 0)。任何一轮平均 DNF / 未过及格线
//     没打出平均 → 整场不出值(不再像早期那样掉一档凑成 Ao3R)。
//   · 于是 X = 该场轮数 = 有效平均个数,X ∈ [1,4]
//   · 均值 Math.round 后再格式化(483.5 → 4.84;截断会写成 4.83,与世界榜差一个单位)
//   · 多盲无官方平均,整项排除
// AoXR 保留自己的「项目 × X 档」时间序 dense rank,一经赋值冻结
// (Ao3R 只和 Ao3R 比 —— 轮数不同不可比)。直播(非官方)组不进官方序列,
// 自己另算一份「官方 + 直播」的名次,与成绩表 prRank / prRankLive 的分层一致。

import type { WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
import { summarizeAoxr } from '@/lib/wca-aoxr';
import { aoxrRecordKey } from '@/lib/aoxr-records';

export interface AoxrCell {
  /** 轮数 X(1..4) */
  x: number;
  /** Math.round 后的均值,单位同 average(厘秒 / FMC moves×100) */
  value: number;
  /** 时间序 dense rank:1 = 当时本人该档最好 */
  prRank: number | null;
  /** 组内含直播轮次 → 非官方,不与官方场次同列比较 */
  unofficial: boolean;
  record?: 'WR';
}

export const aoxrKey = (compId: string, eventId: string): string => `${compId}|${eventId}`;

interface Bucket {
  compId: string;
  eventId: string;
  rounds: WcaResultRow[];
  hasLive: boolean;
}

/** 本人全部 results(需已叠加成绩变更链)+ comps → (比赛 × 项目) → AoXR 格 */
export function computeAoxr(
  results: WcaResultRow[],
  comps: WcaCompetition[],
  records?: { wcaId: string; worldRecords: ReadonlySet<string> | null },
): Map<string, AoxrCell> {
  const out = new Map<string, AoxrCell>();
  if (results.length === 0) return out;
  const compDate = new Map(comps.map((c) => [c.id, c.start_date]));

  const buckets = new Map<string, Bucket>();
  for (const r of results) {
    const key = aoxrKey(r.competition_id, r.event_id);
    let b = buckets.get(key);
    if (!b) {
      b = {
        compId: r.competition_id, eventId: r.event_id,
        rounds: [], hasLive: false,
      };
      buckets.set(key, b);
    }
    b.rounds.push(r);
    if (r.live) b.hasLive = true;
  }

  // 时间序 = 比赛日期 → 比赛 id(同日多场时稳定),与 computePrRank 同口径
  const ordered = [...buckets.entries()]
    .flatMap(([key, b]) => {
      const summary = summarizeAoxr(b.eventId, b.rounds);
      return summary ? [[key, { ...b, summary }] as const] : [];
    })
    .sort((a, b) => {
      const da = compDate.get(a[1].compId) ?? '';
      const db = compDate.get(b[1].compId) ?? '';
      if (da !== db) return da.localeCompare(db);
      return a[1].compId.localeCompare(b[1].compId);
    });
  if (ordered.length === 0) return out;

  // dense rank:该场发生「当时」,同 (项目, X 档) 已见过的严格更优的不同值数 + 1
  const rankPass = (includeLive: boolean): Map<string, number> => {
    const ranks = new Map<string, number>();
    const seen = new Map<string, Set<number>>();
    for (const [key, b] of ordered) {
      if (!includeLive && b.hasLive) continue;
      const v = b.summary.value;
      const bk = `${b.eventId}|${b.summary.x}`;
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
      x: b.summary.x,
      value: b.summary.value,
      prRank: (b.hasLive ? liveRanks?.get(key) : officialRanks.get(key)) ?? null,
      unofficial: b.hasLive,
      ...(!b.hasLive && records?.worldRecords?.has(aoxrRecordKey(
        records.wcaId, b.compId, b.eventId, b.summary.x, b.summary.sum,
      )) ? { record: 'WR' as const } : {}),
    });
  }
  return out;
}
