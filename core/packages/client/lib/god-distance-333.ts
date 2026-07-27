/**
 * 三阶 HTM 距离分布(0..20)—— 全站单一源。
 *
 * 站上有四个地方画这张分布(/math/god、/math/group 两处、/why-cube、/wca/prediction),
 * 以前各存一份手抄表,d=16..19 四处互相打架:有的写 2.49e19,有的写 2.929e19,还有的
 * 精确到 `1_100_531_606_815_050_000n` 这种 cube20.org 从来没公布过的位数。全部改成从这里 import。
 *
 * 来源分级(混在一张表里,靠 `kind` 区分,不许混着用):
 *   - `exact`   d ≤ 15:Rokicki 等人的穷举结果,逐位精确。
 *   - `approx`  d = 16..19:cube20.org 只给到**两位有效数字**。四项相加比真实尾部大 1.03%
 *               —— 那是四舍五入的必然结果,不是数据错。
 *   - `atLeast` d = 20:490,000,000 是「已经找到这么多个 20 步态」,是下界不是计数。
 *
 * 真实尾部总和 `GOD_TAIL_TOTAL = |G| − Σ(d ≤ 15)` 反而是**精确**的 —— 这是唯一能对 d ≥ 16
 * 说的硬话。要画占比 / 算期望的调用方走 `GOD_DIST_333_NORMALIZED`:把四个估计值等比缩到
 * 尾部真值,Σ 由构造恰为 |G|,不会出现「各档占比加起来 101%」。
 *
 * 数据:<https://www.cube20.org/>。锁在 tests/god_distance_333.test.ts。
 */

/** |G(3×3)| —— 合法状态总数。 */
export const CUBE3_STATES = '43252003274489856000';

export type GodBinKind = 'exact' | 'approx' | 'atLeast';

export interface GodBin {
  d: number;
  /** 状态数,十进制字符串:d ≥ 14 已超 Number.MAX_SAFE_INTEGER。 */
  count: string;
  kind: GodBinKind;
}

/** cube20.org 公布的原始值。要占比/期望请改用 NORMALIZED。 */
export const GOD_DIST_333: GodBin[] = [
  { d: 0, count: '1', kind: 'exact' },
  { d: 1, count: '18', kind: 'exact' },
  { d: 2, count: '243', kind: 'exact' },
  { d: 3, count: '3240', kind: 'exact' },
  { d: 4, count: '43239', kind: 'exact' },
  { d: 5, count: '574908', kind: 'exact' },
  { d: 6, count: '7618438', kind: 'exact' },
  { d: 7, count: '100803036', kind: 'exact' },
  { d: 8, count: '1332343288', kind: 'exact' },
  { d: 9, count: '17596479795', kind: 'exact' },
  { d: 10, count: '232248063316', kind: 'exact' },
  { d: 11, count: '3063288809012', kind: 'exact' },
  { d: 12, count: '40374425656248', kind: 'exact' },
  { d: 13, count: '531653418284628', kind: 'exact' },
  { d: 14, count: '6989320578825358', kind: 'exact' },
  { d: 15, count: '91365146187124313', kind: 'exact' },
  { d: 16, count: '1100000000000000000', kind: 'approx' },
  { d: 17, count: '12000000000000000000', kind: 'approx' },
  { d: 18, count: '29000000000000000000', kind: 'approx' },
  { d: 19, count: '1500000000000000000', kind: 'approx' },
  { d: 20, count: '490000000', kind: 'atLeast' },
];

/**
 * 展示用的档位标记。**数字本身要用 `GOD_DIST_333[d].count`(cube20.org 原值),不要把
 * `GOD_DIST_333_NORMALIZED` 端到界面上** —— 归一化后的 19 位数字是等比缩放的产物,
 * 写出来就成了新的伪精度。归一化值只用来画条、算占比和期望。
 */
export const GOD_KIND_MARK: Record<GodBinKind, string> = { exact: '', approx: '≈', atLeast: '≥' };

