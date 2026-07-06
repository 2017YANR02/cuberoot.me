/**
 * sticker-blobs.ts — 帧内贴纸色块检测 + 主导面 3×3 网格拟合 (纯 TS, 无 OpenCV)。
 *
 * 前提 (目检 5 视频边界帧): 魔方在画面里大范围移动 (固定 ROI 不成立), 贴纸巨大
 * (960×540 下 ~33px), 颜色高饱和, 背景深色 + 皮肤。策略:
 *   1. 逐像素鲜艳色分类 (HSV 规则, 皮肤/背景排除靠高饱和阈值)
 *   2. 同色 4-连通域 → 面积/填充率/长宽比过滤 → 贴纸候选色块
 *   3. 主导面拟合: 最近邻向量角度折叠 [0,90°) 取中位 → 旋回正 → 网格量化
 *      → 取覆盖最多色块的 3×3 窗口; 遮挡格缺失 (由观测模型容忍)
 */
import { rgbToHsvCv } from "./bface-color.ts";
import type { ColorName } from "./reconstruct.ts";

/**
 * 鲜艳贴纸色分类; 皮肤 (中饱和橙调, s~30-110) / 背景 (暗) / 反光 (低饱和亮斑,
 * 由色块层的环带重标处理) 返回 null。W 阈值严 (真白贴纸 s<25, v>200; 皮肤 s≥30)。
 */
export function classifyPixel(r: number, g: number, b: number): ColorName | null {
  const [h, s, v] = rgbToHsvCv(r, g, b);
  if (s < 25 && v > 200) return "W";
  if (v < 60) return null;
  if (s < 110) return null; // 皮肤/杂色: 饱和度不足
  if (h < 8 || h >= 168) return "R";
  if (h < 22) return "O";
  if (h < 38) return "Y";
  if (h < 85) return "G";
  if (h >= 95 && h < 135) return "B";
  return null;
}

export interface Blob {
  color: ColorName;
  cx: number;
  cy: number;
  area: number;
  /** 色块平均 RGB (供后续重分类/校准) */
  r: number;
  g: number;
  b: number;
  w: number;
  h: number;
}

/**
 * 时域中位数背景 (固定机位: 垫子/计时器/衣服外的静物全灭)。
 * frames 传帧的子集即可 (~15 帧足够)。
 */
export function medianBackground(frames: readonly Uint8Array[], w: number, h: number): Uint8Array {
  const n = frames.length;
  const bg = new Uint8Array(w * h * 3);
  const vals = new Uint8Array(n);
  for (let p = 0; p < w * h * 3; p++) {
    for (let f = 0; f < n; f++) vals[f] = frames[f][p];
    vals.sort();
    bg[p] = vals[n >> 1];
  }
  return bg;
}

/** 前景掩码: 任一通道与背景差 > thresh */
export function foregroundMask(
  rgb: Uint8Array,
  bg: Uint8Array,
  w: number,
  h: number,
  thresh = 30,
): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 3) {
    if (
      Math.abs(rgb[p] - bg[p]) > thresh ||
      Math.abs(rgb[p + 1] - bg[p + 1]) > thresh ||
      Math.abs(rgb[p + 2] - bg[p + 2]) > thresh
    ) {
      mask[i] = 1;
    }
  }
  return mask;
}

/**
 * 非静物掩码 (跨帧稳定性): 在采样帧集中颜色几乎不变的像素 = 静物 (计时器/垫子/
 * 静止衣物), 其余 = 活动区 (手+魔方)。
 * 注意: 不能用"当前帧 vs 背景中位"做前景 — 魔方整场悬在画面中央同一区域,
 * 中位背景在该区域被魔方色污染, 会吃掉与"背景"同色的贴纸。
 */
export function activityMask(
  frames: readonly Uint8Array[],
  bg: Uint8Array,
  w: number,
  h: number,
  thresh = 30,
  maxStableFrac = 0.85,
): Uint8Array {
  const mask = new Uint8Array(w * h);
  const n = frames.length;
  for (let i = 0, p = 0; i < w * h; i++, p += 3) {
    let stable = 0;
    for (let f = 0; f < n; f++) {
      const fr = frames[f];
      if (
        Math.abs(fr[p] - bg[p]) <= thresh &&
        Math.abs(fr[p + 1] - bg[p + 1]) <= thresh &&
        Math.abs(fr[p + 2] - bg[p + 2]) <= thresh
      ) {
        stable++;
      }
    }
    if (stable / n < maxStableFrac) mask[i] = 1;
  }
  return mask;
}

