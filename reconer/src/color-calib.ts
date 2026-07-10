/**
 * color-calib.ts — 每视频颜色自标定 (标签层替换, 不动检测层)。
 *
 * 动机: classifyPixel 固定 HSV 阈值在各视频白平衡/曝光下系统性偏移
 * (混淆矩阵: W 仅 16% 命中, 各色→O 大片糊), 逐格精度 60% 卡在噪声悬崖
 * (锚定需 ≥75%) 下方。打乱态 (观察期帧) 与复原态 (收尾帧) 是**已知**的,
 * 可反标出本视频的 像素特征→真色 映射, 免任何人工标注。
 *
 * 特征空间: (a, b, v) = (s·cos 2h°, s·sin 2h°, v) — 色度盘 + 亮度。
 * 色相是圆量, 直接用 h 会在红色跨 0 处断裂; 色度盘天然处理, 且白色
 * (低饱和) 自然落在盘心, 不需要单独的 s 阈值分支。
 * 分类: 逐类对角高斯 (median 中心 + MAD 尺度) 最近类, 马氏距离超阈拒判
 * (皮肤/阴影/混合块 → null, 沿用"不可读"语义)。
 */
import { rgbToHsvCv } from "./bface-color.ts";
import type { ColorName } from "./reconstruct.ts";

export interface ClassStats {
  n: number;
  /** 中心 (a, b, v) */
  ca: number;
  cb: number;
  cv: number;
  /** 逐维尺度 (MAD×1.4826, 有下限) */
  sa: number;
  sb: number;
  sv: number;
  /** true = 无样本, 由全局色相偏移从 canonical 合成 (宽尺度) */
  synth: boolean;
}

export interface ColorCalib {
  classes: Record<ColorName, ClassStats>;
  /** 归一化平方距离拒判阈 (χ²₃ 量级) */
  rejectD2: number;
  /** 可选 kNN 分类器 (Lab 特征): 在场时 calibClassify 优先走它。逐类对角高斯在本
   * 数据上样本内仅 ~55% (曲香蕉状类 + 极不平衡拖垮参数模型), 同批格 kNN-LOO 74%
   * (欠债 ~19 点)。倒推解码器不需过 75% 锚定悬崖, 更准即纯增益 (见 CLAUDE.md 正⑭)。 */
  knn?: ColorKnn;
}

/** kNN 颜色分类器: 预缩放 Lab 特征 + 标签, 每类上限采样 (顺带压不平衡) */
export interface ColorKnn {
  /** 已按 scale 预缩放的 Lab 特征 (查询时也缩放) */
  feats: [number, number, number][];
  labels: ColorName[];
  scale: [number, number, number];
  k: number;
  /** 最近邻缩放平方距离超此判拒 (皮肤/遮挡外点) */
  rejectD2: number;
}

export interface ColorSample {
  r: number;
  g: number;
  b: number;
  label: ColorName;
  /** 同一 3×3 观测的分组 id (每帧每网格一组; 供每观测增益拟合实验) */
  obs?: number;
}

/** 类顺序与 anchored-search COLOR_CODE (W R G Y O B) 对齐, 供软概率向量共用 */
export const COLOR_LIST: readonly ColorName[] = ["W", "R", "G", "Y", "O", "B"];

/** canonical 中心 (OpenCV h∈[0,180)): 现有固定阈值的带中心, 无样本类的合成基底 */
const CANONICAL: Record<ColorName, { h: number; s: number; v: number }> = {
  W: { h: 0, s: 12, v: 225 },
  R: { h: 2, s: 190, v: 190 },
  O: { h: 14, s: 200, v: 210 },
  Y: { h: 30, s: 190, v: 215 },
  G: { h: 60, s: 190, v: 180 },
  B: { h: 112, s: 200, v: 170 },
};

export function rgbFeature(r: number, g: number, b: number): { a: number; b: number; v: number } {
  const [h, s, v] = rgbToHsvCv(r, g, b);
  const rad = (h * 2 * Math.PI) / 180;
  return { a: s * Math.cos(rad), b: s * Math.sin(rad), v };
}

