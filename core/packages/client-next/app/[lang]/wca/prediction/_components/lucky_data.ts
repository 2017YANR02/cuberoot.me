/**
 * lucky_data — 各项目的 "lucky-scramble floor" 数据
 *
 * 核心思想:
 *   1. 每个魔方拥有固定的状态空间 |S| 和深度分布 N(d) = 步数恰好为 d 的状态数量.
 *   2. WCA 每年累计生成 N_total(Y) 个 scramble (含备用), 每个独立均匀采样.
 *   3. 在 N_total 次独立采样中, 出现至少一个 d ≤ k 状态的期望次数 = N_total · ∑_{i≤k} N(i) / |S|.
 *      期望最小深度 = argmin k 使该期望 ≥ 1.
 *   4. 单次成绩下界 = max(k, k_min_WCA) / TPS_ceil + R (识别+收尾常数).
 *
 * 当 Y → ∞:
 *   3x3 的最小 WCA 接受深度 k_min = 2 (规则禁止 0/1 步可解 scramble),
 *   所以单次极限 = 2 / TPS_ceil + R.
 *
 * 数据来源:
 *   - 3x3 深度分布 d=0..15 精确, d=16..20 估计 (cube20.org, Rokicki 2010).
 *   - 2x2 深度分布 (HTM) 完整 (Korf, Pochmann).
 *   - Pyraminx / Skewb 深度分布 (HTM, modulo tips) 精确 (puzzle wiki).
 *   - 4x4+ / 大魔方 / Megaminx / Sq1 / Clock God's number 未知, 用峰值集中假设近似.
 *   - WCA 比赛数 / 年 来自 WCA results dump 趋势 (2003-2025).
 */

/** 每个深度 d 上的状态数. 长度 = 1 + God's number. */
export interface DepthDist {
  /** counts[d] = 步数恰为 d 的状态数, 用 number (科学计数). */
  counts: number[];
  /** 状态总数 |S| (counts 之和, 显式给避免浮点误差). */
  total: number;
  /** WCA scramble 接受的最小 optimal-solve 步数 (规则下限). */
  k_min_wca: number;
  /** God's number (HTM 或最自然的 metric, 用于显示和拟合). */
  diameter: number;
  /** 数据置信: 'exact' = 完整精确, 'partial' = 低深度精确高深度估计, 'approx' = 仅基于状态总数的近似. */
  source: 'exact' | 'partial' | 'approx';
}

/**
 * 3x3 (HTM, half-turn metric). 状态总数 ≈ 4.3252 × 10^19.
 *   d=0..15: cube20.org / Rokicki 精确枚举.
 *   d=16..20: cube20.org 估计 (Reid / Kunkle / Rokicki).
 */
export const D_333: DepthDist = {
  counts: [
    1,
    18,
    243,
    3_240,
    43_239,
    574_908,
    7_618_438,
    100_803_036,
    1_332_343_288,
    17_596_479_795,
    232_248_063_316,
    3_063_288_809_012,
    40_374_425_656_248,
    531_653_418_284_628,
    6_989_320_578_825_358,
    // d=15 = 91,365,146,187,124,313 (超过 Number.MAX_SAFE_INTEGER, 用 float 表达)
    9.136514618712431e16,
    // d=16..20 估计
    1.1e18,
    1.21e19,
    2.91e19,
    1.5e18,
    4.9e8,
  ],
  total: 4.3252003274489856e19,
  k_min_wca: 2,
  diameter: 20,
  source: 'partial',
};

/**
 * 2x2 (HTM). 状态总数 = 3,674,160. God's number = 11.
 *   Korf / Pochmann 完整枚举.
 */
export const D_222: DepthDist = {
  counts: [1, 9, 54, 321, 1_847, 9_992, 50_136, 227_536, 870_072, 1_887_748, 623_800, 2_644],
  total: 3_674_160,
  k_min_wca: 1,
  diameter: 11,
  source: 'exact',
};

