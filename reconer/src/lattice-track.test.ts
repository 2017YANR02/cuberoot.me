import { describe, expect, it } from "vitest";
import { extractTrackedFrames, shiftFaceObs } from "./lattice-track.ts";
import type { Blob, FaceGrid, FaceObservation } from "./sticker-blobs.ts";
import type { ColorName } from "./reconstruct.ts";

const W = 260;
const H = 260;
const PITCH = 40;
const STICKER = 26;

function blankFrame(): Uint8Array {
  const f = new Uint8Array(W * H * 3);
  for (let i = 0; i < f.length; i += 3) {
    f[i] = 15;
    f[i + 1] = 15;
    f[i + 2] = 15;
  }
  return f;
}

const RGB: Record<ColorName, [number, number, number]> = {
  R: [200, 20, 20],
  O: [235, 120, 20],
  Y: [220, 210, 30],
  G: [20, 180, 40],
  B: [30, 60, 200],
  W: [240, 240, 240],
};

function paintSticker(f: Uint8Array, cx: number, cy: number, color: ColorName) {
  const [r, g, b] = RGB[color];
  const half = STICKER / 2;
  for (let y = Math.round(cy - half); y < cy + half; y++) {
    for (let x = Math.round(cx - half); x < cx + half; x++) {
      const p = (y * W + x) * 3;
      f[p] = r;
      f[p + 1] = g;
      f[p + 2] = b;
    }
  }
}

/** 3×3 面: 格 (r,c) 中心 = (70+40c, 70+40r), 行主序颜色 */
const FACE: ColorName[] = ["R", "G", "B", "Y", "O", "W", "G", "R", "B"];

function paintFace(f: Uint8Array, skip: (r: number, c: number) => boolean) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (skip(r, c)) continue;
      paintSticker(f, 70 + PITCH * c, 70 + PITCH * r, FACE[r * 3 + c]);
    }
  }
}

describe("shiftFaceObs", () => {
  it("窗口移 1 列: 原窗口外内点色块流入, 无色块格重采样", () => {
    const mkBlob = (gc: number, gr: number, color: ColorName): Blob => ({
      color,
      cx: 70 + PITCH * gc,
      cy: 70 + PITCH * gr,
      area: 500,
      r: RGB[color][0],
      g: RGB[color][1],
      b: RGB[color][2],
      w: STICKER,
      h: STICKER,
    });
    const inWin = FACE.map((col, i) => mkBlob(i % 3, Math.floor(i / 3), col));
    const extra = mkBlob(3, 0, "Y"); // 窗口右侧第 4 列的内点 (shift 后应流入)
    const grid: FaceGrid = {
      inlierBlobs: [...inWin, extra],
      cells: [...inWin],
      origin: { x: 70, y: 70 },
      v1: { x: PITCH, y: 0 },
      v2: { x: 0, y: PITCH },
      filled: 9,
      pitch: PITCH,
    };
    const obs: FaceObservation = { colors: [...FACE], grid, blobCount: 10 };
    // 全绿图: 无色块格采样应得 G
    const rgb = new Uint8Array(W * H * 3);
    for (let i = 0; i < rgb.length; i += 3) {
      rgb[i] = 20;
      rgb[i + 1] = 180;
      rgb[i + 2] = 40;
    }
    const s = shiftFaceObs(obs, 1, 0, rgb, W, H);
    expect(s.grid.origin).toEqual({ x: 110, y: 70 });
    // 新窗口列 c 对应旧列 c+1; 列 2 = 旧列 3 (extra 只在行 0)
    expect(s.colors).toEqual([
      FACE[1], FACE[2], "Y",
      FACE[4], FACE[5], "G",
      FACE[7], FACE[8], "G",
    ]);
    expect(s.grid.filled).toBe(7);
  });
});

describe("extractTrackedFrames 锚定", () => {
  it("部分遮挡重拟合的窗口被 snap 回参照位置, 格色与满帧一致", () => {
    const full = blankFrame();
    paintFace(full, () => false);
    const occluded = blankFrame();
    paintFace(occluded, (_r, c) => c === 2); // 右列遮挡 → 窗口平移歧义
    // pass1 建槽需要 ≥3 个冷拟合面, 前置几帧满面
    const frames = [full, full, full, full, occluded];
    const { grids, anchor } = extractTrackedFrames((i) => frames[i], frames.length, W, H, null, {
      anchor: true,
    });
    expect(grids[0].length).toBeGreaterThan(0);
    expect(grids[4].length).toBeGreaterThan(0);
    const g0 = grids[0][0].grid;
    const g1 = grids[4][0].grid;
    const center = (g: FaceGrid) => ({
      x: g.origin.x + g.v1.x + g.v2.x,
      y: g.origin.y + g.v1.y + g.v2.y,
    });
    const c0 = center(g0);
    const c1 = center(g1);
    // 锚定后窗口中心不漂移 (魔方没动)
    expect(Math.hypot(c1.x - c0.x, c1.y - c0.y)).toBeLessThan(0.5 * PITCH);
    // 可见列格色与满帧同位一致
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        expect(grids[4][0].colors[r * 3 + c]).toBe(grids[0][0].colors[r * 3 + c]);
      }
    }
    expect(anchor.matched).toBeGreaterThan(0);
  });
});
