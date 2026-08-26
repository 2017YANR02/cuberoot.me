/**
 * hd-refine.ts — HD 帧亚格晶格精修 (从 scripts/last2-decode.ts 提取共享)。
 *
 * 960 晶格重获取常错位半格~一格 (负⑩(a), 4K 目检实锤跨面), HD 像素下可修:
 * 搜平移 ±0.4 格使 (格内色一致性 + 格缝暗线) 最大 — 错位半格会跨缝混色,
 * 整片同色区域没有黑缝。搜索范围刻意不过格 (过格会跳上邻面/整色面的等优对齐,
 * 整格漂移交给解码侧 shift 边缘化)。
 */
import type { ColorName } from "./reconstruct.ts";
import { cellCenter, type FaceGrid } from "./sticker-blobs.ts";

/** 快速 HSV 分类 (精修内环专用, 与主管线 vivid/calib 分类器无关) */
function classifyHsv(rr: number, gg: number, bb: number): ColorName | null {
  const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
  const v = mx, s = mx === 0 ? 0 : (255 * (mx - mn)) / mx;
  if (s < 40 && v > 170) return "W";
  if (v < 60 || s < 45) return null;
  const d = mx - mn;
  let hh = 0;
  if (mx === rr) hh = (60 * (gg - bb)) / d / 2;
  else if (mx === gg) hh = (120 + (60 * (bb - rr)) / d) / 2;
  else hh = (240 + (60 * (rr - gg)) / d) / 2;
  if (hh < 0) hh += 180;
  if (hh < 8 || hh >= 168) return "R";
  if (hh < 22) return "O";
  if (hh < 38) return "Y";
  if (hh < 85) return "G";
  if (hh >= 95 && hh < 135) return "B";
  return null;
}

/**
 * HD 帧上搜亚格平移: grid 为 960 系晶格, sc = HD宽/960。
 * 返回 HD 像素系的 {dx, dy} (加在 cellCenter×sc 之后)。
 */
export function refineHD(
  rgb: Uint8Array,
  w: number,
  h: number,
  grid: FaceGrid,
  sc: number,
): { dx: number; dy: number } {
  const p2 = grid.pitch * sc;
  const base: { x: number; y: number }[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const { x, y } = cellCenter(grid, r, c);
      base.push({ x: x * sc, y: y * sc });
    }
  const rad = Math.max(4, Math.round(p2 * 0.2));
  const stepPx = Math.max(2, Math.round(rad / 6));
  const evalAt = (dx: number, dy: number): number => {
    let cellScore = 0;
    for (const bc of base) {
      const cx = bc.x + dx, cy = bc.y + dy;
      const counts = new Map<ColorName, number>();
      let tot = 0;
      for (let y = Math.round(cy - rad); y <= cy + rad; y += stepPx) {
        if (y < 0 || y >= h) continue;
        for (let x = Math.round(cx - rad); x <= cx + rad; x += stepPx) {
          if (x < 0 || x >= w) continue;
          const q = (y * w + x) * 3;
          tot++;
          const cc = classifyHsv(rgb[q], rgb[q + 1], rgb[q + 2]);
          if (cc) counts.set(cc, (counts.get(cc) ?? 0) + 1);
        }
      }
      if (!tot) continue;
      let mx = 0;
      for (const n of counts.values()) if (n > mx) mx = n;
      cellScore += mx / tot;
    }
    // 格间隙黑线: 相邻格心中点应是暗缝 (12 条内缝)
    let dark = 0, nGap = 0;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        for (const [r2, c2] of [[r, c + 1], [r + 1, c]] as const) {
          if (r2 > 2 || c2 > 2) continue;
          const a = base[r * 3 + c], b = base[r2 * 3 + c2];
          const gx = Math.round((a.x + b.x) / 2 + dx), gy = Math.round((a.y + b.y) / 2 + dy);
          if (gx < 0 || gx >= w || gy < 0 || gy >= h) continue;
          nGap++;
          const q = (gy * w + gx) * 3;
          const v = Math.max(rgb[q], rgb[q + 1], rgb[q + 2]);
          if (v < 90) dark++;
        }
      }
    return cellScore + (nGap ? 1.5 * (9 * dark) / nGap : 0) / 9 * 1.5;
  };
  // 粗 (±0.4 格, 步 p/8) → 细 (±p/8, 步 p/12)
  let bx = 0, by = 0, bs = -Infinity;
  const R1 = 0.4 * p2, S1 = p2 / 8;
  for (let dy = -R1; dy <= R1; dy += S1)
    for (let dx = -R1; dx <= R1; dx += S1) {
      const s = evalAt(dx, dy);
      if (s > bs) { bs = s; bx = dx; by = dy; }
    }
  const R2 = p2 / 8, S2 = Math.max(1, p2 / 12);
  let fx = bx, fy = by;
  for (let dy = by - R2; dy <= by + R2; dy += S2)
    for (let dx = bx - R2; dx <= bx + R2; dx += S2) {
      const s = evalAt(dx, dy);
      if (s > bs) { bs = s; fx = dx; fy = dy; }
    }
  return { dx: fx, dy: fy };
}