/**
 * Pyraminx (modulo 4 tip rotations). 状态总数 = 933,120. God's number = 11 (axial metric).
 *   注: 加上 81 种 tip 朝向, "完整" 状态空间 ≈ 7.5 × 10^7.
 */
export const D_PYRAM: DepthDist = {
  counts: [1, 8, 48, 288, 1_728, 9_896, 51_808, 220_111, 480_467, 166_276, 2_457, 32],
  total: 933_120,
  k_min_wca: 1,
  diameter: 11,
  source: 'exact',
};

/**
 * Skewb. 状态总数 = 3,149,280. God's number = 11.
 *   Jaap Scherphuis 精确枚举.
 */
export const D_SKEWB: DepthDist = {
  counts: [1, 8, 48, 288, 1_728, 9_896, 55_176, 260_208, 833_835, 1_382_404, 600_865, 4_823],
  total: 3_149_280,
  k_min_wca: 1,
  diameter: 11,
  source: 'exact',
};

/**
 * Square-1 (without parity / shape solving). 状态总数 ≈ 6.2 × 10^9. God's number ~17 (估计).
 *   未公开精确分布, 用 "峰值集中" 近似: 大多数状态在 13-17 之间.
 *   approxFromTotal 给一个合理峰型分布.
 */
export const D_SQ1: DepthDist = makePeakApprox(6_156_259_250, 14, 17, 1);

/**
 * Megaminx. 状态总数 ≈ 1.01 × 10^68. God's number ~45 (估计, unsolved).
 */
export const D_MINX: DepthDist = makePeakApprox(1.0e68, 40, 50, 1);

/**
 * Clock. 状态总数 = 12^14 ≈ 1.28 × 10^15. God's number 12 (Jaap Scherphuis).
 *   不完整分布, 用近似.
 */
export const D_CLOCK: DepthDist = makePeakApprox(1.284e15, 10, 12, 1);

/**
 * 4x4. 状态总数 ≈ 7.40 × 10^45. God's number 未知 (估计 ~36 STM).
 */
export const D_444: DepthDist = makePeakApprox(7.4e45, 32, 36, 1);

/**
 * 5x5. 状态总数 ≈ 2.83 × 10^74. God's number 估计 ~50 STM.
 */
export const D_555: DepthDist = makePeakApprox(2.83e74, 45, 52, 1);

/**
 * 6x6. 状态总数 ≈ 1.57 × 10^116. God's number 估计 ~70 STM.
 */
export const D_666: DepthDist = makePeakApprox(1.57e116, 65, 75, 1);

/**
 * 7x7. 状态总数 ≈ 1.95 × 10^160. God's number 估计 ~95 STM.
 */
export const D_777: DepthDist = makePeakApprox(1.95e160, 88, 100, 1);

/**
 * makePeakApprox — 给只知道状态总数和大约 God's number 的 puzzle 构造一个近似分布.
 *
 * 假设大多数状态集中在 God's number 附近, 低深度的状态数按几何衰减:
 *   N(d) ≈ N(G) · branching^(d - G), d ≤ G
 *   N(G) ≈ total / 2 (峰值约占一半)
 *
 * 这只是数量级近似, 用于在 UI 上给非 Tier-1 项目一个合理曲线.
 */
function makePeakApprox(total: number, kMin: number, godNum: number, kMinWCA: number): DepthDist {
  const counts: number[] = new Array(godNum + 1).fill(0);
  counts[0] = 1;
  // 几何衰减: 每减 1 步, 状态数减 ~b 倍 (b ≈ 13 for 3x3, scaling roughly with face moves)
  const branching = 13;
  // 设峰值 = N(godNum) = total / 2
  let peak = total / 2;
  counts[godNum] = peak;
  // 反向衰减
  for (let d = godNum - 1; d >= 1; d--) {
    peak /= branching;
    counts[d] = Math.max(peak, counts[d + 1] / branching / 10);
  }
  // 截断到 kMin 以下 (实际不可能存在)
  // 用 0 填补深度 0 和 1 之间的虚假"快速可解"状态, 但保留 kMin
  for (let d = 1; d < kMin; d++) counts[d] = Math.max(counts[d], 1); // 至少 1 个
  return { counts, total, k_min_wca: kMinWCA, diameter: godNum, source: 'approx' };
}

