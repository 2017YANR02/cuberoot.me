/**
 * real-eval.ts — 真实提取评测: 静止区间观测 + 指派边缘化准确率 + 端到端锚定搜索。
 *
 * 观测模型 (每视频):
 *   1. GT 物理回放 → 每 token 段起点空间态 (真值)
 *   2. 全程连续 framedump 逐帧提取 → 静止区间检测 (跨帧网格一致 = 魔方静止,
 *      状态有定义; 中途模糊/错位帧不会形成稳定区间, 从源头挡毒观测)
 *   3. 区间共识网格 (逐格跨帧多数) → 归属唯一 split 边界; 无区间的边界诚实置空
 *   4. 指派边缘化比对: 常数颜色重标 κ (24 候选, 全局拟合) × 每边界 24 指派取 max
 *   5. --search: 区间观测 + probs 喂 anchoredBeamSearch (rawFaces 限面)
 *
 * 用法: npx tsx scripts/real-eval.ts [--search] [--video 3] [--faces B,U]
 *       [--beam 2048] [--hist] [--minrun 3]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import type { ProbDist, ColorName } from "../src/reconstruct.ts";
import {
  anchoredBeamSearch,
  assignsForFaces,
  normalizeToken,
  type RawFaceObs,
} from "../src/anchored-search.ts";
import { IDENTITY_PERM, ORIENTATION_PERMS, invertPerm, physicalPerm } from "../src/rotation-perms.ts";
import { activityMask, extractFaceObservations, medianBackground, type FaceObservation } from "../src/sticker-blobs.ts";

const DO_SEARCH = process.argv.includes("--search");
const DO_HIST = process.argv.includes("--hist"); // 逐区间/逐边界明细
const vArg = process.argv.indexOf("--video");
const ONLY = vArg >= 0 ? process.argv[vArg + 1] : null;
const beamArg = process.argv.indexOf("--beam");
const BEAM = beamArg >= 0 ? parseInt(process.argv[beamArg + 1], 10) : 2048;
const mrArg = process.argv.indexOf("--minrun");
const MIN_RUN = mrArg >= 0 ? parseInt(process.argv[mrArg + 1], 10) : 3;
const facesArg = process.argv.indexOf("--faces");
type FaceName = "U" | "R" | "F" | "D" | "L" | "B";
const SEARCH_FACES = (facesArg >= 0 ? process.argv[facesArg + 1] : "B,U").split(",") as FaceName[];

const COLOR_NAMES: readonly ColorName[] = ["W", "R", "G", "Y", "O", "B"];
const ALL_FACES: readonly FaceName[] = ["U", "R", "F", "D", "L", "B"];
const ASSIGNS = ALL_FACES.flatMap((f) => assignsForFaces([f]).map((assign) => ({ face: f, assign })));

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}

/**
 * 指派边缘化最优匹配: 相机网格 vs 空间态, max over 6面×4旋转。
 * omega = 常数颜色重标 κ 对应的朝向置换 (相机系 = κ∘GT 系, 共轭的外侧半,
 * 不被指派 max 吸收, 须按视频拟合)。
 */
function bestAssign(
  colors: readonly (ColorName | null)[],
  state: readonly number[],
  omega: readonly number[],
): { match: number; read: number; face: FaceName } {
  let best = { match: -1, read: 0, face: "B" as FaceName };
  for (const { face, assign } of ASSIGNS) {
    let m = 0, rd = 0;
    for (let i = 0; i < 9; i++) {
      const c = colors[i];
      if (!c) continue;
      rd++;
      if (COLOR_NAMES[Math.floor(omega[state[assign[i]] ] / 9)] === c) m++;
    }
    if (m > best.match) best = { match: m, read: rd, face };
  }
  return best;
}

/** 静止区间: [from,to] 帧号闭区间 + 共识网格 */
interface RestRun {
  from: number;
  to: number;
  len: number;
  grid: (ColorName | null)[];
}

/** 两帧网格一致: 共同非空格 ≥4 且不一致 ≤1 (反光/漂移偶翻一格容忍, 转动中仍无法成区间) */
function agree(a: FaceObservation, b: FaceObservation): boolean {
  let common = 0, bad = 0;
  for (let i = 0; i < 9; i++) {
    const ca = a.colors[i], cb = b.colors[i];
    if (!ca || !cb) continue;
    common++;
    if (ca !== cb && ++bad > 1) return false;
  }
  return common >= 4;
}

