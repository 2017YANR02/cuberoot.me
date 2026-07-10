/**
 * tailhd-probe.ts — 末两段 1080p (2×) 重提取 + 倒序跟踪诊断。
 *
 * 发现 (tail-probe): 末两段在 960×540 下零可读网格, 但同帧 4K 原片肉眼直读 —
 * 55% 颜色墙部分是分辨率墙。此探针把尾窗 [倒二段起-5, 末split+25] 从原片抽成
 * 1920×1080 (面积参数 ×4), **倒序**喂 extractTrackedFrames (跟踪先验从干净的
 * 收尾静止帧向回传进拧转区), 逐帧对 {S0,S1,solved} 指派边缘化匹配。
 *
 * 用法: npx tsx scripts/tailhd-probe.ts [--video 3] [--fwd] [--res 1920x1080]
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import type { ColorName } from "../src/reconstruct.ts";
import { assignsForFaces } from "../src/anchored-search.ts";
import { IDENTITY_PERM, invertPerm, physicalPerm } from "../src/rotation-perms.ts";
import { activityMask, medianBackground, type FaceObservation } from "../src/sticker-blobs.ts";
import { extractTrackedFrames } from "../src/lattice-track.ts";

const argAt = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const ONLY = argAt("--video");
const FWD = process.argv.includes("--fwd");
const [W2, H2] = (argAt("--res") ?? "1920x1080").split("x").map(Number);
const SC = W2 / 960;

const COLOR_NAMES: readonly ColorName[] = ["W", "R", "G", "Y", "O", "B"];
const FACES = ["U", "R", "F", "D", "L", "B"] as const;
const ASSIGNS = FACES.flatMap((f) => assignsForFaces([f]).map((assign) => ({ face: f, assign })));

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}
const dump = JSON.parse(readFileSync(join(import.meta.dirname, "..", ".tmp", "obs-dump.json"), "utf8")) as {
  videos: { name: string; omega: number[] }[];
};

const videosDir = join(import.meta.dirname, "..", "videos");
for (const dv of dump.videos) {
  if (ONLY && !dv.name.startsWith(ONLY)) continue;
  const videoPath = join(videosDir, dv.name);
  const content = readFileSync(videoPath + ".splits.txt", "utf8");
  const { tokens, tailRotations } = parseGT(content);
  const splitFrames = parseSplitFrames(content);
  const omega = dv.omega;

  const fullSeq = [...tokens, ...tailRotations];
  const states: number[][] = [];
  const stateToks: string[] = [];
  {
    let cur = [...IDENTITY_PERM];
    for (let j = fullSeq.length - 1; j >= 0 && states.length < 2; j--) {
      cur = applyTo(cur, invertPerm(physicalPerm(fullSeq[j])));
      if (!ROTATION_TOKENS.has(fullSeq[j])) { states.push(cur); stateToks.push(fullSeq[j]); }
    }
  }
  const [s1, s0] = states;
  const cand: [string, readonly number[]][] = [["S0", s0], ["S1", s1], ["OK", IDENTITY_PERM]];
  const predColor = (state: readonly number[], f: number): ColorName =>
    COLOR_NAMES[Math.floor(omega[state[f]] / 9)];
  const bestOf = (colors: readonly (ColorName | null)[], state: readonly number[]) => {
    let best = { match: -1, read: 0, face: "B", rot: 0 };
    for (let ai = 0; ai < ASSIGNS.length; ai++) {
      const { face, assign } = ASSIGNS[ai];
      let m = 0, rd = 0;
      for (let i = 0; i < 9; i++) {
        const c = colors[i];
        if (!c) continue;
        rd++;
        if (predColor(state, assign[i]) === c) m++;
      }
      if (m > best.match) best = { match: m, read: rd, face, rot: ai % 4 };
    }
    return best;
  };

  // 尾窗 1080p 抽帧 (缓存 .tmp/)
  const spA = splitFrames[splitFrames.length - 3];
  const spB = splitFrames[splitFrames.length - 2];
  const spC = splitFrames[splitFrames.length - 1];
  const from = spA - 5, to = spC + 25;
  const binPath = join(import.meta.dirname, "..", ".tmp", `tailhd-${dv.name[0]}-${W2}.bin`);
  if (!existsSync(binPath)) {
    const args = [
      "-hide_banner", "-v", "error", "-threads", "12",
      "-i", videoPath,
      "-vf", `select=between(n\\,${from}\\,${to}),scale=${W2}:${H2}`,
      "-fps_mode", "passthrough", "-pix_fmt", "rgb24", "-f", "rawvideo", binPath, "-y",
    ];
    const res = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
    if (res.status !== 0) throw new Error(`ffmpeg failed on ${dv.name}`);
  }
  const frameBytes = W2 * H2 * 3;
  const nTail = Math.floor(statSync(binPath).size / frameBytes);
  const bin = readFileSync(binPath);
  const hdAt = (i: number) => new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);

  // mask: 960 framedump 重建再上采样 (activityMask 需全程帧, 尾窗内魔方不动会被中位污染)
  const meta = JSON.parse(readFileSync(videoPath + ".framedump.json", "utf8")) as { w: number; h: number; frames: number[] };
  const lb = readFileSync(videoPath + ".framedump.bin");
  const lowBytes = meta.w * meta.h * 3;
  const lowAt = (i: number) => new Uint8Array(lb.buffer, lb.byteOffset + i * lowBytes, lowBytes);
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (meta.frames.length - 1)) / 14));
  const bgFrames = bgIdx.map(lowAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask960 = activityMask(bgFrames, bg, meta.w, meta.h);
  const mask = new Uint8Array(W2 * H2);
  for (let y = 0; y < H2; y++) {
    const sy = Math.min(meta.h - 1, Math.floor(y / SC));
    for (let x = 0; x < W2; x++) {
      mask[y * W2 + x] = mask960[sy * meta.w + Math.min(meta.w - 1, Math.floor(x / SC))];
    }
  }

  // 倒序提取 (默认): i=0 是最后一帧
  const feed = (i: number) => hdAt(FWD ? i : nTail - 1 - i);
  const { grids: g0 } = extractTrackedFrames(feed, nTail, W2, H2, mask, {
    calib: null,
    anchor: true,
    minArea: Math.round(220 * SC * SC),
    maxArea: Math.round(4500 * SC * SC),
  });
  const grids: FaceObservation[][] = new Array(nTail);
  for (let i = 0; i < nTail; i++) grids[i] = g0[FWD ? i : nTail - 1 - i];

  console.log(`\n=== ${dv.name}  末二步 ${stateToks[1]} ${stateToks[0]}  (splits ${spA}/${spB}/${spC}, 尾窗 [${from}..${from + nTail - 1}] ${nTail} 帧, ${W2}×${H2}, ${FWD ? "正序" : "倒序"}) ===`);
  let n1 = 0, nAny = 0;
  for (let i = 0; i < nTail; i++) {
    const fr = from + i;
    const seg = fr < spB ? "倒2" : fr < spC ? "末段" : "收尾";
    for (const g of grids[i] ?? []) {
      const rd = g.colors.filter(Boolean).length;
      if (!rd) continue;
      nAny++;
      const scores = cand.map(([nm, st]) => {
        const b = bestOf(g.colors, st);
        return `${nm}=${b.match}/${b.read}(${b.face})`;
      });
      const b1 = bestOf(g.colors, s1);
      const winner = cand
        .map(([nm, st]) => ({ nm, m: bestOf(g.colors, st).match }))
        .sort((a, b) => b.m - a.m)[0];
      if (winner.nm === "S1" && b1.match / b1.read >= 0.7) n1++;
      console.log(`  f${fr} [${seg}] ${g.colors.map((c) => c ?? ".").join("")}  ${scores.join(" ")}  ← ${winner.nm}`);
    }
  }
  console.log(`  小结: 尾窗读出网格 ${nAny}, 其中 S1 胜出且 ≥70% 匹配: ${n1}`);
}