/** sRGB → CIELab (D65)。Lab 色度对 R/O/W 暖簇分得比 HSV 色度盘略好 (+1.3% LOO) */
export function labFeature(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number): number => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const rl = lin(r), gl = lin(g), bl = lin(b);
  let X = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
  const Y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  let Z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;
  X /= 0.95047;
  Z /= 1.08883;
  const fq = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = fq(X), fy = fq(Y), fz = fq(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * kNN 模型构建: 每类上限采样 (stride 均匀抽) 压不平衡 + 控规模, 预缩放 Lab 特征。
 * capPerClass 兼顾"少类不被大类淹没"与"分类 O(N) 可控"。样本太薄返回 null。
 */
export function buildKnn(
  samples: readonly ColorSample[],
  k = 7,
  capPerClass = 150,
  rejectD2Opt = 400,
): ColorKnn | null {
  const byClass = new Map<ColorName, ColorSample[]>();
  for (const s of samples) {
    (byClass.get(s.label) ?? byClass.set(s.label, []).get(s.label)!).push(s);
  }
  const kept: ColorSample[] = [];
  for (const arr of byClass.values()) {
    const stride = Math.max(1, Math.ceil(arr.length / capPerClass));
    for (let i = 0; i < arr.length; i += stride) kept.push(arr[i]);
  }
  if (kept.length < k + 3) return null;
  const raw = kept.map((s) => labFeature(s.r, s.g, s.b));
  const scale = [0, 1, 2].map((d) => {
    const xs = raw.map((f) => f[d]).sort((a, b) => a - b);
    const m = xs[xs.length >> 1];
    const dev = xs.map((x) => Math.abs(x - m)).sort((a, b) => a - b);
    return Math.max(1, 1.4826 * dev[dev.length >> 1]);
  }) as [number, number, number];
  const feats = raw.map(
    (f) => [f[0] / scale[0], f[1] / scale[1], f[2] / scale[2]] as [number, number, number],
  );
  return { feats, labels: kept.map((s) => s.label), scale, k, rejectD2: rejectD2Opt };
}

/** kNN 分类 (多数票); 最近邻缩放平方距离超阈判拒 (皮肤/遮挡外点) */
export function knnClassify(r: number, g: number, b: number, knn: ColorKnn): ColorName | null {
  const f = labFeature(r, g, b);
  const q0 = f[0] / knn.scale[0], q1 = f[1] / knn.scale[1], q2 = f[2] / knn.scale[2];
  const nn: { d: number; l: ColorName }[] = [];
  let nearest = Infinity;
  for (let i = 0; i < knn.feats.length; i++) {
    const e = knn.feats[i];
    const d0 = q0 - e[0], d1 = q1 - e[1], d2 = q2 - e[2];
    const d = d0 * d0 + d1 * d1 + d2 * d2;
    if (d < nearest) nearest = d;
    // 保留 k 个最小 (插入排序, 小 k 廉价)
    if (nn.length < knn.k) {
      nn.push({ d, l: knn.labels[i] });
      if (nn.length === knn.k) nn.sort((a, b) => a.d - b.d);
    } else if (d < nn[knn.k - 1].d) {
      let j = knn.k - 1;
      while (j > 0 && nn[j - 1].d > d) { nn[j] = nn[j - 1]; j--; }
      nn[j] = { d, l: knn.labels[i] };
    }
  }
  if (nearest > knn.rejectD2) return null;
  const tally = new Map<ColorName, number>();
  for (const e of nn) tally.set(e.l, (tally.get(e.l) ?? 0) + 1);
  let best: ColorName | null = null, bestN = 0;
  for (const [c, n] of tally) if (n > bestN) { bestN = n; best = c; }
  return best;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((x, y) => x - y);
  return s[s.length >> 1];
}

function madScale(xs: number[], center: number, floor: number): number {
  if (xs.length < 2) return floor;
  const dev = xs.map((x) => Math.abs(x - center));
  return Math.max(floor, 1.4826 * median(dev));
}

/**
 * 拟合每视频标定。样本不足的类由"全局色相偏移 + 饱和缩放"作用于 canonical
 * 合成 (宽尺度, 只兜底不主导)。有效类 (含合成) 恒为 6; 若实拟合类 <3 视为
 * 标定失败返回 null (样本太薄, 合成主导会放大 canonical 的系统偏差)。
 */
export function fitColorCalib(
  samples: readonly ColorSample[],
  opts: { minPerClass?: number; rejectD2?: number; knn?: boolean } = {},
): ColorCalib | null {
  const minPerClass = opts.minPerClass ?? 6;
  const byClass = new Map<ColorName, { a: number[]; b: number[]; v: number[] }>();
  for (const s of samples) {
    const f = rgbFeature(s.r, s.g, s.b);
    const e = byClass.get(s.label) ?? { a: [], b: [], v: [] };
    e.a.push(f.a);
    e.b.push(f.b);
    e.v.push(f.v);
    byClass.set(s.label, e);
  }

  const fitted = new Map<ColorName, ClassStats>();
  for (const [c, e] of byClass) {
    if (e.a.length < minPerClass) continue;
    const ca = median(e.a), cb = median(e.b), cv = median(e.v);
    fitted.set(c, {
      n: e.a.length,
      ca,
      cb,
      cv,
      sa: madScale(e.a, ca, 12),
      sb: madScale(e.b, cb, 12),
      sv: madScale(e.v, cv, 20),
      synth: false,
    });
  }
  const fittedColored = [...fitted.keys()].filter((c) => c !== "W");
  if (fitted.size < 3) return null;

  // 全局色相偏移 (圆均值) + 饱和缩放: 由实拟合彩色类相对 canonical 求出
  let sx = 0, sy = 0, satRatioSum = 0;
  for (const c of fittedColored) {
    const f = fitted.get(c)!;
    const canon = CANONICAL[c];
    const fh = Math.atan2(f.cb, f.ca);
    const ch = (canon.h * 2 * Math.PI) / 180;
    sx += Math.cos(fh - ch);
    sy += Math.sin(fh - ch);
    satRatioSum += Math.hypot(f.ca, f.cb) / canon.s;
  }
  const hueShift = fittedColored.length ? Math.atan2(sy, sx) : 0;
  const satScale = fittedColored.length ? satRatioSum / fittedColored.length : 1;

  const classes = {} as Record<ColorName, ClassStats>;
  for (const c of COLOR_LIST) {
    const f = fitted.get(c);
    if (f) {
      classes[c] = f;
      continue;
    }
    const canon = CANONICAL[c];
    const ch = (canon.h * 2 * Math.PI) / 180 + (c === "W" ? 0 : hueShift);
    const s = canon.s * (c === "W" ? 1 : satScale);
    classes[c] = {
      n: 0,
      ca: s * Math.cos(ch),
      cb: s * Math.sin(ch),
      cv: canon.v,
      sa: 26,
      sb: 26,
      sv: 48,
      synth: true,
    };
  }
  const knn = opts.knn ? (buildKnn(samples) ?? undefined) : undefined;
  return { classes, rejectD2: opts.rejectD2 ?? 16, knn };
}

/**
 * 逐类对数似然 (对角高斯, 含归一化项), 顺序 = COLOR_LIST (W R G Y O B)。
 * 软观测通道用: 归一化后即逐格颜色概率向量 — 重叠区格子输出近均匀 (弱证据),
 * 干净格输出尖峰 (强证据), 比硬 argmax 保留完整信息。
 */
export function classLogLikelihoods(r: number, g: number, b: number, calib: ColorCalib): number[] {
  const f = rgbFeature(r, g, b);
  return COLOR_LIST.map((c) => {
    const cl = calib.classes[c];
    const da = (f.a - cl.ca) / cl.sa;
    const db = (f.b - cl.cb) / cl.sb;
    const dv = (f.v - cl.cv) / cl.sv;
    return -0.5 * (da * da + db * db + dv * dv) - Math.log(cl.sa * cl.sb * cl.sv);
  });
}

/** classLogLikelihoods → 归一化概率向量 (均匀先验后验) */
export function classProbs(r: number, g: number, b: number, calib: ColorCalib): number[] {
  const lls = classLogLikelihoods(r, g, b, calib);
  const hi = Math.max(...lls);
  const exps = lls.map((l) => Math.exp(l - hi));
  const sum = exps.reduce((s, e) => s + e, 0);
  return exps.map((e) => e / sum);
}

/** 最近类分类; 拒判 (距离超阈 / 过暗) 返回 null */
export function calibClassify(
  r: number,
  g: number,
  b: number,
  calib: ColorCalib,
): ColorName | null {
  const f = rgbFeature(r, g, b);
  if (f.v < 55) return null;
  if (calib.knn) return knnClassify(r, g, b, calib.knn);
  let best: ColorName | null = null;
  let bestD2 = Infinity;
  for (const c of COLOR_LIST) {
    const cl = calib.classes[c];
    const da = (f.a - cl.ca) / cl.sa;
    const db = (f.b - cl.cb) / cl.sb;
    const dv = (f.v - cl.cv) / cl.sv;
    const d2 = da * da + db * db + dv * dv;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = c;
    }
  }
  return bestD2 <= calib.rejectD2 ? best : null;
}

