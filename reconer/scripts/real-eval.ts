/**
 * real-eval.ts — 真实提取评测: 逐格准确率 (vs GT 物理回放) + 端到端锚定搜索。
 *
 * 流程 (每视频):
 *   1. GT 物理回放 → 每 token 段起点空间态 (真值)
 *   2. framedump 每边界帧 (+2/+5 选优) → extractFaceObservation → 相机 3×3 颜色
 *   3. 相机格 → facelet 45..53 (镜像重排), 与真值逐格对比
 *      全局常数: 24 旋转色重标 (GT 记谱系 vs 相机系的固定差) 按整视频拟合
 *   4. --search: 真观测 + probs 喂 anchoredBeamSearch, 报锚定/逐段准确率
 *
 * 用法: npx tsx scripts/real-eval.ts [--search] [--video 3] [--variants]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import type { ProbDist, ColorName } from "../src/reconstruct.ts";
import {
  anchoredBeamSearch,
  normalizeToken,
  type Observation,
  type RawFaceObs,
  type SegObservations,
} from "../src/anchored-search.ts";
import {
  IDENTITY_PERM,
  ORIENTATION_PERMS,
  invertPerm,
  physicalPerm,
} from "../src/rotation-perms.ts";
import { activityMask, extractFaceObservation, medianBackground, type FaceObservation } from "../src/sticker-blobs.ts";

const DO_SEARCH = process.argv.includes("--search");
const DO_VARIANTS = process.argv.includes("--variants"); // 8 二面体变体核对镜像约定
const vArg = process.argv.indexOf("--video");
const ONLY = vArg >= 0 ? process.argv[vArg + 1] : null;
const beamArg = process.argv.indexOf("--beam");
const BEAM = beamArg >= 0 ? parseInt(process.argv[beamArg + 1], 10) : 2048;

const COLOR_NAMES: readonly ColorName[] = ["W", "R", "G", "Y", "O", "B"];

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}

/**
 * 相机 3×3 (行主序) → B 面 facelet 偏移。
 * 经 video3 帧 681 vs 回放打乱态逐贴纸金标比对: 直接同序, 无列镜像
 * (bface-color.ts 的镜像约定与本状态机 B 面布局不符, 勿沿用)。
 */
const CAM_TO_BIDX = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** 8 个二面体变体 (行/列翻转+转置), 用于一次性核对镜像约定 */
const DIHEDRAL: readonly (readonly number[])[] = (() => {
  const base = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const rot = (m: readonly number[]) => [m[6], m[3], m[0], m[7], m[4], m[1], m[8], m[5], m[2]];
  const flip = (m: readonly number[]) => [m[2], m[1], m[0], m[5], m[4], m[3], m[8], m[7], m[6]];
  const out: number[][] = [];
  let cur = base;
  for (let i = 0; i < 4; i++) {
    out.push([...cur], flip(cur));
    cur = rot(cur);
  }
  return out;
})();

interface VideoEval {
  name: string;
  nBounds: number;
  covered: number;
  cellsRead: number;
  cellsCorrect: number;
  relabel: number; // 拟合出的旋转重标下标
  confusion: Map<string, number>;
  obsPerSeg: SegObservations[];
  finalObs: Observation[] | null;
  rawObs: (RawFaceObs | null)[];
  finalRawObs: RawFaceObs | null;
  probs: ProbDist[];
  scrambleSc: readonly number[];
  gtTokens: string[];
  gtNoRot: string[];
}

const videosDir = join(import.meta.dirname, "..", "videos");
const files = readdirSync(videosDir)
  .filter((f) => f.endsWith(".splits.txt"))
  .filter((f) => !ONLY || f.startsWith(ONLY))
  .sort();

const evals: VideoEval[] = [];