export interface DetectOptions {
  minArea?: number; // 默认 220 (960×540 下贴纸 ~1000px², 透视缩短打折)
  maxArea?: number; // 默认 4500
  minFill?: number; // bbox 填充率下限, 默认 0.5
  maxAspect?: number; // bbox 长宽比上限, 默认 2.8
  /** 前景掩码 (1=前景); 提供则只在前景内检测 */
  mask?: Uint8Array;
}

/** 同色 4-连通域检测贴纸色块 */
export function detectStickerBlobs(
  rgb: Uint8Array,
  w: number,
  h: number,
  opts: DetectOptions = {},
): Blob[] {
  const minArea = opts.minArea ?? 220;
  const maxArea = opts.maxArea ?? 4500;
  const minFill = opts.minFill ?? 0.5;
  const maxAspect = opts.maxAspect ?? 2.8;

  // 逐像素分类 (0 = 无, 1..6 = W R O Y G B)
  const CODE: Record<ColorName, number> = { W: 1, R: 2, O: 3, Y: 4, G: 5, B: 6 };
  const NAMES: (ColorName | null)[] = [null, "W", "R", "O", "Y", "G", "B"];
  const label = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 3) {
    if (opts.mask && !opts.mask[i]) continue;
    const c = classifyPixel(rgb[p], rgb[p + 1], rgb[p + 2]);
    if (c) label[i] = CODE[c];
  }

  const seen = new Uint8Array(w * h);
  const blobs: Blob[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!label[start] || seen[start]) continue;
    const code = label[start];
    let area = 0, sx = 0, sy = 0, sr = 0, sg = 0, sb = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i / w) | 0;
      area++;
      sx += x; sy += y;
      const p = i * 3;
      sr += rgb[p]; sg += rgb[p + 1]; sb += rgb[p + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && label[i - 1] === code && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1); }
      if (x < w - 1 && label[i + 1] === code && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && label[i - w] === code && !seen[i - w]) { seen[i - w] = 1; stack.push(i - w); }
      if (y < h - 1 && label[i + w] === code && !seen[i + w]) { seen[i + w] = 1; stack.push(i + w); }
    }
    if (area < minArea || area > maxArea) continue;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const aspect = Math.max(bw, bh) / Math.min(bw, bh);
    const fill = area / (bw * bh);
    if (aspect > maxAspect || fill < minFill) continue;
    blobs.push({
      color: NAMES[code]!,
      cx: sx / area,
      cy: sy / area,
      area,
      r: sr / area,
      g: sg / area,
      b: sb / area,
      w: bw,
      h: bh,
    });
  }

  // 反光重标: 高光核心 (W 色块) 到饱和色之间有去饱和过渡带 (s 25~110),
  // 用放宽饱和阈 (s≥50) 的色相投票在 1.25× bbox 壳层内找底色 (再大会圈进邻贴纸)
  for (const blob of blobs) {
    if (blob.color !== "W") continue;
    const ew = blob.w * 0.625, eh = blob.h * 0.625;
    const x0 = Math.max(0, Math.round(blob.cx - ew));
    const x1 = Math.min(w - 1, Math.round(blob.cx + ew));
    const y0 = Math.max(0, Math.round(blob.cy - eh));
    const y1 = Math.min(h - 1, Math.round(blob.cy + eh));
    const counts = new Map<ColorName, number>();
    let box = 0, tinted = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        box++;
        const p = (y * w + x) * 3;
        const [hh, ss, vv] = rgbToHsvCv(rgb[p], rgb[p + 1], rgb[p + 2]);
        if (ss < 50 || vv < 90) continue;
        let c: ColorName | null = null;
        // R/O 色相带与皮肤重叠, 投票要求更高饱和防白贴纸被手指投成 O
        if (hh < 8 || hh >= 168) c = ss >= 90 ? "R" : null;
        else if (hh < 22) c = ss >= 90 ? "O" : null;
        else if (hh < 38) c = "Y";
        else if (hh < 85) c = "G";
        else if (hh >= 95 && hh < 135) c = "B";
        if (!c) continue;
        tinted++;
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    let bestC: ColorName | null = null;
    let bestN = 0;
    for (const [c, n] of counts) {
      if (n > bestN) { bestN = n; bestC = c; }
    }
    if (bestC && tinted / box >= 0.08 && bestN / tinted >= 0.5) blob.color = bestC;
  }
  return blobs;
}

