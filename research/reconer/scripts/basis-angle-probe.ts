/**
 * basis-angle-probe.ts — 基向量角度随时间漂移探针 (旋转身份不稳根因诊断)。
 *
 * 假设: 锚定血统内 v1 角度随机游走 ±5-10°/次, 累积跨 45° → 链间旋转身份翻转
 * (每步 reorient 连续但整体走半圈)。若角度范围 (p90-p10) 接近或超过 45° 则实锤。
 *
 * 用法: npx tsx scripts/basis-angle-probe.ts [--noanchor]
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractTrackedFrames } from "../src/lattice-track.ts";
import { activityMask, medianBackground } from "../src/sticker-blobs.ts";

const NO_ANCHOR = process.argv.includes("--noanchor");
const videosDir = join(import.meta.dirname, "..", "videos");
const files = readdirSync(videosDir).filter((f) => f.endsWith(".framedump.json")).sort();

for (const jf of files) {
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
  const { grids } = extractTrackedFrames(frameAt, n, meta.w, meta.h, mask, { anchor: !NO_ANCHOR });

  // 双槽分开统计 (按中心 y 中位分界); 只看冷拟合帧 (blobCount>0, 跟踪帧继承基没信息)
  const entries: { i: number; cy: number; ang: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (const o of grids[i]) {
      if (o.blobCount === 0) continue;
      const g = o.grid;
      entries.push({
        i,
        cy: g.origin.y + g.v1.y + g.v2.y,
        ang: (Math.atan2(g.v1.y, g.v1.x) * 180) / Math.PI,
      });
    }
  }
  const cys = entries.map((e) => e.cy).sort((a, b) => a - b);
  const cyMed = cys[cys.length >> 1] ?? 0;
  for (const [slot, es] of [
    ["B(下)", entries.filter((e) => e.cy >= cyMed)],
    ["U(上)", entries.filter((e) => e.cy < cyMed)],
  ] as const) {
    if (es.length < 5) continue;
    const angs = es.map((e) => e.ang).sort((a, b) => a - b);
    const q = (p: number) => angs[Math.min(angs.length - 1, Math.floor(p * angs.length))];
    // 逐次跳变: 相邻冷拟合的角度差 (>30° 记翻转事件)
    let jumps = 0;
    const sorted = [...es].sort((a, b) => a.i - b.i);
    for (let k = 1; k < sorted.length; k++) {
      let d = Math.abs(sorted[k].ang - sorted[k - 1].ang);
      if (d > 180) d = 360 - d;
      if (d > 30) jumps++;
    }
    console.log(
      `${meta.video} ${slot}: ${es.length} 冷拟合  角度 min=${angs[0].toFixed(0)} p10=${q(0.1).toFixed(0)} p50=${q(0.5).toFixed(0)} p90=${q(0.9).toFixed(0)} max=${angs[angs.length - 1].toFixed(0)}  范围(p90-p10)=${(q(0.9) - q(0.1)).toFixed(0)}°  跳变(>30°)=${jumps}`,
    );
  }
}