/* ============================================================
 * 物理参数: TPS_ceil + 识别延迟 + WCA scrambler 限制
 * ============================================================ */

export interface EventLucky {
  /** 与 events.ts 中的 id 一致. */
  id: string;
  /** 深度分布. */
  dist: DepthDist;
  /** 顶级 cuber 当前持续 TPS (used as floor — 当前真实可达). */
  tps_now: number;
  /** 物理上界 TPS (击鼓 / 手指敲击生理上限, 约 22 Hz 双手 ≈ 11 TPS/手). */
  tps_ceil: number;
  /** 收尾 + 识别 + StackMat 触发等常数残差 (秒). */
  setup_s: number;
  /** 该项目 scrambles_per_comp 系数 (相对 333=1.0). */
  scramble_share: number;
  /** display: 与 events.ts 的 id 区分非 Tier-1 项目, 单位标注. */
  notes_zh?: string;
  notes_en?: string;
  notes_zhHant?: string;
}

export const LUCKY_EVENTS: Record<string, EventLucky> = {
  '333':   { id: '333',   dist: D_333,   tps_now: 14.6, tps_ceil: 17,  setup_s: 0.15, scramble_share: 1.00 },
  '222':   { id: '222',   dist: D_222,   tps_now: 12,   tps_ceil: 16,  setup_s: 0.10, scramble_share: 0.85 },
  '444':   { id: '444',   dist: D_444,   tps_now: 9.5,  tps_ceil: 12,  setup_s: 0.80, scramble_share: 0.70, notes_zh: '深度分布为近似', notes_en: 'depth distribution approximated', notes_zhHant: '深度分佈為近似' },
  '555':   { id: '555',   dist: D_555,   tps_now: 8.5,  tps_ceil: 11,  setup_s: 1.20, scramble_share: 0.55, notes_zh: '深度分布为近似', notes_en: 'depth distribution approximated', notes_zhHant: '深度分佈為近似' },
  '666':   { id: '666',   dist: D_666,   tps_now: 6.5,  tps_ceil: 9,   setup_s: 1.50, scramble_share: 0.25, notes_zh: '深度分布为近似', notes_en: 'depth distribution approximated', notes_zhHant: '深度分佈為近似' },
  '777':   { id: '777',   dist: D_777,   tps_now: 5.5,  tps_ceil: 8,   setup_s: 2.00, scramble_share: 0.20, notes_zh: '深度分布为近似', notes_en: 'depth distribution approximated', notes_zhHant: '深度分佈為近似' },
  '333oh': { id: '333oh', dist: D_333,   tps_now: 7.5,  tps_ceil: 10,  setup_s: 0.20, scramble_share: 0.40 },
  'clock': { id: 'clock', dist: D_CLOCK, tps_now: 9,    tps_ceil: 13,  setup_s: 0.15, scramble_share: 0.25, notes_zh: '深度分布为近似', notes_en: 'depth distribution approximated', notes_zhHant: '深度分佈為近似' },
  'minx':  { id: 'minx',  dist: D_MINX,  tps_now: 7,    tps_ceil: 10,  setup_s: 1.50, scramble_share: 0.18, notes_zh: '深度分布为近似', notes_en: 'depth distribution approximated', notes_zhHant: '深度分佈為近似' },
  'pyram': { id: 'pyram', dist: D_PYRAM, tps_now: 9,    tps_ceil: 13,  setup_s: 0.10, scramble_share: 0.55 },
  'skewb': { id: 'skewb', dist: D_SKEWB, tps_now: 10,   tps_ceil: 13,  setup_s: 0.10, scramble_share: 0.40 },
  'sq1':   { id: 'sq1',   dist: D_SQ1,   tps_now: 6,    tps_ceil: 10,  setup_s: 0.30, scramble_share: 0.28, notes_zh: '深度分布为近似', notes_en: 'depth distribution approximated', notes_zhHant: '深度分佈為近似' },
};

