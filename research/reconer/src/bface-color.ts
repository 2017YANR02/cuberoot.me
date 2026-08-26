/**
 * bface-color.ts — 从 B 面 ROI 像素提取 3×3 颜色分布 (纯 JS, 无 OpenCV)。
 *
 * 复刻 greedy_reverse.py 的 extract_b_face_colors / get_roi_color:
 *   - HSV 转换用 OpenCV 8-bit 约定 (H 0-180, S/V 0-255)
 *   - 每格按 COLOR_RANGES 统计各色占比
 *   - 相机视角 → CubeState B 面 45..53 的水平镜像重排
 *
 * 输入为已裁剪到 ROI_B_FACE 的 RGB 缓冲 (ffmpeg crop 输出), 与 Python 对整帧用
 * 绝对 ROI 坐标等价。
 */
import type { BFaceGrid, CellDist, ColorName } from "./reconstruct.ts";

/** ROI_B_FACE = (x, y, w, h), 见 greedy_reverse.py / find_roi.py */
export const ROI_B_FACE = { x: 1268, y: 1064, w: 508, h: 318 } as const;

type Range = readonly [readonly [number, number, number], readonly [number, number, number]];

/** HSV 颜色阈值 (OpenCV 约定), 与 greedy_reverse.COLOR_RANGES 一致 */
const COLOR_RANGES: Record<string, Range> = {
  W: [[0, 0, 150], [180, 60, 255]],
  R: [[0, 100, 100], [10, 255, 255]],
  R2: [[170, 100, 100], [180, 255, 255]],
  O: [[10, 100, 100], [25, 255, 255]],
  Y: [[25, 100, 100], [35, 255, 255]],
  G: [[35, 100, 40], [85, 255, 255]],
  B: [[90, 100, 40], [130, 255, 255]],
};

/** RGB → HSV, 复刻 OpenCV cvtColor(BGR2HSV) 8-bit (通道值无关存储顺序) */
export function rgbToHsvCv(r: number, g: number, b: number): [number, number, number] {
  const v = Math.max(r, g, b);
  const vmin = Math.min(r, g, b);
  const diff = v - vmin;
  const s = v === 0 ? 0 : Math.round((diff * 255) / v);
  let h: number;
  if (diff === 0) h = 0;
  else if (v === r) h = ((g - b) * 60) / diff;
  else if (v === g) h = 120 + ((b - r) * 60) / diff;
  else h = 240 + ((r - g) * 60) / diff;
  if (h < 0) h += 360;
  h = Math.round(h / 2);
  if (h >= 180) h -= 180;
  return [h, s, v];
}

function inRange(h: number, s: number, v: number, [lo, hi]: Range): boolean {
  return h >= lo[0] && h <= hi[0] && s >= lo[1] && s <= hi[1] && v >= lo[2] && v <= hi[2];
}

/**
 * 统计矩形单元格内各颜色占比 (归一化到单元格面积), 与 get_roi_color 等价。
 * rgb: 整个 ROI 的 RGB 缓冲; imgW: ROI 宽; (x,y,w,h): 单元格。
 */
function cellColorScores(
  rgb: Uint8Array,
  imgW: number,
  x: number,
  y: number,
  w: number,
  h: number,
): CellDist {
  let cntW = 0, cntR = 0, cntO = 0, cntY = 0, cntG = 0, cntB = 0;
  for (let yy = y; yy < y + h; yy++) {
    let p = (yy * imgW + x) * 3;
    for (let xx = 0; xx < w; xx++, p += 3) {
      const [hh, ss, vv] = rgbToHsvCv(rgb[p], rgb[p + 1], rgb[p + 2]);
      if (inRange(hh, ss, vv, COLOR_RANGES.W)) cntW++;
      if (inRange(hh, ss, vv, COLOR_RANGES.O)) cntO++;
      if (inRange(hh, ss, vv, COLOR_RANGES.Y)) cntY++;
      if (inRange(hh, ss, vv, COLOR_RANGES.G)) cntG++;
      if (inRange(hh, ss, vv, COLOR_RANGES.B)) cntB++;
      // 红色跨 0/180, 两段并计 (与 Python 一致)
      if (inRange(hh, ss, vv, COLOR_RANGES.R) || inRange(hh, ss, vv, COLOR_RANGES.R2)) cntR++;
    }
  }
  const total = w * h || 1;
  const dist: CellDist = {};
  const put = (name: ColorName, cnt: number) => { if (cnt) dist[name] = cnt / total; };
  put("W", cntW); put("R", cntR); put("O", cntO); put("Y", cntY); put("G", cntG); put("B", cntB);
  return dist;
}

/**
 * 从已裁剪的 B 面 ROI (RGB) 提取 3×3 颜色分布, 返回长度 9 的 BFaceGrid
 * (索引 i → facelet 45+i)。复刻 extract_b_face_colors 的 5% 边距 + 相机镜像重排。
 */
export function extractBFaceColors(rgb: Uint8Array, roiW: number, roiH: number): BFaceGrid {
  const margin = Math.floor(roiW * 0.05);
  const x0 = margin;
  const y0 = margin;
  const w0 = roiW - 2 * margin;
  const h0 = roiH - 2 * margin;
  const cellW = Math.floor(w0 / 3);
  const cellH = Math.floor(h0 / 3);

  // 相机视角 0..8 顺序
  const cam: CellDist[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cam.push(cellColorScores(rgb, roiW, x0 + c * cellW, y0 + r * cellH, cellW, cellH));
    }
  }

  // 相机左 = B 面右列 → 每行水平镜像: reordered[r*3 + (2-c)] = cam[r*3 + c]
  const reordered: CellDist[] = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      reordered[r * 3 + (2 - c)] = cam[r * 3 + c];
    }
  }
  return reordered;
}
