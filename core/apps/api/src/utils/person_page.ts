/**
 * 选手页 profile 的组装(纯函数,便于对着 WCA 官网响应做 parity 测试)。
 *
 * personal_records 官方也是两样拼的:**值**是本人历史最小有效成绩,**名次**是当下排名快照。
 * 我们这边同样 —— 值现算自 wca_person_results,名次取 wca_person_ranks 的三档数组。
 * 数组下标必须与 stats-build 写入时的 RANK_EVENTS 顺序严格一致,错一位整张 PR 表就全错,
 * 所以顺序在这里定义一次,测试锁死。
 */
export const RANK_EVENTS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh',
  'minx', 'pyram', 'clock', 'skewb', 'sq1',
  '444bf', '555bf', '333mbf',
  '333ft', 'magic', 'mmagic', '333mbo',
] as const;

export interface MirrorResultRow {
  event_id: string;
  best: number;      // WCA 编码:>0 有效 / -1 DNF / -2 DNS / 0 无
  average: number;
  round_type_id?: string;
  pos?: number;
}

// 决赛轮(含合并决赛 c / combined-b)的前三名才算奖牌 —— 与前端 podium.ts 同一条规则。
// 口径实测:2017YANR02 按此得 1 银 3 铜,与官网 profile.medals 一致;而 wca_fs_medals
// (fun-stats 那张)是另一套口径(2 银 5 铜),不能拿来填这个字段。
const FINAL_ROUND_TYPES = new Set(['f', 'c', 'b']);

export function countMedals(results: MirrorResultRow[]): { gold: number; silver: number; bronze: number } {
  let gold = 0, silver = 0, bronze = 0;
  for (const r of results) {
    if (!FINAL_ROUND_TYPES.has(r.round_type_id ?? '')) continue;
    const pos = r.pos ?? 0;
    if (pos === 1) gold++;
    else if (pos === 2) silver++;
    else if (pos === 3) bronze++;
  }
  return { gold, silver, bronze };
}

export interface PersonRanksRow {
  ranks_world: number[] | null;
  ranks_country: number[] | null;
  ranks_continent: number[] | null;
}

export interface PersonalRecordCell {
  best: number;
  world_rank: number | null;
  continent_rank: number | null;
  country_rank: number | null;
  event_id: string;
}

export type PersonalRecords = Record<string, { single?: PersonalRecordCell; average?: PersonalRecordCell }>;

/** 名次数组 → { eventId: rank }。0 / 缺位 = 该项无名次(官方响应里这项就不出现)。 */
export function ranksByEvent(arr: number[] | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!arr) return out;
  RANK_EVENTS.forEach((ev, i) => {
    const v = arr[i];
    if (typeof v === 'number' && v > 0) out.set(ev, v);
  });
  return out;
}

export function buildPersonalRecords(
  results: MirrorResultRow[],
  singleRanks?: PersonRanksRow,
  avgRanks?: PersonRanksRow,
): PersonalRecords {
  const wr = ranksByEvent(singleRanks?.ranks_world);
  const cr = ranksByEvent(singleRanks?.ranks_continent);
  const nr = ranksByEvent(singleRanks?.ranks_country);
  const awr = ranksByEvent(avgRanks?.ranks_world);
  const acr = ranksByEvent(avgRanks?.ranks_continent);
  const anr = ranksByEvent(avgRanks?.ranks_country);

  const bestSingle = new Map<string, number>();
  const bestAverage = new Map<string, number>();
  for (const r of results) {
    if (r.best > 0) {
      const cur = bestSingle.get(r.event_id);
      if (cur == null || r.best < cur) bestSingle.set(r.event_id, r.best);
    }
    if (r.average > 0) {
      const cur = bestAverage.get(r.event_id);
      if (cur == null || r.average < cur) bestAverage.set(r.event_id, r.average);
    }
  }

  const out: PersonalRecords = {};
  for (const [eventId, best] of bestSingle) {
    out[eventId] = {
      single: {
        best,
        world_rank: wr.get(eventId) ?? null,
        continent_rank: cr.get(eventId) ?? null,
        country_rank: nr.get(eventId) ?? null,
        event_id: eventId,
      },
    };
  }
  for (const [eventId, best] of bestAverage) {
    const entry = out[eventId] ?? (out[eventId] = {});
    entry.average = {
      best,
      world_rank: awr.get(eventId) ?? null,
      continent_rank: acr.get(eventId) ?? null,
      country_rank: anr.get(eventId) ?? null,
      event_id: eventId,
    };
  }
  return out;
}
