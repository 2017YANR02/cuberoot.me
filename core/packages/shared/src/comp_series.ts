import { resolveCompCityIdentities } from './comp_city_identity';

// 「相似比赛」分组 —— 把「明显同一系列」的比赛归为一类,供比赛详情页展示。两条独立判据:
//   1. 名字只差一个版本号(罗马数字 I/II/III/IV…、阿拉伯数字)或只差年份 —— seriesKey。
//   2. WCA 官方 championship_type(world / _大洲 / greater_china / 国家 ISO2)—— 权威把
//      「历年名字一直在变」的世锦赛 / 洲锦赛 / 国家锦标赛归为一类(名字匹配对这些无能为力:
//      世锦赛叫过 "Rubik's World Championship" / "World Rubik's Cube Championship" …)。
// 第 3 条判据「只看城市」单独走分片索引,见本文件末尾 buildCompCityIndexes。
// gen_all_comps 用它产 stats/comp_series.json(详情页读),客户端只读预算好的索引;
// 行为由 tests/comp-series.test.ts 锁。
//
// WCA 比赛名恒以 4 位年份结尾,版本号(若有)是年份前一个独立 token,故按空格切分即可。

/** 「相似比赛」索引里的一场比赛(精简字段,只够渲染一行链接卡)。 */
export interface SeriesComp {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2(直接喂 <Flag>)。 */
  country: string;
  /** start_date (yyyy-mm-dd)。 */
  start: string;
  /** end_date (yyyy-mm-dd)。 */
  end: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * 紧凑索引:series[i] 是一组相似比赛(≥2 场,按开始日期新→旧);
 * byId 把比赛 id 映到它所属的组下标列表(一场比赛可同属多组 —— 如某届世锦赛同时是主办国国锦赛)。
 */
export interface CompSeriesIndex {
  series: SeriesComp[][];
  byId: Record<string, number[]>;
}

// 罗马数字 1–3999(非空,大小写敏感取大写)。仅用来判断末尾 token 是不是版本号。
const ROMAN = /^(?=[IVXLCDM])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/**
 * 系列键 = 比赛名去掉末尾年份、再去掉末尾版本号(罗马数字或纯阿拉伯数字 token)后的主干。
 * 名字没有 4 位年份后缀、或去完主干太短(<2)时返回 null(不参与名字分组)。
 *   "Guangzhou GraDUAL 3x3 I 2026"  -> "Guangzhou GraDUAL 3x3"
 *   "Guangzhou GraDUAL 3x3 II 2026" -> "Guangzhou GraDUAL 3x3"
 *   "Beijing Open 2024"             -> "Beijing Open"
 * 注意 "3x3" 含字母 x,不是纯数字,不会被当版本号误删。
 */
export function seriesKey(name: string): string | null {
  if (!name) return null;
  const n = name.trim().replace(/\s+/g, ' ');
  const ym = n.match(/^(.*\S)\s+(?:19|20)\d{2}$/);
  if (!ym) return null;
  let stem = ym[1];
  const tok = stem.match(/^(.*\S)\s+(\S+)$/);
  if (tok && (ROMAN.test(tok[2]) || /^\d+$/.test(tok[2]))) stem = tok[1];
  stem = stem.trim();
  return stem.length >= 2 ? stem : null;
}

/**
 * 建索引。两类分组键:
 *   name:<主干>   —— seriesKey(名字只差版本号/年份)
 *   champ:<type>  —— championshipsByComp[id] 里的每个 WCA championship_type
 * 只保留 ≥2 场的组;大组先加,若某组成员已被某个已加入的组完全覆盖(子集/重复)则跳过
 * (如「XX国锦赛」名字组常与 champ:国家 组重合,去冗余)。真正互相重叠但互不包含的组(如
 * 主办国国锦赛 vs 世锦赛)都保留,该比赛同时进多组,详情页取并集。
 * 传入 comps 时先出现的 id 优先(重复 id 只留第一份 —— upcoming 应排在 past 前以取较新记录)。
 */
export function buildCompSeriesIndex(
  comps: SeriesComp[],
  championshipsByComp?: Record<string, string[]>,
): CompSeriesIndex {
  const compById = new Map<string, SeriesComp>();
  for (const c of comps) {
    if (!c.id || compById.has(c.id)) continue;
    compById.set(c.id, c);
  }

  const rawGroups = new Map<string, Set<string>>();
  const addTo = (key: string, id: string) => {
    let s = rawGroups.get(key);
    if (!s) { s = new Set<string>(); rawGroups.set(key, s); }
    s.add(id);
  };
  for (const c of compById.values()) {
    const k = seriesKey(c.name);
    if (k) addTo(`name:${k}`, c.id);
  }
  if (championshipsByComp) {
    for (const [id, types] of Object.entries(championshipsByComp)) {
      if (!compById.has(id)) continue;
      for (const t of types) if (t) addTo(`champ:${t}`, id);
    }
  }

  // 候选组按大小降序:超集先加,后来的子集/重复能被检测跳过。
  const candidates = [...rawGroups.values()]
    .map(s => [...s])
    .filter(a => a.length >= 2)
    .sort((a, b) => b.length - a.length);

  const series: SeriesComp[][] = [];
  const byId: Record<string, number[]> = {};
  for (const ids of candidates) {
    // 若某个已加入的组包含全部 ids(即各成员组下标集合的交非空)→ 子集/重复,跳过。
    let common: Set<number> | null = null;
    for (const id of ids) {
      const gs = byId[id];
      if (!gs) { common = null; break; }
      if (common === null) common = new Set(gs);
      else for (const x of [...common]) if (!gs.includes(x)) common.delete(x);
      if (common.size === 0) break;
    }
    if (common && common.size > 0) continue;

    const arr = ids.map(id => compById.get(id)!);
    arr.sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : a.id < b.id ? -1 : 1));
    const gi = series.length;
    series.push(arr);
    for (const c of arr) (byId[c.id] ??= []).push(gi);
  }
  return { series, byId };
}

