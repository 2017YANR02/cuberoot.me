// Statistical models for WR prediction
// 主模型: T(t) = L + A · exp(-k · (t - t0))
// 对照: 纯指数, 幂律, Gompertz
// 极值: Gumbel/GEV 反算"N 次独立打乱下的期望最小值"
// 区间: 残差 bootstrap (B=200) 给出 80% 与 95% 预测带

export interface DataPoint {
  year: number;
  time: number; // seconds OR moves (depending on scale)
}

export interface ExpFloorFit {
  kind: 'expfloor';
  L: number;     // floor
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
  const observedMin = Math.min(...data.map((d) => d.time));
  const LmaxEff = Math.min(Lmax, observedMin - 0.05);
  let best: ExpFloorFit | null = null;

  for (let L = Lmin; L <= LmaxEff; L += Lstep) {
    const valid = data.filter((d) => d.time > L + 0.001);
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
    if (slope >= 0) continue;
    const intercept = ybar - slope * xbar;
    const k = -slope;
    const A = Math.exp(intercept);
    const predict = (year: number) => L + A * Math.exp(-k * (year - t0));

    let rss = 0;
    for (const d of data) rss += (d.time - predict(d.year)) ** 2;
    const rmse = Math.sqrt(rss / data.length);
    const ymean = data.reduce((s, d) => s + d.time, 0) / data.length;
    const sst = data.reduce((s, d) => s + (d.time - ymean) ** 2, 0);
    const r2 = 1 - rss / sst;
    const halfLife = Math.log(2) / k;

    if (!best || rss < best.rss) {
      best = { kind: 'expfloor', L, A, k, t0, rss, rmse, r2, halfLife, predict };
    }
  }
  return best;
}

/** 简单指数 T = a · exp(-k t), 无下限 */
export interface ExpFit {
  kind: 'exp';
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
  return { kind: 'exp', a, k, t0, rmse, r2, predict };
}

/** 幂律 T = a · t^(-b) */
export interface PowerFit {
  kind: 'power';
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
  return { kind: 'power', a, b, t0, rmse, r2, predict };
}

/**
 * Gompertz 衰减: T(t) = L + (T0 - L) · exp(-exp(k(t - tm)))
 * 适合"早期突破慢, 中期断崖式快, 晚期慢慢逼近下限"的轨迹。
 * 用网格搜索 L + tm, 解析求 k.
 */
export interface GompertzFit {
  kind: 'gompertz';
  L: number; T0: number; k: number; tm: number; t0: number;
  rmse: number; r2: number;
  predict: (y: number) => number;
}
export function fitGompertz(data: DataPoint[], Lmin = 0, Lmax = 1e6, Lstep = 0.1): GompertzFit | null {
  if (data.length < 5) return null;
  const t0 = data[0].year;
  const observedMin = Math.min(...data.map((d) => d.time));
  const observedMax = Math.max(...data.map((d) => d.time));
  const LmaxEff = Math.min(Lmax, observedMin - 0.05);
  let best: GompertzFit | null = null;
  for (let L = Lmin; L <= LmaxEff; L += Lstep) {
    // T0 = observed max + slight buffer (initial level)
    const T0 = observedMax + 0.5;
    if (T0 <= L) continue;
    // ys = log(-log((T - L) / (T0 - L))) is linear in t
    // for points where (T-L)/(T0-L) is in (0, 1)
    const filtered = data.filter((d) => {
      const r = (d.time - L) / (T0 - L);
      return r > 1e-6 && r < 1 - 1e-6;
    });
    if (filtered.length < 5) continue;
    const xs = filtered.map((d) => d.year - t0);
    const ys = filtered.map((d) => Math.log(-Math.log((d.time - L) / (T0 - L))));
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
    if (slope <= 0) continue;
    const intercept = ybar - slope * xbar;
    const k = slope;
    const tm = -intercept / slope;
    const predict = (y: number) => L + (T0 - L) * Math.exp(-Math.exp(k * (y - t0 - tm)));
    let rss = 0;
    for (const d of data) rss += (d.time - predict(d.year)) ** 2;
    const rmse = Math.sqrt(rss / data.length);
    const ymean = data.reduce((s, d) => s + d.time, 0) / data.length;
    const sst = data.reduce((s, d) => s + (d.time - ymean) ** 2, 0);
    const r2 = 1 - rss / sst;
    if (!best || rss < best.rmse * best.rmse * data.length) {
      best = { kind: 'gompertz', L, T0, k, tm: tm + t0, t0, rmse, r2, predict };
    }
  }
  return best;
}

// ──────────────────────────────────────────────────────────
// Bootstrap residual: 拟合一次 → 计算残差 → 重抽样 → 再拟合 B 次
// 返回每年的 (lo80, hi80, lo95, hi95, median) — 给图表带可视化
// ──────────────────────────────────────────────────────────

export interface ForecastBand {
  year: number;
  median: number;
  lo80: number;
  hi80: number;
  lo95: number;
  hi95: number;
}

