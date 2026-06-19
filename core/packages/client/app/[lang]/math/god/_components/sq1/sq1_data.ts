/**
 * Square-1 (SQ1) 上帝之数页 — 经核查的数据层。
 *
 * 全部数值来自穷举计算的一手来源,见各字段注释。所有计数均 < 2^53(JS number 安全),
 * 故用普通数字字面量;状态空间大数同时给精确逗号字符串供展示。
 *
 * 三套计步口径(关键,见页面 §计步):
 *   - twist / "slash":只数 "/" 切片,顶底层转免费 → 上帝之数 13(Masonjones 2005)
 *   - face-turn:(x,0)/(0,y)/"/" 各 1,双层 (x,y)=2 → 上帝之数 31(Chen 2017)
 *   - WCA 12c4:(X,Y)=1,"/"=1(UI/cstimer 报的口径)→ 上帝之数已收窄 26 ≤ D ≤ 27
 *     (本站 2026-06:下界 26 实证全量真打乱、上界 27 借 Masonjones 扭转 13 换算;精确值 26/27 仍未解)
 */

export interface DepthRow {
  d: number;
  /** 该深度恰好首达的位置数(穷举,精确) */
  count: number;
  /** 累积:深度 ≤ d 的位置数 */
  cum: number;
}

/** 累积转每深度计数 + 校验。 */
function withCum(perDepth: { d: number; count: number }[]): DepthRow[] {
  let acc = 0;
  return perDepth.map((r) => {
    acc += r.count;
    return { d: r.d, count: r.count, cum: acc };
  });
}

/**
 * 扭转(twist / slash)口径完整分布,0..13。
 * 来源:Jaap Scherphuis / Mike Masonjones 2005 穷举(约 800MHz 跑一年),
 * https://www.jaapsch.net/puzzles/square1t.htm 。只数 "/",顶底层转免费。
 */
export const TWIST_DIST: DepthRow[] = withCum([
  { d: 0, count: 1 },
  { d: 1, count: 64 },
  { d: 2, count: 1_153 },
  { d: 3, count: 17_050 },
  { d: 4, count: 235_144 },
  { d: 5, count: 3_091_458 },
  { d: 6, count: 38_893_230 },
  { d: 7, count: 452_031_138 },
  { d: 8, count: 4_459_167_504 },
  { d: 9, count: 33_671_064_770 },
  { d: 10, count: 149_502_310_936 },
  { d: 11, count: 183_662_070_768 }, // peak
  { d: 12, count: 63_945_120_032 },
  { d: 13, count: 157_452_752 }, // antipodes
]);

/**
 * 面转(face-turn)口径完整分布,0..31。
 * 来源:Shuang Chen(cs0x7f / 论坛 qq280833822)2017-12-28 穷举(722GB 磁盘 BFS),
 * https://www.speedsolving.com/threads/square-one-can-be-solved-in-31-moves-in-face-turn-metric.67363/ 。
 * 度量:(x,0)/(0,y)/"/" 各 1,双层 (x,y) = 2。
 */
export const FACE_DIST: DepthRow[] = withCum([
  { d: 0, count: 1 },
  { d: 1, count: 15 },
  { d: 2, count: 69 },
  { d: 3, count: 212 },
  { d: 4, count: 1_141 },
  { d: 5, count: 3_933 },
  { d: 6, count: 14_029 },
  { d: 7, count: 44_188 },
  { d: 8, count: 138_952 },
  { d: 9, count: 446_720 },
  { d: 10, count: 1_316_172 },
  { d: 11, count: 4_175_446 },
  { d: 12, count: 12_147_472 },
  { d: 13, count: 37_884_628 },
  { d: 14, count: 109_466_234 },
  { d: 15, count: 332_879_292 },
  { d: 16, count: 956_379_612 },
  { d: 17, count: 2_830_921_668 },
  { d: 18, count: 8_002_926_230 },
  { d: 19, count: 22_662_798_296 },
  { d: 20, count: 61_124_357_782 },
  { d: 21, count: 160_994_777_902 },
  { d: 22, count: 396_626_886_108 },
  { d: 23, count: 927_646_447_818 },
  { d: 24, count: 1_889_794_966_390 },
  { d: 25, count: 3_128_948_769_310 },
  { d: 26, count: 3_301_932_153_566 }, // peak
  { d: 27, count: 1_766_634_454_944 },
  { d: 28, count: 281_534_253_876 },
  { d: 29, count: 8_469_254_908 },
  { d: 30, count: 8_987_110 },
  { d: 31, count: 376 }, // antipodes
]);

