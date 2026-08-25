/**
 * WCA Live 近期纪录 overlay —— 给世界/全国排名(/WRn 后缀、rank-for)补上「官方 dump 尚未收录
 * 的刚结束比赛」。
 *
 * 背景:worldRankTop100 / rank-for 的分母是 stats-build 周更的 wca_results_flat 快照,不含刚
 * 结束几天的比赛。于是同一周内背靠背的两场顶尖成绩会互相看不见:郭铠希 1.52 斜转平均在快照里
 * 算 WR3,但 Grohmann 已在刚结束的 Euro 2026 跑出 1.47(= 捷克 NR = WR3),真实名次应是 WR4。
 *
 * 够格影响世界前列的跨赛事成绩,几乎必然本身就是地区纪录(NR/CR/WR),而 WCA Live 的
 * recentRecords 正好覆盖它们(record 监控已在拉同一份)。这里独立轻量拉一次、60s 缓存,
 * 供 rank 计算叠加。失败 → 返空 → 排名回退纯快照(优雅降级,行为同修复前)。
 *
 * 注意:这里只提供「原始候选」;是否真该 +1(还是快照早已计入该选手)由调用方按每人快照 PB
 * 去重(见 wca_stats_extra overlayDelta)。
 */

const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';

// 只取排名去重必需的最小字段;结构对齐 wca_live_record.ts 的 RECORDS_QUERY(WCA Live 真实 schema)。
const OVERLAY_QUERY = `
{
  recentRecords {
    type
    attemptResult
    result {
      person { wcaId country { iso2 } }
      round {
        competitionEvent {
          event { id }
          competition { id wcaId }
        }
      }
    }
  }
}
`;

interface RawRecent {
  type: string; // 'single' | 'average'
  attemptResult: number;
  result: {
    person: { wcaId: string | null; country: { iso2: string | null } | null } | null;
    round: {
      competitionEvent: {
        event: { id: string } | null;
        competition: { id: string; wcaId: string | null } | null;
      } | null;
    } | null;
  } | null;
}

export interface OverlayEntry {
  wcaId: string;
  iso2: string;
  /** 比赛标识,用 WCA 比赛 id(competition.wcaId,与客户端 comp 页 slug 同口径,供 excludeComp 匹配);
   *  未关联 WCA id 时回退 WCA Live 内部 id(不会与任何 slug 匹配,等于不排除,可接受)。 */
  compId: string;
  value: number; // centiseconds, > 0
}

/** key = `${eventId}|${isAvg ? 1 : 0}`(eventId 小写,对齐 rank 索引口径) */
type OverlayMap = Map<string, OverlayEntry[]>;

const TTL_MS = 60_000;
let cache: { map: OverlayMap; at: number } | null = null;
let inflight: Promise<OverlayMap> | null = null;

function overlayKey(eventId: string, isAvg: boolean): string {
  return `${eventId.toLowerCase()}|${isAvg ? 1 : 0}`;
}

async function fetchOverlay(): Promise<OverlayMap> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(WCA_LIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: OVERLAY_QUERY }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { data?: { recentRecords?: RawRecent[] }; errors?: { message: string }[] };
    if (j.errors?.length) throw new Error(`GraphQL: ${j.errors[0]!.message}`);
    const recs = j.data?.recentRecords ?? [];

    // 同 (event, isAvg, 选手) 只留最快一条(同人可能连破)。
    const byKeyPerson = new Map<string, Map<string, OverlayEntry>>();
    for (const r of recs) {
      const wcaId = r.result?.person?.wcaId;
      const eventId = r.result?.round?.competitionEvent?.event?.id;
      const comp = r.result?.round?.competitionEvent?.competition;
      const compId = comp?.wcaId || comp?.id;
      const value = Number(r.attemptResult);
      if (!wcaId || !eventId || !compId || !(value > 0)) continue;
      const isAvg = r.type === 'average';
      const key = overlayKey(eventId, isAvg);
      const iso2 = (r.result?.person?.country?.iso2 ?? '').toUpperCase();
      let people = byKeyPerson.get(key);
      if (!people) { people = new Map(); byKeyPerson.set(key, people); }
      const cur = people.get(wcaId);
      if (!cur || value < cur.value) people.set(wcaId, { wcaId, iso2, compId, value });
    }

    const map: OverlayMap = new Map();
    for (const [key, people] of byKeyPerson) map.set(key, [...people.values()]);
    return map;
  } finally {
    clearTimeout(t);
  }
}

/** 近期纪录 overlay(60s 缓存 + in-flight 去重);拉取失败静默返空 Map。 */
async function getOverlay(): Promise<OverlayMap> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const map = await fetchOverlay();
      cache = { map, at: Date.now() };
      return map;
    } catch (e) {
      console.warn('[rank-overlay] fetch failed:', (e as Error).message);
      // 失败也短暂缓存空结果,避免每次 rank 请求都打 WCA Live。
      cache = { map: new Map(), at: Date.now() };
      return cache.map;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 某 (event, 单/平均) 的近期纪录候选(原始,未按快照去重)。失败返 []。 */
export async function getOverlayEntries(eventId: string, isAvg: boolean): Promise<OverlayEntry[]> {
  const map = await getOverlay();
  return map.get(overlayKey(eventId, isAvg)) ?? [];
}

/**
 * 纯函数:近期纪录对某成绩名次的增量(无 I/O,便于测试)。
 *   Δ = overlay 里 value 严格更快、排除 excludeComp、且该选手快照 PB 未 < value(否则官方榜已计入,
 *       不重复加)的【不同选手】数。
 * world 全算;national 只算 iso2 与 countryIso2 同国者(全国榜同口径)。
 */
export function overlayDeltaPure(
  entries: OverlayEntry[],
  snapshotBests: Map<string, number>,
  value: number,
  opts: { excludeComp?: string; countryIso2?: string } = {},
): { world: number; national: number } {
  if (!(value > 0)) return { world: 0, national: 0 };
  // 候选:严格更快 + 排除指定比赛 + 按选手去重。
  const cand = new Map<string, string>(); // wcaId → iso2
  for (const e of entries) {
    if (!(e.value > 0) || e.value >= value) continue;
    if (opts.excludeComp && e.compId === opts.excludeComp) continue;
    if (!cand.has(e.wcaId)) cand.set(e.wcaId, e.iso2);
  }
  const country = (opts.countryIso2 ?? '').toUpperCase();
  let world = 0;
  let national = 0;
  for (const [wcaId, iso2] of cand) {
    const sb = snapshotBests.get(wcaId);
    if (sb != null && sb < value) continue; // 快照已计入,不重复加
    world++;
    if (country && iso2.toUpperCase() === country) national++;
  }
  return { world, national };
}
