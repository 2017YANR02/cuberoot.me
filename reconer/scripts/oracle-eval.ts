/**
 * oracle-eval.ts — oracle 实验 (物理语义): 已知打乱 + 逐段观测能达到的复原精度。
 *
 * 对 5 个视频: 打乱空间态由 GT 物理回放逆推 (模拟"已知打乱"), probs.json 不变,
 * 视觉观测按 GT 段起点空间态仿真 (one-hot + 噪声)。对比 greedy 基线 vs 物理锚定搜索。
 * 中途 y 段 (probs 跳过) 由搜索的 y 插入机制恢复, 计入编辑距离。
 *
 * 用法: npx tsx scripts/oracle-eval.ts --mode vis --beam 2048
 *   --mode  plain | dir | face | vis | visdir   (默认 plain)
 *   --noise 逐格翻错概率 (默认 0.125)
 *   --dropout 整段观测丢失概率 (默认 0, 模拟"该边界帧提取失败/全遮挡")
 *   --cells 每段可见格数 (默认 9, 模拟手部遮挡只剩 k 格)
 */
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { parseGT } from "../src/splits.ts";
import { ROTATION_TOKENS, getMoveFace } from "../src/notation.ts";
import { greedyReverse, type ProbDist } from "../src/reconstruct.ts";
import {
  anchoredBeamSearch,
  normalizeToken,
  type Observation,
  type RawFaceObs,
  type SegObservations,
} from "../src/anchored-search.ts";
import { IDENTITY_PERM, invertPerm, permKey, physicalPerm } from "../src/rotation-perms.ts";

function argOf(name: string, dflt: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? parseFloat(process.argv[i + 1]) : dflt;
}
const BEAM = argOf("beam", 512);
const NOISE = argOf("noise", 0.125);
const DROPOUT = argOf("dropout", 0);
const CELLS = argOf("cells", 9);
const modeArg = process.argv.indexOf("--mode");
// plain | dir | face | vis | visdir | visface (面身份未知的原始观测, 24 指派边缘化)
const MODE = modeArg >= 0 ? process.argv[modeArg + 1] : "plain";

