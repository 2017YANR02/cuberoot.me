/**
 * tail-probe.ts — 末两段帧级诊断: 倒数第一步的观测到底在不在帧里。
 *
 * 只对 [倒数第二段起, 视频尾] 窗口做提取, 逐帧打印每网格 vivid 读数, 并对
 * {S0(倒二步前态), S1(末步前态), solved} 三态做指派边缘化最优匹配 (omega 从
 * obs-dump 取, 诊断口径)。回答: v3/v4 末边界 0 链是"帧里没有"还是"链化丢了"。
 *
 * 用法: npx tsx scripts/tail-probe.ts [--video 3]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import type { ColorName } from "../src/reconstruct.ts";
import { assignsForFaces } from "../src/anchored-search.ts";
import { IDENTITY_PERM, invertPerm, physicalPerm } from "../src/rotation-perms.ts";
import { activityMask, medianBackground } from "../src/sticker-blobs.ts";
import { extractTrackedFrames } from "../src/lattice-track.ts";

const argAt = (name: string): string | null => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const ONLY = argAt("--video");

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
  const dumpJson = videoPath + ".framedump.json";
  if (!existsSync(dumpJson)) continue;
  const content = readFileSync(videoPath + ".splits.txt", "utf8");
  const { tokens, tailRotations } = parseGT(content);
  const splitFrames = parseSplitFrames(content);
  const omega = dv.omega;

  // 末三个状态: 从复原态逆放 (含尾部转体)
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
  const [s1, s0] = states; // s1 = 末步前态, s0 = 倒二步前态
  const cand: [string, readonly number[]][] = [
    ["S0", s0],
    ["S1", s1],
    ["OK", IDENTITY_PERM],
  ];
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

  // 尾窗提取: 从倒数第二段起点到 dump 末尾
  const meta = JSON.parse(readFileSync(dumpJson, "utf8")) as { w: number; h: number; frames: number[] };
  const bin = readFileSync(videoPath + ".framedump.bin");
  const frameBytes = meta.w * meta.h * 3;
  const frameAt = (i: number) => new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (meta.frames.length - 1)) / 14));
  const bgFrames = bgIdx.map(frameAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask = activityMask(bgFrames, bg, meta.w, meta.h);
  const spA = splitFrames[splitFrames.length - 3]; // 倒二段起
  const spB = splitFrames[splitFrames.length - 2]; // 末段起
  const spC = splitFrames[splitFrames.length - 1]; // 末段终 (最后 split)
  let i0 = meta.frames.findIndex((f) => f >= spA);
  if (i0 < 0) i0 = 0;
  const nTail = meta.frames.length - i0;
  const { grids } = extractTrackedFrames((i) => frameAt(i0 + i), nTail, meta.w, meta.h, mask, {
    calib: null,
    anchor: true,
  });

  console.log(`\n=== ${dv.name}  末二步 ${stateToks[1]} ${stateToks[0]}  (splits ${spA}/${spB}/${spC}, 尾窗 ${nTail} 帧) ===`);
  let n1 = 0, nAny = 0;
  for (let i = 0; i < nTail; i++) {
    const fr = meta.frames[i0 + i];
    const seg = fr < spB ? "倒2" : fr < spC ? "末段" : "收尾";
    for (const g of grids[i]) {
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
      console.log(
        `  f${fr} [${seg}] ${g.colors.map((c) => c ?? ".").join("")}  ${scores.join(" ")}  ← ${winner.nm}`,
      );
    }
  }
  console.log(`  小结: 尾窗读出网格 ${nAny}, 其中 S1 胜出且 ≥70% 匹配: ${n1}`);
}