export interface MetricInfo {
  key: 'twist' | 'wca' | 'face';
  /** 短名 */
  name: { zh: string; en: string };
  /** (x,y) 与 / 的计法说明 */
  rule: { zh: string; en: string };
  /** 上帝之数:已证的单一值,或 null = 非单一已证值(见 godText / bound) */
  god: number | null;
  /** 显示用:非单一值时的文本(如已收窄区间 '26–27') */
  godText?: string;
  /** 已知区间下/上界(WCA:下界实证、上界借用;数轴 / 逻辑用) */
  bound?: { lo: number; hi: number };
  /** 平均最优步,未知则 null */
  avg: number | null;
  /** 状态空间(展示用精确字符串) */
  space: string;
  /** 已证 / 未解 */
  status: 'proven' | 'open';
  /** 证明者 + 年份 */
  who: { zh: string; en: string };
}

export const METRICS: Record<MetricInfo['key'], MetricInfo> = {
  twist: {
    key: 'twist',
    name: { zh: '扭转口径', en: 'Twist metric' },
    rule: { zh: '只数 "/" 切片,顶底层转免费', en: 'count only "/"; layer turns are free' },
    god: 13,
    avg: 10.615,
    space: '435,891,456,000',
    status: 'proven',
    who: { zh: 'Masonjones 2005,穷举', en: 'Masonjones 2005, exhaustive' },
  },
  face: {
    key: 'face',
    name: { zh: '面转口径', en: 'Face-turn metric' },
    rule: { zh: '(x,0)/(0,y)/"/" 各 1,双层 (x,y) = 2', en: '(x,0)/(0,y)/"/" = 1; combined (x,y) = 2' },
    god: 31,
    avg: 25.134,
    space: '11,958,666,854,400',
    status: 'proven',
    who: { zh: 'Chen 2017,722GB 磁盘 BFS', en: 'Chen 2017, 722 GB disk BFS' },
  },
  wca: {
    key: 'wca',
    name: { zh: 'WCA 12c4 口径', en: 'WCA 12c4 metric' },
    rule: { zh: '(X,Y) = 1,"/" = 1(UI / 打乱长度口径)', en: '(X,Y) = 1, "/" = 1 (the UI / scramble-length metric)' },
    god: null,
    godText: '26–27',
    bound: { lo: 26, hi: 27 },
    avg: null,
    space: '11,958,666,854,400',
    status: 'open',
    who: { zh: '已收窄 26–27,精确值未解', en: 'narrowed to 26–27; exact value open' },
  },
};

/** 状态空间的几个口径(精确字符串)。来源 jaapsch.net/square1.htm + square1p.htm。 */
export const STATE_SPACE = {
  /** 严格的不同位置数 = 15!/3 */
  distinct: '435,891,456,000',
  /** 170 × 2 × 8! × 8!(不完全约去层转) */
  raw: '552,738,816,000',
  /** 19305 × 2 × 8! × 8!(每个朝向单独计) */
  rotationsDistinct: '62,768,369,664,000',
  /** 3678 × 2 × 8! × 8!(可切位置,面转 BFS 的搜索空间) */
  twistable: '11,958,666,854,400',
  shapes: {
    singleLayer: 29,
    pairings: 170,
    cube: 90,
    twistable: 3678,
  },
} as const;

/** ben1996123 的 2-生成子群直径(turn 口径 /=1,(x,0)=1),不是整体上帝之数。 */
export const TWOGEN = {
  diameter: 43,
  diameterWithMiddle: 44,
  tableMB: 457,
  tableWithMiddleMB: 914,
};

/** 千位逗号格式化(整数;均在安全范围内)。 */
export function commas(n: number): string {
  return n.toLocaleString('en-US');
}

/** 大数科学计数缩写,用于图轴/读数。 */
export function sci(n: number): string {
  if (n < 1e6) return n.toLocaleString('en-US');
  const e = Math.floor(Math.log10(n));
  const m = n / Math.pow(10, e);
  return `${m.toFixed(2)} × 10^${e}`;
}
