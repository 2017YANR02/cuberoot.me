/**
 * debug-blobs.ts — 色块检测/网格拟合可视化 (画框输出 PNG 目检)。
 *
 * 用法: npx tsx scripts/debug-blobs.ts "videos/3 4.375.MP4" 681 748 812 917 1038 1086
 * 输出: <repo>/.tmp/png/recon-frames/blobs_<video>_<n>.png
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import {
  activityMask,
  cellCenter,
  clusterCubeBlobs,
  detectStickerBlobs,
  extractFaceObservation,
  medianBackground,
} from "../src/sticker-blobs.ts";

const [videoPath, ...frameArgs] = process.argv.slice(2);
if (!videoPath || frameArgs.length === 0) {
  console.error('用法: tsx scripts/debug-blobs.ts "videos/x.MP4" <frameNo...>');
  process.exit(1);
}

const meta = JSON.parse(readFileSync(videoPath + ".framedump.json", "utf8")) as {
  w: number;
  h: number;
  frames: number[];
};
const bin = readFileSync(videoPath + ".framedump.bin");
const frameBytes = meta.w * meta.h * 3;
const frameAt = (i: number) =>
  new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);

// 静物掩码: ~15 帧均匀取样, 跨帧稳定像素 = 静物
const bgIdx = Array.from({ length: 15 }, (_, i) =>
  Math.floor((i * (meta.frames.length - 1)) / 14),
);
const bgFrames = bgIdx.map(frameAt);
const bg = medianBackground(bgFrames, meta.w, meta.h);
const actMask = activityMask(bgFrames, bg, meta.w, meta.h);

const outDir = join(import.meta.dirname, "..", "..", ".tmp", "png", "recon-frames");
mkdirSync(outDir, { recursive: true });

const MARK: Record<string, [number, number, number]> = {
  W: [255, 255, 255], R: [255, 0, 0], O: [255, 128, 0],
  Y: [255, 255, 0], G: [0, 255, 0], B: [0, 128, 255],
};

function drawRect(img: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) {
  for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
    for (const y of [y0, y1]) {
      if (y < 0 || y >= h) continue;
      const p = (y * w + x) * 3;
      img[p] = c[0]; img[p + 1] = c[1]; img[p + 2] = c[2];
    }
  }
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    for (const x of [x0, x1]) {
      if (x < 0 || x >= w) continue;
      const p = (y * w + x) * 3;
      img[p] = c[0]; img[p + 1] = c[1]; img[p + 2] = c[2];
    }
  }
}

for (const fa of frameArgs) {
  const n = parseInt(fa, 10);
  const idx = meta.frames.indexOf(n);
  if (idx < 0) {
    console.warn(`帧 ${n} 不在 dump 里`);
    continue;
  }
  const rgb = frameAt(idx).slice();
  const blobs = detectStickerBlobs(rgb, meta.w, meta.h, { mask: actMask });
  const cluster = clusterCubeBlobs(blobs);
  const obs = extractFaceObservation(rgb, meta.w, meta.h, actMask);

  // 所有色块细框; 簇内色块再加白框
  for (const b of blobs) {
    drawRect(rgb, meta.w, meta.h, Math.round(b.cx - b.w / 2), Math.round(b.cy - b.h / 2), Math.round(b.cx + b.w / 2), Math.round(b.cy + b.h / 2), MARK[b.color]);
  }
  for (const b of cluster ?? []) {
    drawRect(rgb, meta.w, meta.h, Math.round(b.cx - b.w / 2) - 2, Math.round(b.cy - b.h / 2) - 2, Math.round(b.cx + b.w / 2) + 2, Math.round(b.cy + b.h / 2) + 2, [255, 255, 255]);
  }
  // 9 格外插格心: 采样成功 → 对应色小实框; 失败 → 品红
  if (obs) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const { x, y } = cellCenter(obs.grid, r, c);
        const col = obs.colors[r * 3 + c];
        const m: [number, number, number] = col ? MARK[col] : [255, 0, 255];
        drawRect(rgb, meta.w, meta.h, Math.round(x) - 4, Math.round(y) - 4, Math.round(x) + 4, Math.round(y) + 4, m);
        drawRect(rgb, meta.w, meta.h, Math.round(x) - 5, Math.round(y) - 5, Math.round(x) + 5, Math.round(y) + 5, m);
      }
    }
  }
  const colorsStr = obs ? obs.colors.map((c) => c ?? "_").join("") : "-";
  console.log(`帧 ${n}: blobs=${blobs.length} 簇=${cluster?.length ?? 0} grid=${obs ? `${obs.grid.filled}/9 pitch=${obs.grid.pitch.toFixed(1)}` : "null"} cells=${colorsStr}`);
  if (process.argv.includes("--verbose")) {
    for (const b of blobs) {
      const inC = cluster?.includes(b) ? "簇" : "  ";
      console.log(`  ${inC} (${b.cx.toFixed(0)},${b.cy.toFixed(0)}) ${b.w}x${b.h} a=${b.area} ${b.color}`);
    }
    if (obs) {
      console.log(`  v1=(${obs.grid.v1.x.toFixed(1)},${obs.grid.v1.y.toFixed(1)}) v2=(${obs.grid.v2.x.toFixed(1)},${obs.grid.v2.y.toFixed(1)})`);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const ctr = cellCenter(obs.grid, r, c);
          const b = obs.grid.cells[r * 3 + c];
          console.log(`  cell(${r},${c}) 中心(${ctr.x.toFixed(0)},${ctr.y.toFixed(0)}) ${b ? `blob(${b.cx.toFixed(0)},${b.cy.toFixed(0)})${b.color}` : "无块"} → ${obs.colors[r * 3 + c] ?? "_"}`);
        }
      }
    }
  }

  const ppm = join(outDir, `_tmp_${n}.ppm`);
  writeFileSync(ppm, Buffer.concat([Buffer.from(`P6\n${meta.w} ${meta.h}\n255\n`), Buffer.from(rgb)]));
  const png = join(outDir, `blobs_${basename(videoPath).replace(/[^\w]/g, "_")}_${n}.png`);
  execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", ppm, png]);
  rmSync(ppm);
}
console.log(`输出目录: ${outDir}`);
