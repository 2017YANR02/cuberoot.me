// Statistical models for 3x3 WR prediction
// 模型：T(t) = L + A · exp(-k · (t - t0))
// L = 渐近下限（理论极限秒数），A = 初始与极限差值，k = 衰减率

export interface DataPoint {
  year: number;
  time: number; // seconds
}

export interface ExpFloorFit {
  L: number;     // floor (s)
  A: number;     // amplitude
  k: number;     // decay rate per year
  t0: number;    // reference year
  rss: number;   // residual sum of squares
  rmse: number;  // root mean squared error
  r2: number;    // R² (original scale)
  halfLife: number; // years to halve gap to floor
  predict: (year: number) => number;
}

/**
 * 在 [Lmin, Lmax] 网格上搜索最佳极限 L,
 * 对每个 L 用对数线性回归拟合 (A, k),
 * 选 RSS 最小的 L 为最佳模型
 */
export function fitExpFloor(
  data: DataPoint[],
  Lmin = 0,
  Lmax = 3.5,
  Lstep = 0.02,
): ExpFloorFit | null {
  if (data.length < 4) return null;
  const t0 = data[0].year;
  // 物理约束: L 必须 < 所有观测值, 不然成"已突破极限"
  const observedMin = Math.min(...data.map((d) => d.time));
  const LmaxEff = Math.min(Lmax, observedMin - 0.05);
  let best: ExpFloorFit | null = null;

  for (let L = Lmin; L <= LmaxEff; L += Lstep) {
    const valid = data.filter((d) => d.time > L + 0.001);
    // 全部数据都得参与拟合, 否则等于"丢掉不合身的点"
    if (valid.length < data.length) continue;
    const xs = valid.map((d) => d.year - t0);
    const ys = valid.map((d) => Math.log(d.time - L));
    const n = xs.length;
    const xbar = xs.reduce((a, b) => a + b, 0) / n;
    const ybar = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xbar) * (ys[i] - ybar);
      den += (xs[i] - xbar) ** 2;
    }
    if (den === 0) continue;
    const slope = num / den;
    if (slope >= 0) continue; // 必须衰减
    const intercept = ybar - slope * xbar;
    const k = -slope;
    const A = Math.exp(intercept);
    const predict = (year: number) => L + A * Math.exp(-k * (year - t0));

    let rss = 0;
    for (const d of data) {
      rss += (d.time - predict(d.year)) ** 2;
    }
    const rmse = Math.sqrt(rss / data.length);
    const ymean = data.reduce((s, d) => s + d.time, 0) / data.length;
    const sst = data.reduce((s, d) => s + (d.time - ymean) ** 2, 0);
    const r2 = 1 - rss / sst;
    const halfLife = Math.log(2) / k;

    if (!best || rss < best.rss) {
      best = { L, A, k, t0, rss, rmse, r2, halfLife, predict };
    }
  }
  return best;
}

/**
 * 简单指数衰减（无极限,T → 0）作为对照模型
 * log T = log a - k t
 */
export interface ExpFit {
  a: number; k: number; t0: number;
  rmse: number; r2: number;
  predict: (y: number) => number;
}
export function fitExp(data: DataPoint[]): ExpFit | null {
  if (data.length < 3) return null;
  const t0 = data[0].year;
  const xs = data.map((d) => d.year - t0);
  const ys = data.map((d) => Math.log(d.time));
  const n = xs.length;
  const xbar = xs.reduce((a, b) => a + b, 0) / n;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xbar) * (ys[i] - ybar);
    den += (xs[i] - xbar) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = ybar - slope * xbar;
  const a = Math.exp(intercept);
  const k = -slope;
  const predict = (y: number) => a * Math.exp(-k * (y - t0));
  let rss = 0;
  for (const d of data) rss += (d.time - predict(d.year)) ** 2;
  const rmse = Math.sqrt(rss / n);
  const ymean = data.reduce((s, d) => s + d.time, 0) / n;
  const sst = data.reduce((s, d) => s + (d.time - ymean) ** 2, 0);
  const r2 = 1 - rss / sst;
  return { a, k, t0, rmse, r2, predict };
}

/**
 * 幂律衰减: T = a · t^(-b)
 */
export interface PowerFit {
  a: number; b: number; t0: number;
  rmse: number; r2: number;
  predict: (y: number) => number;
}
export function fitPower(data: DataPoint[]): PowerFit | null {
  if (data.length < 3) return null;
  const t0 = data[0].year - 1;
  const xs = data.map((d) => Math.log(d.year - t0));
  const ys = data.map((d) => Math.log(d.time));
  const n = xs.length;
  const xbar = xs.reduce((a, b) => a + b, 0) / n;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xbar) * (ys[i] - ybar);
    den += (xs[i] - xbar) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = ybar - slope * xbar;
  const a = Math.exp(intercept);
  const b = -slope;
  const predict = (y: number) => a * Math.pow(y - t0, -b);
  let rss = 0;
  for (const d of data) rss += (d.time - predict(d.year)) ** 2;
  const rmse = Math.sqrt(rss / n);
  const ymean = data.reduce((s, d) => s + d.time, 0) / n;
  const sst = data.reduce((s, d) => s + (d.time - ymean) ** 2, 0);
  const r2 = 1 - rss / sst;
  return { a, b, t0, rmse, r2, predict };
}

/**
 * 估算 TPS: 假设顶尖 CFOP solve ~50 STM
 * TPS_top(t) = 50 / WR_single(t)
 */
export function tpsFromTime(seconds: number, stm = 50): number {
  return stm / seconds;
}

/**
 * 当年 WR 之外的"理论速度上限":
 * Cognitive limit: 人手运动周期 ≈ 50–80 ms/move (Hick's law + biomech)
 * → 12–20 TPS sustained, 25 TPS peak
 * Solve length floor: God's number = 20 (HTM), 但 human optimal ~35 STM
 *
 * 综合理论极限:
 *   Optimistic: 40 STM @ 20 TPS = 2.0 s
 *   Realistic:  50 STM @ 18 TPS = 2.78 s (含 inspection 转 execution 切换)
 *   Conservative: 55 STM @ 15 TPS = 3.67 s
 */
export const THEORETICAL_LIMITS = {
  optimistic: 2.0,
  realistic: 2.78,
  conservative: 3.67,
} as const;

/**
 * 从 fit 模型外推到给定年份
 */
export function forecast(
  fit: ExpFloorFit,
  years: number[],
): { year: number; predicted: number }[] {
  return years.map((y) => ({ year: y, predicted: fit.predict(y) }));
}

/**
 * 计算"何时能达到 X 秒"
 * 解 X = L + A · exp(-k(t-t0)) 得 t = t0 + log(A/(X-L))/k
 * 若 X ≤ L 则永远达不到 (返回 Infinity)
 */
export function yearReachingTime(fit: ExpFloorFit, target: number): number {
  if (target <= fit.L) return Infinity;
  const dy = Math.log(fit.A / (target - fit.L)) / fit.k;
  return fit.t0 + dy;
}
