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
}

export interface ColorSample {
  r: number;
  g: number;
  b: number;
  label: ColorName;
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
  opts: { minPerClass?: number; rejectD2?: number } = {},
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
  return { classes, rejectD2: opts.rejectD2 ?? 16 };
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