/* ============================================================
 * 比赛 / scramble 数模型
 * ============================================================ */

/**
 * 历年 WCA 比赛数 (官方 WCA dump, 2003-2025).
 * 2003-2025 实测, 2026+ 用线性外推 + 增长率 5% / 年.
 */
export const COMPS_PER_YEAR: { [year: number]: number } = {
  2003: 5,    2004: 13,   2005: 28,   2006: 30,   2007: 48,
  2008: 81,   2009: 142,  2010: 178,  2011: 281,  2012: 391,
  2013: 506,  2014: 612,  2015: 866,  2016: 1063, 2017: 1272,
  2018: 1549, 2019: 2069, 2020: 215,  2021: 707,  2022: 2470,
  2023: 3617, 2024: 4400, 2025: 5100, 2026: 5800,
};

/**
 * 给定年份, 返回当年的比赛数 (≥2026 用 5% 复合增长外推, 但封顶在 30000).
 */
export function compsInYear(year: number): number {
  if (year < 2003) return 0;
  if (COMPS_PER_YEAR[year]) return COMPS_PER_YEAR[year];
  if (year <= 2026) return COMPS_PER_YEAR[year] ?? 0;
  // 2027+ 线性 5% 增长直至 2080, 之后封顶
  const startCount = COMPS_PER_YEAR[2026];
  const yearsPast = year - 2026;
  const cap = 30_000;
  const projected = startCount * Math.pow(1.05, Math.min(yearsPast, 60));
  return Math.min(projected, cap);
}

/**
 * 给定项目 + 年份, 估算当年该项目 scramble 总数 (含备用).
 *
 * 单场比赛 3x3 平均生成 scramble 数:
 *   - ~5 轮 × ~7 scrambles/group × ~6 groups = 210 scrambles per comp
 *   - 当 comp 平均规模随时间增长, 这个数也涨; 2026 估计 ~250.
 * 其他项目按 scramble_share 折算.
 */
export function scramblesInYear(eventId: string, year: number): number {
  const lucky = LUCKY_EVENTS[eventId];
  if (!lucky) return 0;
  const comps = compsInYear(year);
  // Per-comp 3x3 scramble 数 (含备用), 随年缓慢增长
  // 2003: ~30 (1-2 rounds, small comps), 2026: ~250
  let perComp333: number;
  if (year <= 2003) perComp333 = 30;
  else if (year >= 2026) perComp333 = 250 + (year - 2026) * 2; // 缓涨 +2/年
  else perComp333 = 30 + (year - 2003) * (250 - 30) / (2026 - 2003);
  return comps * perComp333 * lucky.scramble_share;
}

/**
 * 累计 scramble 数从 2003 到 Y (含 Y 当年).
 *
 * 性能关键: slider 拖到 10^15 年时, 不能用 for 循环 (会死锁主线程).
 * 实现: 预计算到 2003..CUM_END_YEAR (148 项), 之后用解析二次多项式延拓.
 *
 * 2080+ comps 已封顶 30,000, perComp(y) = 250 + 2(y-2026) 仍线性递增,
 * ∫_{T0..Y} 30000 · share · (250 + 2(y-2026)) dy =
 *   30000 · share · [250 · (Y-T0) + (Y-2026)² - (T0-2026)²]
 */
const CUM_END_YEAR = 2150;
const _CUM_CACHE = new Map<string, number[]>();

function _buildCumTable(eventId: string): number[] {
  const arr: number[] = [];
  let s = 0;
  for (let y = 2003; y <= CUM_END_YEAR; y++) {
    s += scramblesInYear(eventId, y);
    arr.push(s);
  }
  return arr;
}