/** 块逐通道中位 RGB (采样格心小块; 对反光/边缘像素鲁棒) */
export function blockMedianRGB(
  rgb: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
): { r: number; g: number; b: number } | null {
  const x0 = Math.max(0, Math.round(cx - radius));
  const x1 = Math.min(w - 1, Math.round(cx + radius));
  const y0 = Math.max(0, Math.round(cy - radius));
  const y1 = Math.min(h - 1, Math.round(cy + radius));
  if (x1 <= x0 || y1 <= y0) return null;
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = (y * w + x) * 3;
      rs.push(rgb[p]);
      gs.push(rgb[p + 1]);
      bs.push(rgb[p + 2]);
    }
  }
  return { r: median(rs), g: median(gs), b: median(bs) };
}

/** 标定摘要 (诊断打印) */
export function calibSummary(calib: ColorCalib): string {
  return COLOR_LIST.map((c) => {
    const cl = calib.classes[c];
    const hue = ((Math.atan2(cl.cb, cl.ca) * 180) / Math.PI / 2 + 180) % 180;
    const sat = Math.hypot(cl.ca, cl.cb);
    return `${c}${cl.synth ? "*" : ""}:n${cl.n} h${hue.toFixed(0)} s${sat.toFixed(0)} v${cl.cv.toFixed(0)}`;
  }).join(" ");
}