export interface FaceGrid {
  /** 该基的全部内点色块 (含 3×3 窗口外的), 供多晶格提取移除后再拟合 */
  inlierBlobs: Blob[];
  /** 相机视角行主序 3×3; null = 该格无色块 (遮挡/缺失) */
  cells: (Blob | null)[];
  /** 仿射网格: 格 (r,c) 中心 = origin + c·v1 + r·v2 (v1≈列向/右, v2≈行向/下) */
  origin: { x: number; y: number };
  v1: { x: number; y: number };
  v2: { x: number; y: number };
  filled: number;
  /** 网格间距近似 (px, 取 |v1|,|v2| 均值), 供采样半径 */
  pitch: number;
}

/** 格 (r,c) 中心的图像坐标 (含缺失格外插) */
export function cellCenter(grid: FaceGrid, r: number, c: number): { x: number; y: number } {
  return {
    x: grid.origin.x + c * grid.v1.x + r * grid.v2.x,
    y: grid.origin.y + c * grid.v1.y + r * grid.v2.y,
  };
}

/**
 * 主导面 3×3 网格拟合 (RANSAC 仿射基): 枚举色块对作基向量 (v1,v2),
 * 解各色块整数格坐标, 计内点; 最优基上取覆盖最多的 3×3 窗口。
 * 仿射基天然容忍透视缩短/剪切; 异面色块因平面投影不一致成为外点。
 * minFilled: 3×3 窗口内至少几格有色块 (默认 4)。
 */