// ── 第 3 条判据:只看城市 ────────────────────────────────────────────────────
// 「同城市」不能塞进 comp_series.json:几乎每场比赛都属于某个城市组(17.7k 场里 15.7k 场
// 所在城市 ≥2 场),全塞进去索引从 232KB gzip 涨到 ~490KB —— 而详情页一进就要整取它。
// 故按国家分片成 stats/comp_city/<ISO2>.json,客户端只拉当前比赛所在国那一份
// (最大 US ~65KB gzip,多数国家 <10KB)。城市身份统一由 comp_city_identity 解析,
// 与纪录城市榜共用同一套别名、地理消歧和异常坐标规则。

/** 同城市索引里的一场比赛:[id, name, start, end];国家由文件名隐含,城市由键隐含。 */
export type CityComp = [id: string, name: string, start: string, end: string];

/** 一个国家的同城市索引:规范 cityName → 该城市所有比赛(新→旧);只留 ≥2 场的城市。 */
export type CompCityIndex = Record<string, CityComp[]>;

/**
 * 建同城市索引,按国家 ISO2 分片:{ US: { "Berkeley, California": [[id,name,start,end], …] } }。
 * 与 buildCompSeriesIndex 同约定:重复 id 只留第一份(upcoming 应排在 past 前),
 * 组内按开始日期新→旧、同日按 id 升序;无 city 或无 country 的比赛不参与。
 */
export function buildCompCityIndexes(comps: SeriesComp[]): Record<string, CompCityIndex> {
  const seen = new Set<string>();
  const uniqueComps: SeriesComp[] = [];
  for (const comp of comps) {
    if (!comp.id || seen.has(comp.id)) continue;
    seen.add(comp.id);
    uniqueComps.push(comp);
  }
  const resolved = resolveCompCityIdentities(uniqueComps);
  const byCountry = new Map<string, Map<string, CityComp[]>>();
  for (const c of uniqueComps) {
    const city = resolved.byCompId.get(c.id)?.label ?? '';
    const country = (c.country ?? '').trim().toUpperCase();
    if (!city || !country) continue;
    let cities = byCountry.get(country);
    if (!cities) { cities = new Map(); byCountry.set(country, cities); }
    let list = cities.get(city);
    if (!list) { list = []; cities.set(city, list); }
    list.push([c.id, c.name, c.start, c.end || c.start]);
  }

  const out: Record<string, CompCityIndex> = {};
  for (const [country, cities] of byCountry) {
    const kept: CompCityIndex = {};
    for (const [city, list] of cities) {
      if (list.length < 2) continue;
      list.sort((a, b) => (a[2] < b[2] ? 1 : a[2] > b[2] ? -1 : a[0] < b[0] ? -1 : 1));
      kept[city] = list;
    }
    if (Object.keys(kept).length > 0) out[country] = kept;
  }
  return out;
}
