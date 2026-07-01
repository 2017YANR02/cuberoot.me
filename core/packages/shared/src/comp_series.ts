// 「相似比赛」分组 —— 把名字只差一个版本号(罗马数字 I/II/III/IV…、阿拉伯数字)或
// 只差年份的比赛归为一类。gen_all_comps 用它产 stats/comp_series.json(详情页读),
// 客户端只读预算好的索引;seriesKey 在此单点定义,由 tests/comp-series.test.ts 锁行为。
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
  /** 项目短码列表(与 all_*_comps.json 一致)。 */
  events?: string[];
}

/** 紧凑索引:series[i] 是一组相似比赛(≥2 场,按开始日期新→旧);byId 把比赛 id 映到组下标。 */
export interface CompSeriesIndex {
  series: SeriesComp[][];
  byId: Record<string, number>;
}

// 罗马数字 1–3999(非空,大小写敏感取大写)。仅用来判断末尾 token 是不是版本号。
const ROMAN = /^(?=[IVXLCDM])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/**
 * 系列键 = 比赛名去掉末尾年份、再去掉末尾版本号(罗马数字或纯阿拉伯数字 token)后的主干。
 * 名字没有 4 位年份后缀、或去完主干太短(<2)时返回 null(不参与分组)。
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
 * 按系列键分组;只保留 ≥2 场的组,每组按开始日期新→旧排。返回客户端用的紧凑索引。
 * 传入顺序里先出现的 id 优先(重复 id 只留第一份 —— upcoming 应排在 past 前以取较新记录)。
 */
export function buildCompSeriesIndex(comps: SeriesComp[]): CompSeriesIndex {
  const groups = new Map<string, SeriesComp[]>();
  const seen = new Set<string>();
  for (const c of comps) {
    if (!c.id || seen.has(c.id)) continue;
    seen.add(c.id);
    const k = seriesKey(c.name);
    if (!k) continue;
    const arr = groups.get(k);
    if (arr) arr.push(c);
    else groups.set(k, [c]);
  }
  const series: SeriesComp[][] = [];
  const byId: Record<string, number> = {};
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : a.id < b.id ? -1 : 1));
    const idx = series.length;
    series.push(arr);
    for (const c of arr) byId[c.id] = idx;
  }
  return { series, byId };
}