export function cumScrambles(eventId: string, year: number): number {
  if (year < 2003) return 0;
  const lucky = LUCKY_EVENTS[eventId];
  if (!lucky) return 0;
  let arr = _CUM_CACHE.get(eventId);
  if (!arr) {
    arr = _buildCumTable(eventId);
    _CUM_CACHE.set(eventId, arr);
  }
  const yIdx = Math.floor(year) - 2003;
  if (yIdx < arr.length) {
    return arr[Math.max(0, yIdx)];
  }
  // year > CUM_END_YEAR — 解析二次延拓
  const cumAtEnd = arr[arr.length - 1];
  const share = lucky.scramble_share;
  const T0 = CUM_END_YEAR;
  // ∫ 30000 · share · perComp(y) dy, perComp(y) = 250 + 2·(y - 2026)
  const integralLinear = (yEnd: number): number => {
    const span = yEnd - T0;
    // perComp at T0 = 250 + 2·(2150-2026) = 498
    // ∫ (498 + 2·(y - T0)) dy from T0..yEnd = 498·span + span²
    return 30000 * share * (498 * span + span * span);
  };
  return cumAtEnd + integralLinear(year);
}

/* ============================================================
 * 核心计算: 累积概率 + 期望最小步数
 * ============================================================ */

/**
 * 累积"至少撞上一次 d ≤ k 状态"的概率.
 *
 * P(min ≤ k in N samples) = 1 - (1 - p_le_k)^N
 *
 * 其中 p_le_k = ∑_{i≤k} N(i) / |S|.
 *
 * 用 log1p(-p) 防 p 极小时的 underflow:
 *   (1-p)^N = exp(N · log1p(-p))
 *   → P = -expm1(N · log1p(-p)) = 1 - exp(N · log1p(-p))
 *
 * 当 N · p << 1 时 P ≈ N · p (单次稀释概率).
 * 当 N · p >> 1 时 P → 1.
 */
export function pHitLeqK(dist: DepthDist, N: number, k: number): number {
  if (N <= 0 || k < 0) return 0;
  if (k >= dist.diameter) return 1;
  let cum = 0;
  for (let i = 0; i <= k; i++) cum += (dist.counts[i] ?? 0);
  const p = cum / dist.total;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  // P = 1 - (1-p)^N = -expm1(N · log1p(-p))
  return -Math.expm1(N * Math.log1p(-p));
}

/**
 * 单次抽中 d ≤ k 状态的概率 (与 N 无关).
 */
export function pSingleLeqK(dist: DepthDist, k: number): number {
  if (k < 0) return 0;
  if (k >= dist.diameter) return 1;
  let cum = 0;
  for (let i = 0; i <= k; i++) cum += (dist.counts[i] ?? 0);
  return cum / dist.total;
}

/**
 * 严格期望最小深度 E[min depth in N samples].
 *
 * E[min] = ∑_{k=0}^{G} k · (P(min ≤ k) - P(min ≤ k-1))
 *        = ∑_{k=0}^{G-1} P(min > k)
 *        = ∑_{k=0}^{G-1} (1 - P(min ≤ k))
 *
 * 几何上是"累积超出概率"的 area under curve, 收敛到 G 当 N → 0,
 * 收敛到 0 (但被 k_min_wca 截断) 当 N → ∞.
 */
export function expectedLuckyDepth(dist: DepthDist, N: number): number {
  if (N <= 0) return dist.diameter;
  // E[min] = sum_{k=0..G-1} (1 - P(min ≤ k))
  // 我们的"撞上 ≤ k"已经包括 d=0 (solved); 但 WCA 不接受 d < k_min_wca,
  // 所以累加从 k = k_min_wca - 1 起 (P(min > k_min_wca - 1) 起头),
  // 再加 k_min_wca 的"底层项".
  let E = 0;
  for (let k = 0; k < dist.diameter; k++) {
    const pLeK = pHitLeqK(dist, N, k);
    E += 1 - pLeK;
  }
  // E 现在是无 WCA 下限时的严格 E[min].
  // WCA 不接受 d < k_min_wca 的 scramble (re-roll), 所以实际期望 = max(E, k_min_wca).
  return Math.max(E, dist.k_min_wca);
}

