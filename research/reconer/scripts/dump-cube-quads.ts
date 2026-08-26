/**
 * dump-cube-quads.ts — 手部通道数据准备: 每帧魔方晶格 (可见面仿射基)。
 *
 * 与 real-eval extractAllGrids 同款冷检测+跟踪环 (无标定), 每帧 dump 首网格的
 * {origin, v1, v2} (格 (r,c) 中心 = origin + c·v1 + r·v2), 供 Python 侧把指尖
 * 投到魔方格坐标系 (双掌中点代理在拧转中漂移, 晶格才是真锚)。
 *
 * 用法: npx tsx scripts/dump-cube-quads.ts
 * 输出: hands/data/quads.json — { [video]: (null | number[6])[] } (ox,oy,v1x,v1y,v2x,v2y)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  activityMask,
  extractFaceObservations,
  medianBackground,
  reorientObsToBasis,
  trackFaceGrid,
  type FaceGrid,
  type FaceObservation,
} from "../src/sticker-blobs.ts";
import type { ColorName } from "../src/reconstruct.ts";

const videosDir = join(import.meta.dirname, "..", "videos");
const outDir = join(import.meta.dirname, "..", "hands", "data");

const out: Record<string, (number[] | null)[]> = {};

for (const jf of readdirSync(videosDir).filter((f) => f.endsWith(".framedump.json")).sort()) {
  const meta = JSON.parse(readFileSync(join(videosDir, jf), "utf8")) as {
    video: string;
    w: number;
    h: number;
    frames: number[];
  };
  const binPath = join(videosDir, jf.replace(/\.framedump\.json$/, ".framedump.bin"));
  if (!existsSync(binPath)) continue;
  const bin = readFileSync(binPath);
  const frameBytes = meta.w * meta.h * 3;
  const frameAt = (i: number) => new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);
  const n = meta.frames.length;
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (n - 1)) / 14));
  const bgFrames = bgIdx.map(frameAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask = activityMask(bgFrames, bg, meta.w, meta.h);

  const quads: (number[] | null)[] = new Array(n).fill(null);
  let prior: FaceGrid | null = null;
  let priorColors: readonly (ColorName | null)[] | null = null;
  let priorMiss = 0;
  let nGrid = 0;
  for (let i = 0; i < n; i++) {
    const cold = extractFaceObservations(frameAt(i), meta.w, meta.h, mask, {});
    let grid: FaceGrid | null = null;
    if (cold.length) {
      // 多面时取图像中最低者 (此机位 B 面恒在 U 面下方), 防 span 间 B/U 面漂移
      let bi = 0;
      let bestY = -Infinity;
      for (let k = 0; k < cold.length; k++) {
        const g = cold[k].grid;
        const cy = g.origin.y + g.v1.y + g.v2.y;
        if (cy > bestY) {
          bestY = cy;
          bi = k;
        }
      }
      const chosen: FaceObservation = prior
        ? reorientObsToBasis(cold[bi], prior.v1, prior.v2)
        : cold[bi];
      grid = chosen.grid;
      priorColors = chosen.colors;
    } else {
      const tracked: FaceObservation | null = prior
        ? trackFaceGrid(frameAt(i), meta.w, meta.h, prior, priorColors, {})
        : null;
      if (tracked) {
        grid = tracked.grid;
        priorColors = tracked.colors;
      }
    }
    if (grid) {
      quads[i] = [grid.origin.x, grid.origin.y, grid.v1.x, grid.v1.y, grid.v2.x, grid.v2.y];
      prior = grid;
      priorMiss = 0;
      nGrid++;
    } else if (prior && ++priorMiss > 5) {
      prior = null;
      priorColors = null;
    }
  }
  out[meta.video] = quads;
  console.log(`${meta.video}: ${nGrid}/${n} 帧有晶格 (${((nGrid / n) * 100).toFixed(0)}%)`);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "quads.json"), JSON.stringify(out));
console.log(`写出 ${join(outDir, "quads.json")}`);