export function fitFaceGrid(blobs: Blob[], minFilled = 4): FaceGrid | null {
  const n = blobs.length;
  if (n < minFilled) return null;

  // 最近邻距离中位 → 间距先验
  const nnd: number[] = [];
  for (const a of blobs) {
    let best = Infinity;
    for (const b of blobs) {
      if (a !== b) best = Math.min(best, Math.hypot(a.cx - b.cx, a.cy - b.cy));
    }
    nnd.push(best);
  }
  const medNN = nnd.sort((a, b) => a - b)[nnd.length >> 1];
  if (!medNN || medNN < 8) return null;

  interface Basis {
    ox: number; oy: number;
    v1x: number; v1y: number; v2x: number; v2y: number;
    inliers: { b: Blob; gc: number; gr: number }[];
    res: number;
  }

  const evalBasis = (ox: number, oy: number, v1x: number, v1y: number, v2x: number, v2y: number): Basis | null => {
    const det = v1x * v2y - v1y * v2x;
    // 斜持顶面透视缩短: 一轴可压至 ~0.5×medNN 且轴间夹角远离 90°, det 门槛须宽
    if (Math.abs(det) < medNN * medNN * 0.12) return null;
    const inliers: { b: Blob; gc: number; gr: number }[] = [];
    let resSum = 0;
    for (const b of blobs) {
      const dx = b.cx - ox, dy = b.cy - oy;
      const c = (dx * v2y - dy * v2x) / det;
      const r = (dy * v1x - dx * v1y) / det;
      const gc = Math.round(c), gr = Math.round(r);
      if (Math.abs(gc) > 4 || Math.abs(gr) > 4) continue;
      const res = Math.hypot(c - gc, r - gr);
      if (res > 0.22) continue;
      inliers.push({ b, gc, gr });
      resSum += res;
    }
    return { ox, oy, v1x, v1y, v2x, v2y, inliers, res: resSum };
  };

  let best: Basis | null = null;
  for (let i = 0; i < n; i++) {
    const bi = blobs[i];
    // 候选邻居: 距离在 [0.45, 1.6]×medNN 的向量 (透视缩短轴间距可短至半格)
    const neigh: { x: number; y: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = blobs[j].cx - bi.cx, dy = blobs[j].cy - bi.cy;
      const d = Math.hypot(dx, dy);
      if (d > 0.45 * medNN && d < 1.6 * medNN) neigh.push({ x: dx, y: dy });
    }
    for (let a = 0; a < neigh.length; a++) {
      for (let b = 0; b < neigh.length; b++) {
        if (a === b) continue;
        const cross = neigh[a].x * neigh[b].y - neigh[a].y * neigh[b].x;
        const la = Math.hypot(neigh[a].x, neigh[a].y);
        const lb = Math.hypot(neigh[b].x, neigh[b].y);
        // 斜持面在图像里剪切严重, 只拒近共线基 (sin > 0.4); 残差门槛负责挡假格
        if (Math.abs(cross) / (la * lb) < 0.4) continue;
        const cand = evalBasis(bi.cx, bi.cy, neigh[a].x, neigh[a].y, neigh[b].x, neigh[b].y);
        if (cand && (!best || cand.inliers.length > best.inliers.length ||
          (cand.inliers.length === best.inliers.length && cand.res < best.res))) {
          best = cand;
        }
      }
    }
  }
  if (!best || best.inliers.length < minFilled) return null;

  // Gauss 基约减: 幺模等价基生成同一点阵, 但窗口需要"最短基" (真实行/列步长),
  // 否则对角基下的 3×3 窗口不是物理面
  {
    let a = { x: best.v1x, y: best.v1y };
    let b = { x: best.v2x, y: best.v2y };
    for (let iter = 0; iter < 16; iter++) {
      if (a.x * a.x + a.y * a.y > b.x * b.x + b.y * b.y) [a, b] = [b, a];
      const m = Math.round((a.x * b.x + a.y * b.y) / (a.x * a.x + a.y * a.y));
      if (m === 0) break;
      b = { x: b.x - m * a.x, y: b.y - m * a.y };
    }
    const reduced = evalBasis(best.ox, best.oy, a.x, a.y, b.x, b.y);
    if (reduced && reduced.inliers.length >= best.inliers.length) best = reduced;
  }

  // 规范化: v1 取更接近水平者且朝右, v2 朝下 (相机行主序)
  let { ox, oy, v1x, v1y, v2x, v2y } = best;
  let inl = best.inliers;
  const horiz1 = Math.abs(v1x) / Math.hypot(v1x, v1y);
  const horiz2 = Math.abs(v2x) / Math.hypot(v2x, v2y);
  if (horiz1 < horiz2) {
    [v1x, v1y, v2x, v2y] = [v2x, v2y, v1x, v1y];
    inl = inl.map((e) => ({ b: e.b, gc: e.gr, gr: e.gc }));
  }
  if (v1x < 0) {
    v1x = -v1x; v1y = -v1y;
    inl = inl.map((e) => ({ b: e.b, gc: -e.gc, gr: e.gr }));
  }
  if (v2y < 0) {
    v2x = -v2x; v2y = -v2y;
    inl = inl.map((e) => ({ b: e.b, gc: e.gc, gr: -e.gr }));
  }

  // 最优 3×3 窗口 (面积和优先: 半遮挡/异面贴纸条面积小, 防窗口被"第 4 行"拖走)
  const byCell = new Map<string, Blob>();
  for (const e of inl) {
    const key = `${e.gc},${e.gr}`;
    const prev = byCell.get(key);
    if (!prev || e.b.area > prev.area) byCell.set(key, e.b);
  }
  const coords = [...byCell.keys()].map((k) => k.split(",").map(Number) as [number, number]);
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  let bestWin: { count: number; areaSum: number; x0: number; y0: number } | null = null;
  for (let x0 = Math.min(...xs) - 2; x0 <= Math.max(...xs); x0++) {
    for (let y0 = Math.min(...ys) - 2; y0 <= Math.max(...ys); y0++) {
      let count = 0, areaSum = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const e = byCell.get(`${x0 + c},${y0 + r}`);
          if (e) { count++; areaSum += e.area; }
        }
      }
      if (!bestWin || areaSum > bestWin.areaSum || (areaSum === bestWin.areaSum && count > bestWin.count)) {
        bestWin = { count, areaSum, x0, y0 };
      }
    }
  }
  if (!bestWin || bestWin.count < minFilled) return null;

  const cells: (Blob | null)[] = new Array(9).fill(null);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cells[r * 3 + c] = byCell.get(`${bestWin.x0 + c},${bestWin.y0 + r}`) ?? null;
    }
  }
  return {
    cells,
    inlierBlobs: inl.map((e) => e.b),
    origin: { x: ox + bestWin.x0 * v1x + bestWin.y0 * v2x, y: oy + bestWin.x0 * v1y + bestWin.y0 * v2y },
    v1: { x: v1x, y: v1y },
    v2: { x: v2x, y: v2y },
    filled: bestWin.count,
    pitch: (Math.hypot(v1x, v1y) + Math.hypot(v2x, v2y)) / 2,
  };
}