/** 精确档的最深一层。 */
export const GOD_EXACT_THROUGH = 15;

/** 上帝之数 —— 分布的最后一档。 */
export const GOD_NUMBER_HTM = 20;

const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);

/** Σ(d ≤ 15),逐位精确。 */
export const GOD_EXACT_TOTAL: string = sum(
  GOD_DIST_333.filter((b) => b.kind === 'exact').map((b) => BigInt(b.count)),
).toString();

/** |G| − Σ(d ≤ 15) = d ≥ 16 的真实总和。这一条是精确的,尽管逐档值不是。 */
export const GOD_TAIL_TOTAL: string = (
  BigInt(CUBE3_STATES) - BigInt(GOD_EXACT_TOTAL)
).toString();

/**
 * 归一化分布:只动 d=16..19 那四个 `approx`,等比缩到剩余的尾部真值,除不尽的余数塞进最大
 * 的一档(d=18);d ≤ 15 与 d=20 原样保留(d=20 的 4.9 亿在 4.3e19 里可忽略,缩它没有意义,
 * 反而会把「已找到 490,000,000 个」这个明确的数字改花)。Σ 由构造恰等于 |G|。
 */
export const GOD_DIST_333_NORMALIZED: string[] = (() => {
  const raw = GOD_DIST_333.map((b) => BigInt(b.count));
  const est = GOD_DIST_333.map((b, d) => (b.kind === 'approx' ? d : -1)).filter((d) => d >= 0);
  const target = BigInt(GOD_TAIL_TOTAL) - sum(
    GOD_DIST_333.filter((b) => b.kind === 'atLeast').map((b) => BigInt(b.count)),
  );
  const rawEst = sum(est.map((d) => raw[d]));
  const out = [...raw];
  for (const d of est) out[d] = (raw[d] * target) / rawEst;
  const widest = est.reduce((a, b) => (out[a] > out[b] ? a : b));
  out[widest] += target - sum(est.map((d) => out[d]));
  return out.map(String);
})();

/**
 * 归一化分布下,最优解长度落在 [lo, hi] 的随机状态占比(0..1)。
 * 定标到 1e18 再落回 Number —— d=20 那档只有 1.1e-11,定标小了会直接归零。
 */
export function godShare(lo: number, hi: number): number {
  const num = GOD_DIST_333_NORMALIZED.reduce(
    (acc, c, d) => (d >= lo && d <= hi ? acc + BigInt(c) : acc), 0n,
  );
  return Number((num * 10n ** 18n) / BigInt(CUBE3_STATES)) / 1e18;
}

/**
 * 站上反复出现的两句话,别再各处手算:
 *   - 17..19 占 ≈ 97.25%(**不是** 99% —— 那是把 d=16 也算进去才成立);
 *   - 16..19 占 ≈ 99.77%。
 */
export const GOD_SHARE_17_19 = godShare(17, 19);
export const GOD_SHARE_16_19 = godShare(16, 19);

/** 上面两条的展示串('97%' / '99.8%'),正文直接插值,别再各写各的。 */
export const GOD_SHARE_17_19_PCT = `${(GOD_SHARE_17_19 * 100).toFixed(0)}%`;
export const GOD_SHARE_16_19_PCT = `${(GOD_SHARE_16_19 * 100).toFixed(1)}%`;

/**
 * 随机状态的最优步数期望 E[d] ≈ 17.70 HTM。
 *
 * 由归一化分布算出,故 d ≥ 16 那部分继承了 cube20.org 估计值的不确定度 ——
 * 页面上写「≈ 17.7」,别写更多位。
 */
export const GOD_MEAN_HTM: number = (() => {
  const num = GOD_DIST_333_NORMALIZED.reduce(
    (acc, c, d) => acc + BigInt(d) * BigInt(c), 0n,
  );
  return Number((num * 10000n) / BigInt(CUBE3_STATES)) / 10000;
})();