for (const sf of files) {
  const splitsPath = join(videosDir, sf);
  const videoPath = splitsPath.replace(/\.splits\.txt$/, "");
  const dumpJson = videoPath + ".framedump.json";
  if (!existsSync(dumpJson)) {
    console.warn(`跳过 (无 dump): ${sf}`);
    continue;
  }
  const content = readFileSync(splitsPath, "utf8");
  const probs = JSON.parse(readFileSync(videoPath + ".probs.json", "utf8")) as ProbDist[];
  const { tokens, tailRotations } = parseGT(content);
  const gtNoRot = tokens.filter((t) => !ROTATION_TOKENS.has(t));
  const splitFrames = parseSplitFrames(content);

  // GT 物理回放 (相机系 = GT 记谱系, 相差常数旋转由 relabel 拟合吸收)
  const fullSeq = [...tokens, ...tailRotations];
  const startState: number[][] = new Array(fullSeq.length);
  let cur: number[] = [...IDENTITY_PERM];
  for (let j = fullSeq.length - 1; j >= 0; j--) {
    cur = applyTo(cur, invertPerm(physicalPerm(fullSeq[j])));
    startState[j] = cur;
  }
  const scrambleSc = cur;

  // dump 读取
  const meta = JSON.parse(readFileSync(dumpJson, "utf8")) as { w: number; h: number; frames: number[] };
  const bin = readFileSync(videoPath + ".framedump.bin");
  const frameBytes = meta.w * meta.h * 3;
  const frameAt = (i: number) => new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (meta.frames.length - 1)) / 14));
  const bgFrames = bgIdx.map(frameAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask = activityMask(bgFrames, bg, meta.w, meta.h);

  /** 边界帧提取: 多偏移扫描取可读格数最多者 (≥6 提前收) */
  const extractAt = (splitFrame: number): FaceObservation | null => {
    let best: FaceObservation | null = null;
    for (const off of [0, -1, 2, -2, 1, 5]) {
      const idx = meta.frames.indexOf(splitFrame + off);
      if (idx < 0) continue;
      const o = extractFaceObservation(frameAt(idx), meta.w, meta.h, mask);
      if (o && (!best || o.colors.filter(Boolean).length > best.colors.filter(Boolean).length)) {
        best = o;
      }
      if (best && best.colors.filter(Boolean).length >= 6) break;
    }
    return best;
  };

  // 逐边界提取 (非转体 token 段起点, 与 probs 对齐) + 末点
  const nonRotIdx = tokens.map((t, j) => (ROTATION_TOKENS.has(t) ? -1 : j)).filter((j) => j >= 0);
  const extracted: (FaceObservation | null)[] = nonRotIdx.map((j) => extractAt(splitFrames[j]));
  const finalExtracted = extractAt(splitFrames[splitFrames.length - 1]);

  // 24 旋转色重标: 逐帧算各自赢家, 取众数 (鲁棒 — 全局求和会被垃圾帧拖跑)
  const variants = DO_VARIANTS ? DIHEDRAL : [DIHEDRAL[0]];
  const frameVotes = new Map<string, number>();
  for (let t = 0; t < extracted.length; t++) {
    const e = extracted[t];
    if (!e || e.colors.filter(Boolean).length < 5) continue;
    const state = startState[nonRotIdx[t]];
    let fBest = -1, fKey = "";
    for (let vi = 0; vi < variants.length; vi++) {
      for (let ri = 0; ri < 24; ri++) {
        const rho = ORIENTATION_PERMS[ri];
        let ok = 0;
        for (let cam = 0; cam < 9; cam++) {
          const col = e.colors[variants[vi][cam]];
          if (!col) continue;
          if (col === COLOR_NAMES[Math.floor(rho[state[45 + CAM_TO_BIDX[cam]]] / 9)]) ok++;
        }
        if (ok > fBest) {
          fBest = ok;
          fKey = `${ri},${vi}`;
        }
      }
    }
    if (fBest >= 4) frameVotes.set(fKey, (frameVotes.get(fKey) ?? 0) + 1);
  }
  const modeKey = [...frameVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "0,0";
  const [bestRelabel, bestVariant] = modeKey.split(",").map(Number);
  const rho = ORIENTATION_PERMS[bestRelabel];
  const vmap = variants[bestVariant];
  // 回放系颜色 ↔ 相机系颜色 (常数重标; 约定成立时应为恒等)
  const camOf = {} as Record<ColorName, ColorName>;
  const invCam = {} as Record<ColorName, ColorName>;
  for (let f = 0; f < 6; f++) camOf[COLOR_NAMES[f]] = COLOR_NAMES[Math.floor(rho[f * 9 + 4] / 9)];
  for (const c of COLOR_NAMES) invCam[camOf[c]] = c;

  // 统计 + 生成搜索观测 (观测颜色反重标回回放系, 打乱态原样)
  let covered = 0, cellsRead = 0, cellsCorrect = 0;
  const confusion = new Map<string, number>();
  const obsPerSeg: SegObservations[] = [];
  for (let t = 0; t < extracted.length; t++) {
    const e = extracted[t];
    if (!e) {
      obsPerSeg.push(null);
      continue;
    }
    covered++;
    const state = startState[nonRotIdx[t]];
    const obs: Observation[] = [];
    for (let cam = 0; cam < 9; cam++) {
      const col = e.colors[vmap[cam]];
      if (!col) continue;
      cellsRead++;
      const bidx = CAM_TO_BIDX[cam];
      const expected = camOf[COLOR_NAMES[Math.floor(state[45 + bidx] / 9)]];
      if (col === expected) cellsCorrect++;
      confusion.set(`${expected}→${col}`, (confusion.get(`${expected}→${col}`) ?? 0) + 1);
      obs.push({ idx: 45 + bidx, dist: { [invCam[col]]: 1 } });
    }
    obsPerSeg.push(obs.length ? obs : null);
  }
  const finalObs: Observation[] | null = finalExtracted
    ? finalExtracted.colors
        .map((_, cam) => ({ cam, col: finalExtracted.colors[vmap[cam]] }))
        .filter((x) => x.col)
        .map((x) => ({ idx: 45 + CAM_TO_BIDX[x.cam], dist: { [invCam[x.col!]]: 1 } }))
    : null;

  const name = basename(videoPath).replace(/\.MP4$/i, "");
  evals.push({
    name,
    nBounds: extracted.length,
    covered,
    cellsRead,
    cellsCorrect,
    relabel: bestRelabel,
    confusion,
    obsPerSeg,
    finalObs,
    // 原始相机网格 (面身份/色重标由搜索的 24 指派 × 24 朝向自然吸收)
    rawObs: extracted.map((e) => (e ? { colors: e.colors } : null)),
    finalRawObs: finalExtracted ? { colors: finalExtracted.colors } : null,
    probs,
    scrambleSc,
    gtTokens: tokens,
    gtNoRot,
  });

  const acc = cellsRead ? ((cellsCorrect / cellsRead) * 100).toFixed(1) : "-";
  console.log(
    `${name}: 边界 ${covered}/${extracted.length} 有观测, 读格 ${cellsRead} (均 ${(cellsRead / Math.max(1, covered)).toFixed(1)}/帧), 逐格 ${acc}%  [relabel=${bestRelabel}${DO_VARIANTS ? ` variant=${bestVariant}` : ""}]  末帧=${finalObs ? finalObs.length + "格" : "无"}`,
  );
  const errs = [...confusion.entries()].filter(([k]) => k[0] !== k[2]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (errs.length) console.log(`  主要混淆: ${errs.map(([k, n]) => `${k}×${n}`).join("  ")}`);
}

// 汇总
const totRead = evals.reduce((s, e) => s + e.cellsRead, 0);
const totOk = evals.reduce((s, e) => s + e.cellsCorrect, 0);
const totCov = evals.reduce((s, e) => s + e.covered, 0);
const totBounds = evals.reduce((s, e) => s + e.nBounds, 0);
console.log(
  `\n===== 提取汇总: 覆盖 ${totCov}/${totBounds} = ${((totCov / totBounds) * 100).toFixed(1)}%, 逐格 ${totOk}/${totRead} = ${totRead ? ((totOk / totRead) * 100).toFixed(1) : "-"}% (75% 为搜索可用线) =====`,
);

if (DO_SEARCH) {
  console.log("\n===== 端到端锚定搜索 (真原始观测 + probs, 面身份边缘化) =====");
  let sumOk = 0, sumTot = 0, anchoredCount = 0;
  for (const e of evals) {
    const t0 = performance.now();
    const r = anchoredBeamSearch(e.probs, e.scrambleSc, {
      beamWidth: BEAM,
      maxRotInserts: 3,
      rawObservations: e.rawObs,
      finalRawObservation: e.finalRawObs,
      rawHitProb: 0.8,
    });
    const ms = Math.round(performance.now() - t0);
    const res = r.anchored ? r : r.bestUnanchored;
    let correct = 0;
    if (res) {
      const n = Math.min(res.segTokens.length, e.gtNoRot.length);
      for (let i = 0; i < n; i++) {
        if (normalizeToken(res.segTokens[i]) === normalizeToken(e.gtNoRot[i])) correct++;
      }
    }
    console.log(
      `${e.name}: anchored=${r.anchored} 逐段 ${correct}/${e.gtNoRot.length} ${ms}ms${res && r.anchored ? "" : " (未锚定)"}`,
    );
    if (res && !r.anchored) {
      console.log(`  best: ${res.movesFlat.slice(0, 20).join(" ")}...`);
    }
    sumOk += correct;
    sumTot += e.gtNoRot.length;
    if (r.anchored) anchoredCount++;
  }
  console.log(`\n端到端: 锚定 ${anchoredCount}/${evals.length}, 逐段 ${sumOk}/${sumTot} = ${((sumOk / sumTot) * 100).toFixed(1)}%`);
}