/**
 * 魔方色块聚类: 按距离 union, 取"≥minBlobs 个色块且 ≥2 种颜色"里总面积最大的簇。
 * 排除单色大物 (绿外套/黄 logo) — 只有魔方处多色紧邻。
 */
export function clusterCubeBlobs(blobs: Blob[], minBlobs = 4): Blob[] | null {
  if (blobs.length < minBlobs) return null;
  const medW = blobs.map((b) => Math.max(b.w, b.h)).sort((a, b) => a - b)[blobs.length >> 1];
  const linkDist = medW * 2.2;
  const parent = blobs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      if (Math.hypot(blobs[i].cx - blobs[j].cx, blobs[i].cy - blobs[j].cy) < linkDist) {
        parent[find(i)] = find(j);
      }
    }
  }
  const groups = new Map<number, Blob[]>();
  for (let i = 0; i < blobs.length; i++) {
    const root = find(i);
    (groups.get(root) ?? groups.set(root, []).get(root)!).push(blobs[i]);
  }
  let best: Blob[] | null = null;
  let bestArea = 0;
  for (const g of groups.values()) {
    if (g.length < minBlobs) continue;
    if (new Set(g.map((b) => b.color)).size < 2) continue;
    const area = g.reduce((s, b) => s + b.area, 0);
    if (area > bestArea) {
      bestArea = area;
      best = g;
    }
  }
  return best;
}

/**
 * 采样格心小块。鲜艳色多数票 (反光像素不投票); 鲜艳像素过少时,
 * 块整体又亮又低饱和 → W, 否则 null (遮挡/阴影/皮肤)。
 */
export function sampleCell(
  rgb: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
  minAgree = 0.6,
): ColorName | null {
  const x0 = Math.max(0, Math.round(cx - radius));
  const x1 = Math.min(w - 1, Math.round(cx + radius));
  const y0 = Math.max(0, Math.round(cy - radius));
  const y1 = Math.min(h - 1, Math.round(cy + radius));
  if (x1 <= x0 || y1 <= y0) return null;
  const counts = new Map<ColorName, number>();
  let total = 0, vivid = 0, whiteish = 0;
  let sr = 0, sg = 0, sb = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = (y * w + x) * 3;
      total++;
      sr += rgb[p]; sg += rgb[p + 1]; sb += rgb[p + 2];
      const c = classifyPixel(rgb[p], rgb[p + 1], rgb[p + 2]);
      if (!c) continue;
      if (c === "W") {
        whiteish++;
        continue;
      }
      vivid++;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  if (vivid / total >= 0.3) {
    let bestC: ColorName | null = null;
    let bestN = 0;
    for (const [c, n] of counts) {
      if (n > bestN) { bestN = n; bestC = c; }
    }
    return bestC && bestN / vivid >= minAgree ? bestC : null;
  }
  // 鲜艳像素少: 白贴纸判据。格位已知在魔方上, 可比像素级 W 放宽
  // (阴影白 s~35), 但皮肤遮挡该格时会误读 W — 靠 v 下限压制
  if (whiteish / total >= 0.5) return "W";
  const [, s, v] = rgbToHsvCv(sr / total, sg / total, sb / total);
  if (s < 38 && v > 185) return "W";
  return null;
}

export interface FaceObservation {
  /** 相机视角行主序 3×3 颜色; null = 该格不可读 (遮挡/不均匀) */
  colors: (ColorName | null)[];
  grid: FaceGrid;
  blobCount: number;
}

/**
 * 单帧提取多面观测: 活动区鲜艳色块 → 魔方簇 → 顺序晶格拟合 (最多 2 面:
 * 斜持时顶面 + 正对面同时可见, 拟合一面后移除其内点再拟合下一面) → 格心采样。
 * mask 建议用 activityMask (跨帧稳定性), 不要用被魔方污染的中位背景差分。
 * 返回 [] = 本帧无可信面; [0] 为主导面 (内点最多)。
 */
