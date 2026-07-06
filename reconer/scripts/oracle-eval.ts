/**
 * oracle-eval.ts — Phase-1 oracle 实验: 已知打乱 (双端锚定) 到底值多少准确率。
 *
 * 对 5 个视频: 打乱态由 GT 逆推 (模拟"已知打乱"), 用现有 probs.json (Step-2 不变),
 * 对比 greedy 基线 vs anchoredBeamSearch。所有对比都做 X2'≡X2 归一化。
 *
 * 用法: npx tsx scripts/oracle-eval.ts [--beam 512]
 */
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { CubeState } from "../src/cube-state.ts";
import { parseGT } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import { greedyReverse, type ProbDist } from "../src/reconstruct.ts";
import { anchoredBeamSearch, invertMove, normalizeToken } from "../src/anchored-search.ts";
import { getMoveFace } from "../src/notation.ts";

const beamArg = process.argv.indexOf("--beam");
const BEAM = beamArg >= 0 ? parseInt(process.argv[beamArg + 1], 10) : 512;
const modeArg = process.argv.indexOf("--mode");
const MODE = modeArg >= 0 ? process.argv[modeArg + 1] : "plain"; // plain | dir | face | vis | visdir
const noiseArg = process.argv.indexOf("--noise");
const NOISE = noiseArg >= 0 ? parseFloat(process.argv[noiseArg + 1]) : 0.125;

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

/**
 * 仿真视觉观测: 沿 GT 倒推得到每段起点的状态, 取 B 面 9 格真色,
 * 以 NOISE 概率翻成随机错色, 输出 one-hot 网格 (模拟 ~87.5% 逐格提取器)。
 */
function simulateGrids(
  gtNoRot: string[],
  tailRotations: string[],
): { [t: number]: { [c: string]: number }[] } {
  const st = new CubeState();
  for (let i = tailRotations.length - 1; i >= 0; i--) st.apply(invertMove(tailRotations[i]));
  const grids: { [t: number]: { [c: string]: number }[] } = {};
  for (let t = gtNoRot.length - 1; t >= 0; t--) {
    st.apply(invertMove(gtNoRot[t]));
    grids[t] = Array.from({ length: 9 }, (_, i) => {
      const trueColor = COLOR_NAMES[Math.floor(st.sc[45 + i] / 9)];
      if (rng() < NOISE) {
        const others = COLOR_NAMES.filter((c) => c !== trueColor);
        return { [others[Math.floor(rng() * others.length)]]: 1 };
      }
      return { [trueColor]: 1 };
    });
  }
  return grids;
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
let sumBase = 0, sumBaseTot = 0, sumAnch = 0, sumAnchTot = 0;
let anchoredCount = 0;

for (const splitsPath of files) {
  const content = readFileSync(splitsPath, "utf8");
  const probDists = JSON.parse(
    readFileSync(splitsPath.replace(/\.splits\.txt$/, ".probs.json"), "utf8"),
  ) as ProbDist[];

  const { tokens, tailRotations } = parseGT(content);
  const gtNoRot = tokens.filter((t) => !ROTATION_TOKENS.has(t));
  const gtFlatNorm = tokens.map(normalizeToken); // 含中途 y

  // 已知打乱 (oracle): 由 GT 全序列逆推初态
  const scramble = new CubeState();
  const fullSeq = [...tokens, ...tailRotations];
  for (let i = fullSeq.length - 1; i >= 0; i--) scramble.apply(invertMove(fullSeq[i]));

  // 基线: greedy prob-only (同归一化口径)
  const nTail = tailRotations.length;
  const probs = nTail ? probDists.slice(0, -nTail) : probDists;
  const g = greedyReverse(probs, tailRotations);
  const base = zipCorrect(g.predicted, gtNoRot);
  const baseEd = levenshtein(g.predicted.map(normalizeToken), gtFlatNorm);

  // 双端锚定 beam search。y 在逐 token 语义下为恒等置换, 插入分支纯浪费 → 关闭。
  const candidateFilter =
    MODE === "dir" || MODE === "visdir"
      ? (t: number, c: { token: string }) => dirOf(c.token) === dirOf(gtNoRot[t] ?? "")
      : MODE === "face"
        ? (t: number, c: { face: string | null }) => c.face === getMoveFace(gtNoRot[t] ?? null)
        : undefined;
  const simGrids =
    MODE === "vis" || MODE === "visdir"
      ? (() => {
          const g = simulateGrids(gtNoRot, tailRotations);
          return Array.from({ length: probs.length }, (_, t) => g[t] ?? null);
        })()
      : undefined;
  const t0 = performance.now();
  const r = anchoredBeamSearch(probs, tailRotations, scramble, {
    beamWidth: BEAM,
    maxRotInserts: 0,
    candidateFilter,
    grids: simGrids,
  });
  const ms = Math.round(performance.now() - t0);

  const name = basename(splitsPath).replace(/\.MP4\.splits\.txt$/i, "").replace(/\.mp4\.splits\.txt$/i, "");
  console.log(`\n=== ${name} | segs=${probs.length} gt=${gtNoRot.length}${probs.length !== gtNoRot.length ? " (misaligned)" : ""} | mode=${MODE} beam=${BEAM} ${ms}ms ===`);
  console.log(`greedy 基线:   逐段 ${base.correct}/${base.total}  编辑距离 ${baseEd}`);

  const res = r.anchored ? r : r.bestUnanchored;
  if (!res) { console.log("anchored: 无结果"); continue; }
  const anch = zipCorrect(res.segTokens, gtNoRot);
  const anchEd = levenshtein(res.movesFlat.map(normalizeToken), gtFlatNorm);
  console.log(`anchored=${r.anchored}:  逐段 ${anch.correct}/${anch.total}  编辑距离 ${anchEd}  score=${res.score.toFixed(1)}`);
  if (anchEd > 0 && anchEd <= 6) {
    console.log(`  pred: ${res.movesFlat.join(" ")}`);
    console.log(`  gt:   ${tokens.join(" ")}`);
  }

  sumBase += base.correct; sumBaseTot += base.total;
  sumAnch += anch.correct; sumAnchTot += anch.total;
  if (r.anchored) anchoredCount++;
}

console.log(`\n===== 汇总 (${files.length} 视频) =====`);
console.log(`greedy 基线 逐段: ${sumBase}/${sumBaseTot} = ${((sumBase / sumBaseTot) * 100).toFixed(1)}%`);
console.log(`anchored    逐段: ${sumAnch}/${sumAnchTot} = ${((sumAnch / sumAnchTot) * 100).toFixed(1)}%  (锚定成功 ${anchoredCount}/${files.length})`);
