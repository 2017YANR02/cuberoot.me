// 「相似比赛」客户端读取层 —— 只读 gen_all_comps 预算好的 stats/comp_series.json
// (名字只差版本号/年份的比赛分组)。分组算法在 @cuberoot/shared/comp-series 单点定义。
import { statsUrl } from './stats-base';
import type { SeriesComp, CompSeriesIndex } from '@cuberoot/shared/comp-series';

export type { SeriesComp };

const EMPTY: CompSeriesIndex = { series: [], byId: {} };
let cache: CompSeriesIndex | null = null;
let inflight: Promise<CompSeriesIndex> | null = null;

/** 整取索引(~260KB gzip),全局 memoize —— 一个会话里第一场比赛拉一次,后续免费。 */
export async function loadCompSeries(): Promise<CompSeriesIndex> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(statsUrl('/stats/comp_series.json'))
      .then(r => (r.ok ? r.json() : EMPTY))
      .then((j: CompSeriesIndex) => { cache = j; return j; })
      .catch(() => { cache = EMPTY; return EMPTY; });
  }
  return inflight;
}

/** compId 所有相似组里的其它比赛(并集,不含自己),按开始日期新→旧。无相似比赛时返回 []。 */
export async function getSimilarComps(compId: string): Promise<SeriesComp[]> {
  const idx = await loadCompSeries();
  const gis = idx.byId[compId];
  if (!gis || gis.length === 0) return [];
  const seen = new Set<string>([compId]);
  const out: SeriesComp[] = [];
  for (const gi of gis) {
    for (const c of idx.series[gi] ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  out.sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : a.id < b.id ? -1 : 1));
  return out;
}
