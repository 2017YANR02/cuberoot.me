/**
 * diag-face-identity.ts — 提取网格到底拍到的是哪个面?
 *
 * 对每个成功提取的边界帧: 拿 GT 回放真值态, 对 6 面 × 8 二面体全组合算匹配率,
 * 报每帧赢家 + 汇总直方图。若赢家匹配率高但面身份分散 → 颜色读取 OK,
 * 需要多假设面分配; 若普遍低 → 颜色读取本身坏。
 *
 * 用法: npx tsx scripts/diag-face-identity.ts [--video 3]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import type { ColorName } from "../src/reconstruct.ts";
import { IDENTITY_PERM, invertPerm, physicalPerm } from "../src/rotation-perms.ts";
import { activityMask, extractFaceObservation, medianBackground, type FaceObservation } from "../src/sticker-blobs.ts";

const vArg = process.argv.indexOf("--video");
const ONLY = vArg >= 0 ? process.argv[vArg + 1] : null;

const COLOR_NAMES: readonly ColorName[] = ["W", "R", "G", "Y", "O", "B"];
const FACE_NAMES = ["U", "R", "F", "D", "L", "B"] as const;

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}

const DIHEDRAL: readonly (readonly number[])[] = (() => {
  const rot = (m: readonly number[]) => [m[6], m[3], m[0], m[7], m[4], m[1], m[8], m[5], m[2]];
  const flip = (m: readonly number[]) => [m[2], m[1], m[0], m[5], m[4], m[3], m[8], m[7], m[6]];
  const out: number[][] = [];
  let cur: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 0; i < 4; i++) {
    out.push([...cur], flip(cur));
    cur = rot(cur);
  }
  return out;
})();

const videosDir = join(import.meta.dirname, "..", "videos");
const files = readdirSync(videosDir)
  .filter((f) => f.endsWith(".splits.txt"))
  .filter((f) => !ONLY || f.startsWith(ONLY))
  .sort();

const winnerHist = new Map<string, number>();
let sumBestMatch = 0, sumRead = 0, frames = 0;

for (const sf of files) {
  const splitsPath = join(videosDir, sf);
  const videoPath = splitsPath.replace(/\.splits\.txt$/, "");
  if (!existsSync(videoPath + ".framedump.json")) continue;
  const content = readFileSync(splitsPath, "utf8");
  const { tokens, tailRotations } = parseGT(content);
  const splitFrames = parseSplitFrames(content);

  const fullSeq = [...tokens, ...tailRotations];
  const startState: number[][] = new Array(fullSeq.length);
  let cur: number[] = [...IDENTITY_PERM];
  for (let j = fullSeq.length - 1; j >= 0; j--) {
    cur = applyTo(cur, invertPerm(physicalPerm(fullSeq[j])));
    startState[j] = cur;
  }

  const meta = JSON.parse(readFileSync(videoPath + ".framedump.json", "utf8")) as { w: number; h: number; frames: number[] };
  const bin = readFileSync(videoPath + ".framedump.bin");
  const frameBytes = meta.w * meta.h * 3;
  const frameAt = (i: number) => new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (meta.frames.length - 1)) / 14));
  const bgFrames = bgIdx.map(frameAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask = activityMask(bgFrames, bg, meta.w, meta.h);

  const nonRotIdx = tokens.map((t, j) => (ROTATION_TOKENS.has(t) ? -1 : j)).filter((j) => j >= 0);
  const name = basename(videoPath).replace(/\.MP4$/i, "");

  for (let t = 0; t < nonRotIdx.length; t++) {
    let best: FaceObservation | null = null;
    for (const off of [2, 5]) {
      const idx = meta.frames.indexOf(splitFrames[nonRotIdx[t]] + off);
      if (idx < 0) continue;
      const o = extractFaceObservation(frameAt(idx), meta.w, meta.h, mask);
      if (o && (!best || o.colors.filter(Boolean).length > best.colors.filter(Boolean).length)) best = o;
    }
    if (!best) continue;
    const read = best.colors.filter(Boolean).length;
    if (read < 4) continue;

    const state = startState[nonRotIdx[t]];
    let bm = -1, bf = 0, bd = 0;
    for (let f = 0; f < 6; f++) {
      for (let d = 0; d < 8; d++) {
        let m = 0;
        for (let cell = 0; cell < 9; cell++) {
          const col = best.colors[DIHEDRAL[d][cell]];
          if (!col) continue;
          if (col === COLOR_NAMES[Math.floor(state[f * 9 + cell] / 9)]) m++;
        }
        if (m > bm) { bm = m; bf = f; bd = d; }
      }
    }
    frames++;
    sumBestMatch += bm;
    sumRead += read;
    const key = `${FACE_NAMES[bf]}/d${bd}`;
    winnerHist.set(key, (winnerHist.get(key) ?? 0) + 1);
    console.log(`${name} seg${t}: 读${read}格 最佳=${FACE_NAMES[bf]}/d${bd} 匹配${bm}/${read}`);
  }
}

console.log(`\n===== ${frames} 帧, 赢家匹配率 ${(100 * sumBestMatch / Math.max(1, sumRead)).toFixed(1)}% (乱猜基线 ~30-40%, 48 假设择优有虚高) =====`);
console.log([...winnerHist.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join("  "));