export function bootstrapBand(
  data: DataPoint[],
  fitFn: (d: DataPoint[]) => { predict: (y: number) => number } | null,
  futureYears: number[],
  B = 200,
  seed = 42,
): ForecastBand[] | null {
  const baseFit = fitFn(data);
  if (!baseFit) return null;
  const residuals = data.map((d) => d.time - baseFit.predict(d.year));

  // mulberry32 deterministic RNG
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const predsByYear: number[][] = futureYears.map(() => []);
  let ok = 0;
  for (let b = 0; b < B; b++) {
    const resampled: DataPoint[] = data.map((d) => {
      const r = residuals[Math.floor(rand() * residuals.length)];
      return { year: d.year, time: Math.max(d.time + r, 0.001) };
    });
    const fit = fitFn(resampled);
    if (!fit) continue;
    futureYears.forEach((y, i) => predsByYear[i].push(fit.predict(y)));
    ok++;
  }
  if (ok < B / 4) return null;
  return futureYears.map((y, i) => {
    const arr = predsByYear[i].slice().sort((a, b) => a - b);
    const q = (p: number) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(p * arr.length)))];
    return {
      year: y,
      median: q(0.5),
      lo80: q(0.1), hi80: q(0.9),
      lo95: q(0.025), hi95: q(0.975),
    };
  });
}

// ──────────────────────────────────────────────────────────
// 极值理论: 把 WR single 视为 N 次独立尝试的 sample minimum
// 在 Gumbel 假设下 E[min] ≈ μ − σ · √(2 ln N) (足够大 N)
// σ 取顶尖 cuber 单次 SD (默认 0.4 s — Liu/Bibulet 风格)
//
// 已知 (year, cumulative_attempts) 序列, 给出 GEV-implied WR 期望
// ──────────────────────────────────────────────────────────

export interface GevTrace {
  year: number;
  N_cum: number;
  expectedMin: number;
}

/**
 * @param eliteMu      参考 "elite typical single" — 通常 ~ Top-100 PB 的当年水平
 *                     用 toDisplay 之后的秒/步数
 * @param sigma        单次 SD (秒/步) — 顶尖 cuber 同 scramble 同设备多次 SD
 * @param cumAttempts  (year, N) 序列, N = 累计该项目 official 单次解的合计
 */
export function gevExpectedMin(
  eliteMu: number,
  sigma: number,
  cumAttempts: Array<{ year: number; N: number }>,
): GevTrace[] {
  return cumAttempts.map(({ year, N }) => {
    if (N <= 1) return { year, N_cum: N, expectedMin: eliteMu };
    // 把 N 个 normal 取 min → expected ≈ μ - σ · Φ⁻¹(1/N) ≈ μ - σ · √(2 ln N − ln ln N − ln 4π)
    const adj = Math.max(0, 2 * Math.log(N) - Math.log(Math.log(N) + 1e-9) - Math.log(4 * Math.PI));
    const z = Math.sqrt(adj);
    return { year, N_cum: N, expectedMin: Math.max(0, eliteMu - sigma * z) };
  });
}

// ──────────────────────────────────────────────────────────
// 综合: 给一个项目, 跑全套拟合并返回评分 + 集成预测
// ──────────────────────────────────────────────────────────

export interface EnsembleResult {
  expfloor: ExpFloorFit | null;
  exp: ExpFit | null;
  power: PowerFit | null;
  gompertz: GompertzFit | null;
  /** ensemble = R²-weighted mean of valid models for given year */
  ensemble: (year: number) => number | null;
  ensembleFloor: number | null;
  ensembleR2: number;
}

export function ensembleFit(
  data: DataPoint[],
  Lmax = 1000,
  Lstep = 0.1,
): EnsembleResult {
  const expfloor = fitExpFloor(data, 0, Lmax, Lstep);
  const exp = fitExp(data);
  const power = fitPower(data);
  const gompertz = fitGompertz(data, 0, Lmax, Lstep);

  const models = [expfloor, exp, power, gompertz].filter(
    (m): m is NonNullable<typeof m> => m !== null && (m as any).r2 > 0,
  );

  const ensemble = (year: number): number | null => {
    if (models.length === 0) return null;
    let num = 0, den = 0;
    for (const m of models) {
      const w = Math.max(0, (m as any).r2);
      num += w * m.predict(year);
      den += w;
    }
    return den > 0 ? num / den : null;
  };

  const ensembleFloor = expfloor?.L ?? null;
  const ensembleR2 = models.length > 0
    ? models.reduce((s, m) => s + (m as any).r2, 0) / models.length
    : 0;

  return { expfloor, exp, power, gompertz, ensemble, ensembleFloor, ensembleR2 };
}

/**
 * 估算 TPS: 假设顶尖 CFOP solve ~50 STM
 */
export function tpsFromTime(seconds: number, stm = 50): number {
  return stm / seconds;
}

export const THEORETICAL_LIMITS_DEPRECATED = {
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
