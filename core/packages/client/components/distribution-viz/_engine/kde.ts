// NOTE: KDE 计算引擎 + 直方图 + 双峰检测
// 从 viz/viz.js 中提取的纯数学函数，1:1 翻译为 TypeScript

export interface KDEPoint {
  x: number;
  y: number;
}

export interface HistogramBin {
  xStart: number;
  xEnd: number;
  count: number;
  density: number;
}

// ─── KDE 核心 ───

export function gaussianKernel(u: number): number {
  return Math.exp(-0.5 * u * u) * 0.3989422804; // 1/sqrt(2π)
}

/**
 * Silverman 法则估计带宽
 * h = 0.9 * min(σ, IQR/1.34) * n^(-1/5)
 */
export function silvermanBandwidth(data: number[]): number {
  const n = data.length;
  if (n < 2) return 0.3;

  const m = mean(data);
  const s = Math.sqrt(data.reduce((a, v) => a + (v - m) ** 2, 0) / (n - 1));
  const sorted = [...data].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  const spread = Math.min(s, iqr / 1.34);
  // 退化保护：如果数据几乎无变化，使用标准差
  return 0.9 * (spread > 0 ? spread : s) * Math.pow(n, -0.2);
}

export function computeKDE(
  times: number[],
  xMinVal: number,
  xMaxVal: number,
  kdePoints: number = 200,
  minBw: number = 0,
): KDEPoint[] | null {
  if (times.length < 3) return null;

  let h = silvermanBandwidth(times);
  if (h <= 0) return null;
  // Ao100 数据高度自相关，Silverman 会给出极小带宽，强制下限
  if (minBw > 0 && h < minBw) h = minBw;

  const n = times.length;
  const step = (xMaxVal - xMinVal) / (kdePoints - 1);
  const points = new Array<KDEPoint>(kdePoints);

  for (let i = 0; i < kdePoints; i++) {
    const x = xMinVal + i * step;
    let density = 0;
    for (let j = 0; j < n; j++) {
      density += gaussianKernel((x - times[j]) / h);
    }
    points[i] = { x, y: density / (n * h) };
  }
  return points;
}

// ─── 双峰检测 ───

/**
 * NOTE: 扫描 KDE 曲线找出显著的局部极大值（峰）
 * 返回 [{ x, y }]，过滤掉低于最高峰 15% 的噪声
 */
export function detectPeaks(kde: KDEPoint[]): KDEPoint[] {
  if (!kde || kde.length < 3) return [];
  const raw: KDEPoint[] = [];
  for (let i = 1; i < kde.length - 1; i++) {
    if (kde[i].y > kde[i - 1].y && kde[i].y > kde[i + 1].y) {
      raw.push({ x: kde[i].x, y: kde[i].y });
    }
  }
  if (raw.length === 0) return [];
  const maxY = Math.max(...raw.map(p => p.y));
  return raw.filter(p => p.y >= maxY * 0.15);
}

// ─── 直方图 ───

/**
 * NOTE: Freedman-Diaconis 规则计算直方图 bins
 * 返回 [{ xStart, xEnd, count, density }]
 * density = count / (n × binWidth)，用于和 KDE 叠加时共享 Y 轴
 */
export function computeHistogram(times: number[], viewRange?: number): HistogramBin[] {
  if (!times || times.length < 2) return [];
  const sorted = [...times].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  // Freedman-Diaconis bin 宽度，兜底 5~30 bins
  let binWidth = 2 * iqr * Math.pow(n, -1 / 3);
  const range = sorted[n - 1] - sorted[0];
  if (binWidth <= 0 || range / binWidth > 30) binWidth = range / 30;
  if (range / binWidth < 5) binWidth = range / 5;
  if (binWidth <= 0) binWidth = 0.1;

  // NOTE: 放大时基于可见范围缩小 bin 宽度（目标 ~20 个可见 bin）
  if (viewRange && viewRange > 0 && viewRange < range) {
    const zoomedBinWidth = viewRange / 20;
    // 选择美观步长（对齐到 0.05, 0.1, 0.2, 0.5 等）
    binWidth = pickNiceStep(zoomedBinWidth);
  }

  const bins: HistogramBin[] = [];
  const start = sorted[0] - binWidth * 0.5;
  const numBins = Math.ceil((sorted[n - 1] - start) / binWidth) + 1;
  for (let i = 0; i < numBins; i++) {
    bins.push({ xStart: start + i * binWidth, xEnd: start + (i + 1) * binWidth, count: 0, density: 0 });
  }
  for (const t of times) {
    const idx = Math.min(Math.floor((t - start) / binWidth), bins.length - 1);
    if (idx >= 0) bins[idx].count++;
  }
  // 归一化为密度（和 KDE 兼容）
  for (const b of bins) {
    b.density = b.count / (n * binWidth);
  }
  return bins;
}

// ─── 工具函数 ───

/**
 * NOTE: 自适应刻度步长选择
 * 从 [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, ...] 序列中
 * 选择最接近 rawStep 的"美观"步长
 */
export function pickNiceStep(rawStep: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const r = rawStep / mag;  // r 在 [1, 10) 区间
  const nice = r <= 1.5 ? 1 : r <= 3.5 ? 2 : r <= 7.5 ? 5 : 10;
  return nice * mag;
}

export function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stddev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, v) => a + (v - m) ** 2, 0) / (arr.length - 1));
}

export function maxOfKDE(kde: KDEPoint[] | null): number {
  if (!kde) return 0;
  let max = 0;
  for (const p of kde) {
    if (p.y > max) max = p.y;
  }
  return max;
}
