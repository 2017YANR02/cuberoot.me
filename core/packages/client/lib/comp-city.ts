// 「相似比赛」的第 3 条判据(只看城市)客户端读取层 —— 读 gen_all_comps 预算好的
// stats/comp_city/<ISO2>.json(一国一文件)。分片而非并进 comp_series.json:几乎每场比赛都
// 有同城比赛,全塞进那个整取的索引会让它翻倍;这里只拉当前比赛所在国那份(多数国家 <10KB gzip)。
import { statsUrl } from './stats-base';
import type { CompCityIndex, SeriesComp } from '@cuberoot/shared/comp-series';

const EMPTY: CompCityIndex = {};
const byCountry = new Map<string, Promise<CompCityIndex>>();

/** 某国的同城市索引,按 ISO2 memoize(拉不到 / 该国无 ≥2 场的城市 → 空对象)。 */
function loadCountryCities(iso2: string): Promise<CompCityIndex> {
  const cc = iso2.toUpperCase();
  let p = byCountry.get(cc);
  if (!p) {
    p = fetch(statsUrl(`/stats/comp_city/${cc}.json`))
      .then(r => (r.ok ? r.json() as Promise<CompCityIndex> : EMPTY))
      .catch(() => EMPTY);
    byCountry.set(cc, p);
  }
  return p;
}

/**
 * 同城市的其它比赛(新→旧)。城市优先按 compId 在索引里自查 —— 与索引口径必然一致,
 * 免受 WCA API 的 city 串与 dump cityName 万一不同步之累;查不到再退回传入的 city 串
 * (刚公示、还没进周更 dump 的新比赛走这条)。exclude 用来去掉已在「同系列」里列过的场次。
 */
export async function getSameCityComps(
  compId: string,
  country: string,
  city?: string,
  exclude?: Iterable<string>,
): Promise<SeriesComp[]> {
  const cc = (country || '').toUpperCase();
  if (!compId || !cc) return [];
  const idx = await loadCountryCities(cc);
  let cityName = '';
  for (const [name, list] of Object.entries(idx)) {
    if (list.some(c => c[0] === compId)) { cityName = name; break; }
  }
  if (!cityName) {
    const fallback = (city || '').trim();
    if (fallback && idx[fallback]) cityName = fallback;
  }
  if (!cityName) return [];
  const skip = new Set<string>([compId, ...(exclude ?? [])]);
  return (idx[cityName] ?? [])
    .filter(c => !skip.has(c[0]))
    .map(([id, name, start, end]): SeriesComp => ({ id, name, country: cc, start, end, city: cityName }));
}