/**
 * 给定 d 阈值 K, 返回累积到 P(撞上至少一次 d ≤ K) 达到目标概率 (默认 0.5) 所需的 N.
 */
export function nForProbability(dist: DepthDist, k: number, targetP = 0.5): number {
  const p = pSingleLeqK(dist, k);
  if (p <= 0) return Infinity;
  if (p >= 1) return 1;
  // 1 - (1-p)^N = targetP → N = log(1 - targetP) / log(1 - p)
  return Math.log(1 - targetP) / Math.log1p(-p);
}

/**
 * 给定项目 + 年份, 算"运气极限"成绩 (秒).
 * 公式: T(Y) = depth(Y) / TPS_ceil + setup_s, 但 depth ≥ k_min_wca.
 */
export function luckyTime(eventId: string, year: number): {
  depth: number;
  N: number;
  time_s: number;
} | null {
  const lucky = LUCKY_EVENTS[eventId];
  if (!lucky) return null;
  const N = cumScrambles(eventId, year);
  const depth = expectedLuckyDepth(lucky.dist, N);
  const time_s = depth / lucky.tps_ceil + lucky.setup_s;
  return { depth, N, time_s };
}

/**
 * 同上但给"现在的 TPS" (不是物理 ceil) — 更接近"今天有 cuber 能做到的运气底"
 */
export function luckyTimeAtCurrentTps(eventId: string, year: number): {
  depth: number;
  N: number;
  time_s: number;
} | null {
  const lucky = LUCKY_EVENTS[eventId];
  if (!lucky) return null;
  const N = cumScrambles(eventId, year);
  const depth = expectedLuckyDepth(lucky.dist, N);
  const time_s = depth / lucky.tps_now + lucky.setup_s;
  return { depth, N, time_s };
}

/* ============================================================
 * Year slider mapping — 让滑条覆盖 2003 → 2100 → 10^17 年
 * ============================================================ */

/**
 * 滑条值 s ∈ [0, 1] → 年份.
 * 0..0.4: 线性 2003..2100 (近期细节)
 * 0.4..1.0: log10 从 2100 (years_after = 0) → 2100 + 10^15 (years_after = 1e15)
 */
export function sliderToYear(s: number): number {
  const clamped = Math.max(0, Math.min(1, s));
  if (clamped <= 0.4) {
    return 2003 + (clamped / 0.4) * 97; // 2003..2100
  }
  const logT = (clamped - 0.4) / 0.6 * 15; // 0..15
  return 2100 + Math.pow(10, logT) - 1;
}

/**
 * 年份 → 滑条值 (反函数, 用于 URL state).
 */
export function yearToSlider(year: number): number {
  if (year <= 2100) return Math.max(0, (year - 2003) / 97 * 0.4);
  const yearsAfter = year - 2100 + 1;
  const logT = Math.log10(yearsAfter);
  return Math.min(1, 0.4 + logT / 15 * 0.6);
}

/**
 * 友好格式化年份 (超大数用科学计数).
 */
export function formatYear(year: number): string {
  if (year < 1e4) return Math.round(year).toString();
  if (year < 1e6) return Math.round(year).toLocaleString();
  // 大数用 10^N
  const exp = Math.floor(Math.log10(year));
  const mant = year / Math.pow(10, exp);
  return `${mant.toFixed(1)}×10^${exp}`;
}

/**
 * 友好格式化大数 N (scramble 数).
 */
export function formatBigN(n: number): string {
  if (!isFinite(n) || n <= 0) return '0';
  if (n < 1e6) return Math.round(n).toLocaleString();
  if (n < 1e9) return (n / 1e6).toFixed(2) + 'M';
  if (n < 1e12) return (n / 1e9).toFixed(2) + 'B';
  const exp = Math.floor(Math.log10(n));
  const mant = n / Math.pow(10, exp);
  return `${mant.toFixed(2)}×10^${exp}`;
}