export function extractFaceObservations(
  rgb: Uint8Array,
  w: number,
  h: number,
  mask: Uint8Array | null,
  opts: DetectOptions & { minFilled?: number } = {},
): FaceObservation[] {
  const blobs = detectStickerBlobs(rgb, w, h, { ...opts, mask: mask ?? undefined });
  let cluster = clusterCubeBlobs(blobs);
  if (!cluster) return [];
  // 簇内尺寸一致性: 杂物尺寸失调剔除 (斜持面贴纸透视压扁, 下限须宽)
  const medDim = cluster.map((b) => Math.max(b.w, b.h)).sort((a, b) => a - b)[cluster.length >> 1];
  cluster = cluster.filter((b) => {
    const d = Math.max(b.w, b.h);
    const m = Math.min(b.w, b.h);
    return d >= 0.45 * medDim && d <= 1.8 * medDim && m >= 0.35 * medDim;
  });
  const minFilled = opts.minFilled ?? 4;
  const out: FaceObservation[] = [];
  let remaining = cluster;
  while (out.length < 2 && remaining.length >= minFilled) {
    const grid = fitFaceGrid(remaining, minFilled);
    if (!grid) break;
    const colors: (ColorName | null)[] = new Array(9).fill(null);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const blob = grid.cells[r * 3 + c];
        if (blob) {
          // 色块颜色含反光环带重标, 比重采样可靠
          colors[r * 3 + c] = blob.color;
        } else {
          const { x, y } = cellCenter(grid, r, c);
          colors[r * 3 + c] = sampleCell(rgb, w, h, x, y, grid.pitch * 0.22);
        }
      }
    }
    out.push({ colors, grid, blobCount: remaining.length });
    const used = new Set(grid.inlierBlobs);
    remaining = remaining.filter((b) => !used.has(b));
  }
  return out;
}

/**
 * 时间连续性跟踪: 用上一帧的晶格作先验, 预测格位 → 小范围平移搜索 →
 * 直接按格位采样像素。完全不依赖色块/聚类/拟合成功 — 冷检测在遮挡/模糊/
 * 斜持帧上 ~75% 失败, 但魔方不瞬移, 基向量在帧间基本不变, 只有原点漂移。
 * 转动中的层模糊 → 该格采样 null (天然部分观测); 非转动层照常可读。
 *
 * 返回 null = 平移搜索内无 ≥minCells 可读格 (魔方移出/全遮挡, 调用方计连败)。
 */
export function trackFaceGrid(
  rgb: Uint8Array,
  w: number,
  h: number,
  prior: FaceGrid,
  priorColors: readonly (ColorName | null)[] | null = null,
  opts: { range?: number; step?: number; minCells?: number } = {},
): FaceObservation | null {
  const range = opts.range ?? 16;
  const step = opts.step ?? 4;
  const minCells = opts.minCells ?? 4;
  const radius = prior.pitch * 0.22;

  let bestScore = -1;
  let bestDx = 0, bestDy = 0;
  let bestColors: (ColorName | null)[] | null = null;
  for (let dy = -range; dy <= range; dy += step) {
    for (let dx = -range; dx <= range; dx += step) {
      const colors: (ColorName | null)[] = new Array(9).fill(null);
      let readable = 0, agreePrior = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const { x, y } = cellCenter(prior, r, c);
          const col = sampleCell(rgb, w, h, x + dx, y + dy, radius);
          colors[r * 3 + c] = col;
          if (col) {
            readable++;
            if (priorColors && priorColors[r * 3 + c] === col) agreePrior++;
          }
        }
      }
      // 可读格数为主, 与上帧同色为辅 (防锁到相邻杂物/别的面)
      const score = readable + 0.3 * agreePrior;
      if (score > bestScore) {
        bestScore = score;
        bestDx = dx;
        bestDy = dy;
        bestColors = colors;
      }
    }
  }
  if (!bestColors || bestColors.filter(Boolean).length < minCells) return null;
  const grid: FaceGrid = {
    ...prior,
    cells: new Array(9).fill(null),
    inlierBlobs: [],
    origin: { x: prior.origin.x + bestDx, y: prior.origin.y + bestDy },
    filled: bestColors.filter(Boolean).length,
  };
  return { colors: bestColors, grid, blobCount: 0 };
}

/** 单面兼容封装: 只取主导面 */
export function extractFaceObservation(
  rgb: Uint8Array,
  w: number,
  h: number,
  mask: Uint8Array | null,
  opts: DetectOptions & { minFilled?: number } = {},
): FaceObservation | null {
  return extractFaceObservations(rgb, w, h, mask, opts)[0] ?? null;
}
