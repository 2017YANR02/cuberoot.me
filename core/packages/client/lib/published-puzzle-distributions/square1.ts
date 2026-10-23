/** Published Square-1 exact count tables, shared by mathematics and statistics.
 * The original authors, move metrics and position equivalences are recorded below.
 * These constants do not contain per-state scrambles or solutions. */

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