interface VideoEval {
  name: string;
  nBounds: number;
  covered: number;
  margMatch: number;
  margRead: number;
  nullMatch: number;
  nullRead: number;
  rawObs: (RawFaceObs | null)[];
  finalRawObs: RawFaceObs | null;
  probs: ProbDist[];
  scrambleSc: readonly number[];
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

  // GT 物理回放 (相机系 = κ∘GT 记谱系, κ 由拟合吸收)
  const fullSeq = [...tokens, ...tailRotations];
  const startState: number[][] = new Array(fullSeq.length);
  let cur: number[] = [...IDENTITY_PERM];
  for (let j = fullSeq.length - 1; j >= 0; j--) {
    cur = applyTo(cur, invertPerm(physicalPerm(fullSeq[j])));
    startState[j] = cur;
  }
  const scrambleSc = cur;
  const nonRotIdx = tokens.map((t, j) => (ROTATION_TOKENS.has(t) ? -1 : j)).filter((j) => j >= 0);
  const boundStates = nonRotIdx.map((j) => startState[j]); // probs 段起点态 (+末态另加)
  const finalState = IDENTITY_PERM;

  // dump 读取 (全程连续帧)
  const meta = JSON.parse(readFileSync(dumpJson, "utf8")) as { w: number; h: number; frames: number[] };
  const bin = readFileSync(videoPath + ".framedump.bin");
  const frameBytes = meta.w * meta.h * 3;
  const frameAt = (i: number) => new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (meta.frames.length - 1)) / 14));
  const bgFrames = bgIdx.map(frameAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask = activityMask(bgFrames, bg, meta.w, meta.h);

  // 逐帧提取 (每帧 0-2 面) → 链式静止区间检测 (链跟随能续上的网格)
  const grids: FaceObservation[][] = new Array(meta.frames.length);
  for (let i = 0; i < meta.frames.length; i++) {
    grids[i] = extractFaceObservations(frameAt(i), meta.w, meta.h, mask);
  }
  const runs: RestRun[] = [];
  {
    // 空帧桥接: 提取单帧失败不断链 (≤2 帧空隙), 只有"读到且全不一致"才断
    let sFrame = -1, lastFrame = -1, gap = 0;
    let chain: FaceObservation[] = [];
    const flush = () => {
      if (chain.length >= MIN_RUN) {
        const colors: (ColorName | null)[] = [];
        for (let c = 0; c < 9; c++) {
          const tally = new Map<ColorName, number>();
          let tot = 0;
          for (const g of chain) {
            const col = g.colors[c];
            if (!col) continue;
            tot++;
            tally.set(col, (tally.get(col) ?? 0) + 1);
          }
          const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
          colors.push(top && top[1] >= 2 && top[1] > tot * 0.6 ? top[0] : null);
        }
        if (colors.filter(Boolean).length >= 5) {
          runs.push({ from: meta.frames[sFrame], to: meta.frames[lastFrame], len: chain.length, grid: colors });
        }
      }
      sFrame = -1;
      lastFrame = -1;
      gap = 0;
      chain = [];
    };
    for (let i = 0; i < meta.frames.length; i++) {
      const gs = grids[i];
      if (!gs.length) {
        if (sFrame >= 0 && ++gap > 2) flush();
        continue;
      }
      if (sFrame < 0) {
        sFrame = i;
        lastFrame = i;
        gap = 0;
        chain = [gs[0]];
        continue;
      }
      const cont = gs.find((g) => agree(chain[chain.length - 1], g));
      if (cont) {
        chain.push(cont);
        lastFrame = i;
        gap = 0;
        continue;
      }
      flush();
      sFrame = i;
      lastFrame = i;
      chain = [gs[0]];
    }
    flush();
  }

  // 常数颜色重标 κ 拟合: 归属无关 (每区间对全部边界态取 max), 24 候选取总匹配最优
  const allStates = [...boundStates, finalState];
  let omega: readonly number[] = IDENTITY_PERM, omegaIdx = 0, omegaBest = -1;
  for (let oi = 0; oi < 24; oi++) {
    const cand = ORIENTATION_PERMS[oi];
    let tot = 0;
    for (const run of runs) {
      let m = 0;
      for (const st of allStates) {
        const b = bestAssign(run.grid, st, cand);
        if (b.match > m) m = b.match;
      }
      tot += m;
    }
    if (tot > omegaBest) {
      omegaBest = tot;
      omega = cand;
      omegaIdx = oi;
    }
  }

  // 归属规则学习诊断: GT 最像边界 vs 两种规则 (区间就近 / 终点锚定)
  const nearestByInterval = (run: RestRun): number => {
    let bi = -1, bd = Infinity;
    for (let si = 0; si < splitFrames.length; si++) {
      const d = splitFrames[si] < run.from ? run.from - splitFrames[si] : splitFrames[si] > run.to ? splitFrames[si] - run.to : 0;
      if (d < bd) { bd = d; bi = si; }
    }
    return bd <= 12 ? bi : -1;
  };
  const nearestToEnd = (run: RestRun): number => {
    let bi = -1, bd = Infinity;
    for (let si = 0; si < splitFrames.length; si++) {
      const d = Math.abs(splitFrames[si] - (run.to + 1));
      if (d < bd) { bd = d; bi = si; }
    }
    return bd <= 12 ? bi : -1;
  };
  /** split 下标 → probs 边界下标 (-1 = 转体段起点或超界; 末 split = boundStates.length) */
  const tokIdxToProbs = new Map<number, number>(nonRotIdx.map((j, t) => [j, t]));
  const splitToBound = (si: number): number => {
    if (si < 0) return -1;
    if (si === splitFrames.length - 1) return boundStates.length; // 末态
    return tokIdxToProbs.get(si) ?? -1;
  };
  const stateOf = (b: number) => (b === boundStates.length ? finalState : boundStates[b]);

  let agreeInterval = 0, agreeEnd = 0, nDiag = 0;
  if (DO_HIST) {
    const nExtracted = grids.filter((g) => g.length > 0).length;
    const nTwo = grids.filter((g) => g.length >= 2).length;
    console.log(
      `--- ${basename(videoPath)} 逐帧提取 ${nExtracted}/${grids.length} (双面 ${nTwo}), 静止区间 ${runs.length} 个 (minrun=${MIN_RUN}, κ=ω${omegaIdx}) ---`,
    );
  }
  for (const run of runs) {
    // GT 最像边界 (需要明显赢: 读格 ≥5)
    let gtB = -1, gtFrac = -1;
    for (let b = 0; b <= boundStates.length; b++) {
      const r = bestAssign(run.grid, stateOf(b), omega);
      const f = r.read ? r.match / r.read : 0;
      if (f > gtFrac) { gtFrac = f; gtB = b; }
    }
    const ruleI = splitToBound(nearestByInterval(run));
    const ruleE = splitToBound(nearestToEnd(run));
    if (gtFrac >= 0.8) {
      nDiag++;
      if (ruleI === gtB) agreeInterval++;
      if (ruleE === gtB) agreeEnd++;
    }
    if (DO_HIST) {
      console.log(
        `  [${run.from}..${run.to}] len${run.len} [${run.grid.map((c) => c ?? ".").join("")}] GT最像 b${gtB}(${(gtFrac * 100).toFixed(0)}%)  就近→b${ruleI} 终点→b${ruleE}`,
      );
    }
  }

  // 软覆盖天花板: 每边界 ±12 帧内是否存在与 GT 态匹配 ≥75% (读格 ≥5) 的区间
  // (= "边界从邻近区间挑最匹配"方案在完美挑选下的可达覆盖)
  let softCov = 0;
  for (let t = 0; t < boundStates.length; t++) {
    const sp = splitFrames[nonRotIdx[t]];
    for (const run of runs) {
      if (run.to + 12 < sp || run.from - 12 > sp) continue;
      const b = bestAssign(run.grid, boundStates[t], omega);
      if (b.read >= 5 && b.match / b.read >= 0.75) {
        softCov++;
        break;
      }
    }
  }

  // 归属 (区间就近规则; 学习诊断打印两规则命中率供比对) → 每边界取最长区间
  const boundObs: (RawFaceObs | null)[] = new Array(boundStates.length).fill(null);
  const boundLen: number[] = new Array(boundStates.length).fill(0);
  let finalRawObs: RawFaceObs | null = null, finalLen = 0;
  for (const run of runs) {
    const b = splitToBound(nearestByInterval(run));
    if (b < 0) continue;
    if (b === boundStates.length) {
      if (run.len > finalLen) { finalRawObs = { colors: run.grid }; finalLen = run.len; }
    } else if (run.len > boundLen[b]) {
      boundObs[b] = { colors: run.grid };
      boundLen[b] = run.len;
    }
  }

  // 指派边缘化统计 + 乱态对照 + 赢面直方图
  let covered = 0, margMatch = 0, margRead = 0, nullMatch = 0, nullRead = 0;
  let nGood = 0, nMid = 0, nJunk = 0;
  const faceWins = new Map<string, number>();
  const half = Math.floor(boundStates.length / 2);
  for (let t = 0; t < boundStates.length; t++) {
    const e = boundObs[t];
    if (!e) continue;
    covered++;
    const b = bestAssign(e.colors, boundStates[t], omega);
    margMatch += b.match;
    margRead += b.read;
    faceWins.set(b.face, (faceWins.get(b.face) ?? 0) + 1);
    const frac = b.read ? b.match / b.read : 0;
    if (frac >= 0.85) nGood++;
    else if (frac >= 0.6) nMid++;
    else nJunk++;
    const nb = bestAssign(e.colors, boundStates[(t + half) % boundStates.length], omega);
    nullMatch += nb.match;
    nullRead += nb.read;
  }

  const name = basename(videoPath).replace(/\.MP4$/i, "");
  evals.push({
    name,
    nBounds: boundStates.length,
    covered,
    margMatch,
    margRead,
    nullMatch,
    nullRead,
    rawObs: boundObs,
    finalRawObs,
    probs,
    scrambleSc,
    gtNoRot,
  });

  const acc = margRead ? ((margMatch / margRead) * 100).toFixed(1) : "-";
  const nacc = nullRead ? ((nullMatch / nullRead) * 100).toFixed(1) : "-";
  const wins = [...faceWins.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}×${n}`).join(" ");
  console.log(
    `${name}: 区间 ${runs.length}, 边界 ${covered}/${boundStates.length} 有观测, 软覆盖天花板 ${softCov}/${boundStates.length}, 读格 ${margRead}, 边缘化逐格 ${acc}% (乱态对照 ${nacc}%)  质量 GOOD ${nGood}/mid ${nMid}/JUNK ${nJunk}  归属规则命中(GT≥80%区间): 就近 ${agreeInterval}/${nDiag} 终点 ${agreeEnd}/${nDiag}  κ=ω${omegaIdx}  赢面: ${wins}  末帧=${finalRawObs ? finalRawObs.colors.filter(Boolean).length + "格" : "无"}`,
  );
}

// 汇总
const totRead = evals.reduce((s, e) => s + e.margRead, 0);
const totOk = evals.reduce((s, e) => s + e.margMatch, 0);
const totNullRead = evals.reduce((s, e) => s + e.nullRead, 0);
const totNull = evals.reduce((s, e) => s + e.nullMatch, 0);
const totCov = evals.reduce((s, e) => s + e.covered, 0);
const totBounds = evals.reduce((s, e) => s + e.nBounds, 0);
console.log(
  `\n===== 提取汇总: 覆盖 ${totCov}/${totBounds} = ${((totCov / totBounds) * 100).toFixed(1)}%, 边缘化逐格 ${totOk}/${totRead} = ${totRead ? ((totOk / totRead) * 100).toFixed(1) : "-"}% (乱态对照底噪 ${totNullRead ? ((totNull / totNullRead) * 100).toFixed(1) : "-"}%) =====`,
);

if (DO_SEARCH) {
  console.log(`\n===== 端到端锚定搜索 (静止区间观测 + probs, 限面 ${SEARCH_FACES.join("/")}) =====`);
  let sumOk = 0, sumTot = 0, anchoredCount = 0;
  for (const e of evals) {
    // 观测可信度取该视频实测边缘化准确率 (夹在 [0.55, 0.9])
    const measured = e.margRead ? e.margMatch / e.margRead : 0.7;
    const hitProb = Math.min(0.9, Math.max(0.55, measured));
    const t0 = performance.now();
    const r = anchoredBeamSearch(e.probs, e.scrambleSc, {
      beamWidth: BEAM,
      maxRotInserts: 3,
      rawObservations: e.rawObs,
      finalRawObservation: e.finalRawObs ?? undefined,
      rawHitProb: hitProb,
      rawMissProb: (1 - hitProb) / 5,
      rawFaces: SEARCH_FACES,
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
      `${e.name}: anchored=${r.anchored} 逐段 ${correct}/${e.gtNoRot.length} (hitProb=${hitProb.toFixed(2)}) ${ms}ms${res && r.anchored ? "" : " (未锚定)"}`,
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
