/**
 * diag-offsets.ts — 采样时机诊断: 各偏移 (-2/0/+2/+5) 的提取质量对照。
 *
 * 用已金标验证重标的视频 (video 3 = y2), 逐边界 × 逐偏移算提取 vs GT 匹配率,
 * 回答: splits 点附近哪个时刻状态稳定可读 (定位 mid-move 时机问题)。
 *
 * 用法: npx tsx scripts/diag-offsets.ts [--video 3] [--relabel y2]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import type { ColorName } from "../src/reconstruct.ts";
import {
  IDENTITY_PERM,
  ORIENTATION_PERMS,
  ROTATION_PERMS,
  invertPerm,
  permKey,
  physicalPerm,
} from "../src/rotation-perms.ts";
import { activityMask, extractFaceObservation, medianBackground } from "../src/sticker-blobs.ts";

const vArg = process.argv.indexOf("--video");
const VIDEO = vArg >= 0 ? process.argv[vArg + 1] : "3";
const rArg = process.argv.indexOf("--relabel");
const RELABEL = rArg >= 0 ? process.argv[rArg + 1] : "y2";

const COLOR_NAMES: readonly ColorName[] = ["W", "R", "G", "Y", "O", "B"];

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}

const videosDir = join(import.meta.dirname, "..", "videos");
const { readdirSync } = await import("node:fs");
const sf = readdirSync(videosDir).find((f) => f.endsWith(".splits.txt") && f.startsWith(VIDEO));
if (!sf) throw new Error(`无视频 ${VIDEO}`);
const splitsPath = join(videosDir, sf);
const videoPath = splitsPath.replace(/\.splits\.txt$/, "");
if (!existsSync(videoPath + ".framedump.json")) throw new Error("无 dump");

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

const rho = RELABEL === "id" ? IDENTITY_PERM : ROTATION_PERMS[RELABEL];
if (!rho) throw new Error(`未知重标 ${RELABEL}`);
console.log(`relabel=${RELABEL} (朝向下标 ${ORIENTATION_PERMS.findIndex((p) => permKey(p) === permKey(rho))})`);

const meta = JSON.parse(readFileSync(videoPath + ".framedump.json", "utf8")) as {
  w: number; h: number; frames: number[]; offsets: number[];
};
const bin = readFileSync(videoPath + ".framedump.bin");
const frameBytes = meta.w * meta.h * 3;
const frameAt = (i: number) => new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);
const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (meta.frames.length - 1)) / 14));
const bgFrames = bgIdx.map(frameAt);
const bg = medianBackground(bgFrames, meta.w, meta.h);
const mask = activityMask(bgFrames, bg, meta.w, meta.h);

const nonRotIdx = tokens.map((t, j) => (ROTATION_TOKENS.has(t) ? -1 : j)).filter((j) => j >= 0);

const stats = new Map<number, { n: number; read: number; ok: number; good: number }>();
for (const off of meta.offsets) stats.set(off, { n: 0, read: 0, ok: 0, good: 0 });

for (let t = 0; t < nonRotIdx.length; t++) {
  const state = startState[nonRotIdx[t]];
  const row: string[] = [];
  for (const off of meta.offsets) {
    const idx = meta.frames.indexOf(splitFrames[nonRotIdx[t]] + off);
    if (idx < 0) { row.push("   ."); continue; }
    const e = extractFaceObservation(frameAt(idx), meta.w, meta.h, mask);
    if (!e) { row.push("   -"); continue; }
    const s = stats.get(off)!;
    s.n++;
    let read = 0, ok = 0;
    for (let cam = 0; cam < 9; cam++) {
      const col = e.colors[cam];
      if (!col) continue;
      read++;
      const expected = COLOR_NAMES[Math.floor(rho[state[45 + cam] as number] / 9)];
      if (col === expected) ok++;
    }
    s.read += read;
    s.ok += ok;
    if (read >= 6 && ok / read >= 0.75) s.good++;
    row.push(`${ok}/${read}`.padStart(4));
  }
  console.log(`seg${String(t).padStart(2)} [${tokens[nonRotIdx[t]].padEnd(4)}] ${row.join("  ")}`);
}

console.log(`\n偏移   有观测  逐格准确率  好帧(≥6读且≥75%)`);
for (const off of meta.offsets) {
  const s = stats.get(off)!;
  console.log(
    `${String(off).padStart(3)}    ${String(s.n).padStart(3)}/${nonRotIdx.length}   ${s.read ? ((100 * s.ok) / s.read).toFixed(1) : "-"}% (${s.ok}/${s.read})   ${s.good}`,
  );
}