/** token 的方向后缀 (第一个子动作): "" | "'" | "2" */
function dirOf(tok: string): string {
  const m = normalizeToken(tok).match(/^[A-Za-z](2|')?/);
  return m?.[1] ?? "";
}

// 可复现的 LCG (模拟视觉观测噪声)
let rngState = 20260706;
function rng(): number {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 0x100000000;
}

const COLOR_NAMES = ["W", "R", "G", "Y", "O", "B"] as const;

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}

/** 面身份未知的原始观测仿真: 随机可见面 (B 60% / U 40%) + 随机 in-plane 旋转 + 噪声 */
function simulateRawObs(sc: readonly number[], cells: number): RawFaceObs {
  const face = rng() < 0.6 ? 5 : 0; // B=5, U=0
  const rot = Math.floor(rng() * 4);
  let assign = Array.from({ length: 9 }, (_, i) => face * 9 + i);
  const rot90 = (m: number[]) => [m[6], m[3], m[0], m[7], m[4], m[1], m[8], m[5], m[2]];
  for (let r = 0; r < rot; r++) assign = rot90(assign);
  const colors: (typeof COLOR_NAMES[number] | null)[] = new Array(9).fill(null);
  const idxs = [...Array(9).keys()];
  if (cells < 9) {
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    idxs.length = cells;
  }
  for (const i of idxs) {
    const trueColor = COLOR_NAMES[Math.floor(sc[assign[i]] / 9)];
    if (rng() < NOISE) {
      const others = COLOR_NAMES.filter((c) => c !== trueColor);
      colors[i] = others[Math.floor(rng() * others.length)];
    } else {
      colors[i] = trueColor;
    }
  }
  return { colors };
}

/** 空间态 B 面 one-hot 观测 (噪声 + 遮挡格数) */
function simulateObs(sc: readonly number[], cells: number): Observation[] {
  const idxs = [...Array(9).keys()];
  if (cells < 9) {
    // 随机保留 cells 格 (模拟手部遮挡)
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    idxs.length = cells;
  }
  return idxs.map((i) => {
    const trueColor = COLOR_NAMES[Math.floor(sc[45 + i] / 9)];
    if (rng() < NOISE) {
      const others = COLOR_NAMES.filter((c) => c !== trueColor);
      return { idx: 45 + i, dist: { [others[Math.floor(rng() * others.length)]]: 1 } };
    }
    return { idx: 45 + i, dist: { [trueColor]: 1 } };
  });
}

function levenshtein(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array<number>(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

/** 归一化 zip 对比 (对齐场景): 返回逐段完全正确数 */
function zipCorrect(pred: string[], gt: string[]): { correct: number; total: number } {
  const n = Math.min(pred.length, gt.length);
  let correct = 0;
  for (let i = 0; i < n; i++) {
    if (normalizeToken(pred[i]) === normalizeToken(gt[i])) correct++;
  }
  return { correct, total: Math.max(pred.length, gt.length) };
}

const videosDir = join(import.meta.dirname, "..", "videos");
const files = readdirSync(videosDir)
  .filter((f) => f.endsWith(".splits.txt"))
  .sort()
  .map((f) => join(videosDir, f));
let sumBase = 0, sumBaseTot = 0, sumAnch = 0, sumAnchTot = 0, sumEd = 0;
let anchoredCount = 0;

for (const splitsPath of files) {
  const content = readFileSync(splitsPath, "utf8");
  const probs = JSON.parse(
    readFileSync(splitsPath.replace(/\.splits\.txt$/, ".probs.json"), "utf8"),
  ) as ProbDist[];

  const { tokens, tailRotations } = parseGT(content);
  const gtNoRot = tokens.filter((t) => !ROTATION_TOKENS.has(t));
  const gtFlatNorm = tokens.map(normalizeToken); // 含中途 y
  if (probs.length !== gtNoRot.length) {
    console.warn(`WARN ${basename(splitsPath)}: probs=${probs.length} ≠ nonRot=${gtNoRot.length}`);
  }

  // 物理回放逆推: 从复原态 (相机系=GT 系) 逐 token 撤销, 记录每 token 起点空间态
  const fullSeq = [...tokens, ...tailRotations];
  const startState: number[][] = new Array(fullSeq.length);
  let cur: number[] = [...IDENTITY_PERM];
  for (let j = fullSeq.length - 1; j >= 0; j--) {
    cur = applyTo(cur, invertPerm(physicalPerm(fullSeq[j])));
    startState[j] = cur;
  }
  const scrambleSc = cur;
  // 自检: 正向回放应回到恒等
  let chk: readonly number[] = scrambleSc;
  for (const t of fullSeq) chk = applyTo(chk, physicalPerm(t));
  if (permKey(chk as number[]) !== permKey(IDENTITY_PERM)) throw new Error("回放自检失败");

  // 基线: greedy prob-only (canonical 语义, Phase-1 口径, 仅作参照)
  const g = greedyReverse(probs, []);
  const base = zipCorrect(g.predicted, gtNoRot);
  const baseEd = levenshtein(g.predicted.map(normalizeToken), gtFlatNorm);

  const candidateFilter =
    MODE === "dir" || MODE === "visdir"
      ? (t: number, c: { token: string }) => dirOf(c.token) === dirOf(gtNoRot[t] ?? "")
      : MODE === "face"
        ? (t: number, c: { face: string | null }) => c.face === getMoveFace(gtNoRot[t] ?? null)
        : undefined;

  // 观测: 每个非转体 token 的段起点空间态 (与 probs 对齐)
  let observations: SegObservations[] | undefined;
  let finalObservation: Observation[] | undefined;
  let rawObservations: (RawFaceObs | null)[] | undefined;
  let finalRawObservation: RawFaceObs | undefined;
  const nonRotIdx = tokens.map((t, j) => (ROTATION_TOKENS.has(t) ? -1 : j)).filter((j) => j >= 0);
  if (MODE === "vis" || MODE === "visdir") {
    observations = nonRotIdx.map((j) => (rng() < DROPOUT ? null : simulateObs(startState[j], CELLS)));
    finalObservation = simulateObs(IDENTITY_PERM, CELLS);
  } else if (MODE === "visface") {
    rawObservations = nonRotIdx.map((j) =>
      rng() < DROPOUT ? null : simulateRawObs(startState[j], CELLS),
    );
    finalRawObservation = simulateRawObs(IDENTITY_PERM, CELLS);
  }

  const t0 = performance.now();
  const r = anchoredBeamSearch(probs, scrambleSc, {
    beamWidth: BEAM,
    maxRotInserts: 3,
    candidateFilter,
    observations,
    finalObservation,
    rawObservations,
    finalRawObservation,
    rawHitProb: 1 - NOISE,
  });
  const ms = Math.round(performance.now() - t0);

  const name = basename(splitsPath).replace(/\.MP4\.splits\.txt$/i, "");
  console.log(`\n=== ${name} | segs=${probs.length} gt=${gtNoRot.length} | mode=${MODE} beam=${BEAM} ${ms}ms ===`);
  console.log(`greedy 基线:   逐段 ${base.correct}/${base.total}  编辑距离 ${baseEd}`);

  const res = r.anchored ? r : r.bestUnanchored;
  if (!res) { console.log("anchored: 无结果"); continue; }
  const anch = zipCorrect(res.segTokens, gtNoRot);
  const anchEd = levenshtein(res.movesFlat.map(normalizeToken), gtFlatNorm);
  console.log(`anchored=${r.anchored}:  逐段 ${anch.correct}/${anch.total}  编辑距离 ${anchEd}  score=${res.score.toFixed(1)}`);
  if (anchEd > 0 && anchEd <= 8) {
    console.log(`  pred: ${res.movesFlat.join(" ")}`);
    console.log(`  gt:   ${tokens.join(" ")}`);
  }

  sumBase += base.correct; sumBaseTot += base.total;
  sumAnch += anch.correct; sumAnchTot += anch.total;
  sumEd += anchEd;
  if (r.anchored) anchoredCount++;
}

console.log(`\n===== 汇总 (${files.length} 视频, mode=${MODE} noise=${NOISE} dropout=${DROPOUT} cells=${CELLS}) =====`);
console.log(`greedy 基线 逐段: ${sumBase}/${sumBaseTot} = ${((sumBase / sumBaseTot) * 100).toFixed(1)}%`);
console.log(`anchored    逐段: ${sumAnch}/${sumAnchTot} = ${((sumAnch / sumAnchTot) * 100).toFixed(1)}%  编辑距离合计 ${sumEd}  (锚定成功 ${anchoredCount}/${files.length})`);
