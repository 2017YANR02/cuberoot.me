/**
 * conserve-eval.ts — 贴纸外观守恒动作打分 v2: 静止链共识 + 色度-only + B/U 双视图。
 *
 * 原理: 一步动作 = 可见格的已知置换。候选动作 m 下, 段后格 i 的外观应等于
 * 段前来源格 j 的外观 (来源可见时), 比的是**原始 RGB 相似度, 零颜色分类** —
 * 负结果⑤⑥⑦杀的是外观→标签映射 (类间重叠), 未杀同一贴纸跨一步的自相似。
 *
 * v2 (升级自单帧 v1: 覆盖 29% / face top1 31%):
 *   1. 静止链共识: 逐帧提取 (冷+跟踪, 同 real-eval) → 帧运动量 2-means 阈值门控
 *      → 多链成链 (颜色 agree ≤1 错格, 空隙桥接 ≤2) → 每格逐帧采样取中位 —
 *      单帧镜面噪声被中位吸收; 无链边界回退 v1 单帧 (标 fallback 分开计)。
 *   2. 色度-only 相似度 (默认): 镜面反光主要打 v 轴 (负⑦), a/b 色度盘稳得多。
 *   3. B/U 双视图联合: 时间重叠的双链按图像 y 定身份 (此机位 B 恒在 U 下方),
 *      18 格拼一张 54-facelet 外观图联合打分 — 跨面流入也能对上。
 *   4. 链基规范化 (v1.x+v2.y 最大的 90° 变体) + 段前后共享指派 (相机 100ms 不动;
 *      fitFaceGrid 近 45° 轴交换由规范化吸收)。
 *   链→边界归属: 段内运动量峰值 = 拧转位置, 链中心在峰前属段起点边界、峰后属
 *   段终点边界 (标注滞后 0~8 帧的归属歧义由此消解)。
 *
 * 评分 (每段, B/U 各 4 旋转指派边缘化, 前后共享; mean 归一跨配置可比):
 *   score(m) = mean_i  sim(after[i], appBefore[π_m[assign[i]]])   (来源可见)
 *                    |  μ_neutral                                  (来源藏面)
 *   预测"不动"的格实际大变 → 付大负分 (F 假设不能在 U 段白捡);
 *   全流入的转体假设 (y) 恰得中性分 — 其他假设付错分时 y 靠"无罪"胜出。
 *
 * 用法: npx tsx scripts/conserve-eval.ts [--video 1] [--hist] [--withv] [--minlen 2] [--nofb]
 * 诊断: [--oracle|--oraclecov] [--samecheck] [--nocanon] [--combo n]
 *
 * === 判决 (2026-07-10, 负结果⑩, 勿盲目重试) ===
 * 打分机器本身验证可用: --oracle (全覆盖合成 GT 观测) face top1 97.6% top2 100%;
 * --oraclecov (真实覆盖+GT 内容) 75-77% — 天花板由覆盖模式决定。
 * 真实数据 face top1 仅 26.7% (覆盖 56%, 基线 probs 57.6%), 三个提取层根因 (--samecheck 实锤):
 *   1. 晶格重获取平移漂移: 同边界跨链同态对齐 p50 -30, 加 ±1 格平移搜索 → -10
 *      (链内 split-half 自距 p50 -1~-5, 特征本身稳) — 重获取的 3×3 窗常错位 1 格;
 *   2. 旋转身份不稳: 好对胜出旋转仅 ~60% 集中在 rot0 (canon/nocanon 皆然) —
 *      每视频全局指派组合不存在 (16 组合钉死扫描全平坦 22-41%), 而解开每链旋转
 *      自由度必然让共轭歧义回归 (神谕实测: 段内自由指派 max 把 U 共轭成 R/D/L, 95%→73%);
 *   3. 9 TPS 边界归属歧义: split=手动作起点, 拧转滞后 0~8 帧; 运动峰值规则被手部
 *      持续运动污染已证伪, LAG=4 兜底仍有错归 (前后比成同一状态 → neutral 饱和平局)。
 * 残余杠杆 (未做, 期望有限): per-span 联合钉定旋转 (span 内基构造性恒定) 只覆盖
 * 同 span 段对且 solo 视图共轭仍无解; 真正解耦需接入搜索由锚定路径钉朝向 —
 * 但内容层残差 (最优对齐后 p50 仍 -10 ≈ 3σ/格) 已注定难超 57.6% 门槛。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { assignsForFaces } from "../src/anchored-search.ts";
import { blockMedianRGB, rgbFeature } from "../src/color-calib.ts";
import { getFace } from "../src/notation.ts";
import { IDENTITY_PERM, invertPerm, physicalPerm } from "../src/rotation-perms.ts";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import {
  activityMask,
  cellCenter,
  extractFaceObservations,
  medianBackground,
  reorientObsToBasis,
  trackFaceGrid,
  type FaceGrid,
  type FaceObservation,
} from "../src/sticker-blobs.ts";
import type { ColorName } from "../src/reconstruct.ts";

const vArg = process.argv.indexOf("--video");
const ONLY = vArg >= 0 ? process.argv[vArg + 1] : null;
const DO_HIST = process.argv.includes("--hist");
const WITH_V = process.argv.includes("--withv");
const NO_FB = process.argv.includes("--nofb");
const mlArg = process.argv.indexOf("--minlen");
const MINLEN = mlArg >= 0 ? Number(process.argv[mlArg + 1]) : 2;
/** 诊断: --oracle 全覆盖合成 GT 观测 (测打分机器); --oraclecov 真实覆盖+GT 内容 (测边界归属) */
const ORACLE = process.argv.includes("--oracle");
const ORACLE_COV = process.argv.includes("--oraclecov");
/** 诊断: --nocanon 跳过链基规范化; --combo n 钉死指派组合; --samecheck 同态对齐自检 */
const NO_CANON = process.argv.includes("--nocanon");
const cbArg = process.argv.indexOf("--combo");
const FORCE_COMBO = cbArg >= 0 ? Number(process.argv[cbArg + 1]) : -1;
const SAME_CHECK = process.argv.includes("--samecheck");

/** 候选动作 (GT 记谱只涉及 U D L R F B? + 宽转 r f u + 转体 x y) */
const CANDS = [
  "U", "U'", "U2", "D", "D'", "D2", "R", "R'", "R2", "L", "L'", "L2",
  "F", "F'", "F2", "B", "B'", "B2",
  "r", "r'", "r2", "f", "f'", "f2", "u", "u'", "u2",
  "y", "y'", "y2", "x", "x'", "x2",
] as const;

const ALL_ASSIGNS = assignsForFaces(["B", "U"]);
const B_ASSIGNS = ALL_ASSIGNS.filter((a) => Math.floor(a[0] / 9) === 5);
const U_ASSIGNS = ALL_ASSIGNS.filter((a) => Math.floor(a[0] / 9) === 0);

interface CellFeat {
  a: number;
  b: number;
  v: number;
}

/** 静止链共识观测 (9 格规范化基索引) */
interface ChainObs {
  from: number;
  to: number;
  len: number;
  feats: (CellFeat | null)[];
  filled: number;
  /** 图像中心 y (B/U 身份配对用: B 恒在下 = y 大) */
  cy: number;
  fallback: boolean;
}

/** 一个边界视图: 已定身份的 B/U 链 (联合打分); 单链身份不明时两个 View 各押一边 */
interface View {
  b: ChainObs | null;
  u: ChainObs | null;
}

/** 色度盘相似度 -d² (σc=25; --withv 加明度轴 σv=40) */
function sim(p: CellFeat, q: CellFeat): number {
  const da = (p.a - q.a) / 25;
  const db = (p.b - q.b) / 25;
  let d = da * da + db * db;
  if (WITH_V) {
    const dv = (p.v - q.v) / 40;
    d += dv * dv;
  }
  return -d;
}

/** 两帧网格一致: 共同非空格 ≥4 且不一致 ≤1 (同 real-eval agree) */
function agree(a: FaceObservation, b: FaceObservation): boolean {
  let common = 0;
  let bad = 0;
  for (let i = 0; i < 9; i++) {
    const ca = a.colors[i];
    const cb = b.colors[i];
    if (!ca || !cb) continue;
    common++;
    if (ca !== cb && ++bad > 1) return false;
  }
  return common >= 4;
}

const med = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};
const medFeat = (ss: CellFeat[]): CellFeat => ({
  a: med(ss.map((s) => s.a)),
  b: med(ss.map((s) => s.b)),
  v: med(ss.map((s) => s.v)),
});

/**
 * 基规范化: 旋到 v1.x/|v1|+v2.y/|v2| 最大的 90° 变体并重排 9 格 —
 * 段前后两条链各自规范化后共享指派才成立 (fitFaceGrid 轴交换歧义被吸收)。
 * 旋一次 (v1',v2')=(v2,-v1): 新格 (r',c') 落在旧格 (r=c', c=2-r') 处。
 */
function canonicalize(feats: (CellFeat | null)[], g: FaceGrid): (CellFeat | null)[] {
  if (NO_CANON) return feats;
  let cv1 = { x: g.v1.x, y: g.v1.y };
  let cv2 = { x: g.v2.x, y: g.v2.y };
  let bestK = 0;
  let bestS = -Infinity;
  for (let k = 0; k < 4; k++) {
    const s = cv1.x / Math.hypot(cv1.x, cv1.y) + cv2.y / Math.hypot(cv2.x, cv2.y);
    if (s > bestS) {
      bestS = s;
      bestK = k;
    }
    [cv1, cv2] = [cv2, { x: -cv1.x, y: -cv1.y }];
  }
  let out = feats;
  for (let k = 0; k < bestK; k++) {
    const nf: (CellFeat | null)[] = new Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) nf[r * 3 + c] = out[c * 3 + (2 - r)];
    }
    out = nf;
  }
  return out;
}

const videosDir = join(import.meta.dirname, "..", "videos");
const files = readdirSync(videosDir)
  .filter((f) => f.endsWith(".splits.txt"))
  .filter((f) => !ONLY || f.startsWith(ONLY))
  .sort();

const perms = CANDS.map((m) => physicalPerm(m));
let allSeg = 0;
let allCov = 0;
let allFaceOk = 0;
let allFaceOk2 = 0;
let allMoveOk = 0;
let chainCov = 0;
let chainFaceOk = 0;
const confusion = new Map<string, Map<string, number>>();

for (const sf of files) {
  const splitsPath = join(videosDir, sf);
  const videoPath = splitsPath.replace(/\.splits\.txt$/, "");
  const dumpJson = videoPath + ".framedump.json";
  if (!existsSync(dumpJson)) continue;
  const content = readFileSync(splitsPath, "utf8");
  const { tokens, tailRotations } = parseGT(content);
  const splitFrames = parseSplitFrames(content);
  const meta = JSON.parse(readFileSync(dumpJson, "utf8")) as {
    video: string;
    w: number;
    h: number;
    frames: number[];
  };
  const bin = readFileSync(videoPath + ".framedump.bin");
  const frameBytes = meta.w * meta.h * 3;
  const frameAt = (i: number) => new Uint8Array(bin.buffer, bin.byteOffset + i * frameBytes, frameBytes);
  const frame0 = meta.frames[0];
  const n = meta.frames.length;
  const bgIdx = Array.from({ length: 15 }, (_, i) => Math.floor((i * (n - 1)) / 14));
  const bgFrames = bgIdx.map(frameAt);
  const bg = medianBackground(bgFrames, meta.w, meta.h);
  const mask = activityMask(bgFrames, bg, meta.w, meta.h);
  const splitIdx = splitFrames.map((f) => f - frame0);

  // 逐帧提取 (冷 + 时间连续性跟踪, 同 real-eval extractAllGrids 无标定版)
  const grids: FaceObservation[][] = new Array(n);
  {
    let prior: FaceGrid | null = null;
    let priorColors: readonly (ColorName | null)[] | null = null;
    let priorMiss = 0;
    for (let i = 0; i < n; i++) {
      let cold = extractFaceObservations(frameAt(i), meta.w, meta.h, mask, {});
      if (cold.length) {
        if (prior) cold = [reorientObsToBasis(cold[0], prior.v1, prior.v2), ...cold.slice(1)];
        grids[i] = cold;
        prior = cold[0].grid;
        priorColors = cold[0].colors;
        priorMiss = 0;
        continue;
      }
      const tracked: FaceObservation | null = prior
        ? trackFaceGrid(frameAt(i), meta.w, meta.h, prior, priorColors, {})
        : null;
      if (tracked) {
        grids[i] = [tracked];
        prior = tracked.grid;
        priorColors = tracked.colors;
        priorMiss = 0;
      } else {
        grids[i] = [];
        if (prior && ++priorMiss > 5) {
          prior = null;
          priorColors = null;
        }
      }
    }
  }

  // 帧运动量 (网格 bbox 内帧差; 静止 vs 拧转双峰) + 2-means 阈值
  const frameMotion: number[] = new Array(n).fill(Infinity);
  for (let i = 1; i < n; i++) {
    const g = (grids[i][0] ?? grids[i - 1][0])?.grid;
    if (!g) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of [-0.5, 2.5]) {
      for (const c of [-0.5, 2.5]) {
        const x = g.origin.x + c * g.v1.x + r * g.v2.x;
        const y = g.origin.y + c * g.v1.y + r * g.v2.y;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    const x0 = Math.max(0, Math.round(minX)), x1 = Math.min(meta.w - 1, Math.round(maxX));
    const y0 = Math.max(0, Math.round(minY)), y1 = Math.min(meta.h - 1, Math.round(maxY));
    if (x1 <= x0 || y1 <= y0) continue;
    const a = frameAt(i), b = frameAt(i - 1);
    let sum = 0, cnt = 0;
    for (let y = y0; y <= y1; y += 2) {
      for (let x = x0; x <= x1; x += 2) {
        const p = (y * meta.w + x) * 3;
        sum += Math.abs(a[p] - b[p]) + Math.abs(a[p + 1] - b[p + 1]) + Math.abs(a[p + 2] - b[p + 2]);
        cnt++;
      }
    }
    frameMotion[i] = sum / (3 * cnt);
  }
  const finiteMot = frameMotion.filter(Number.isFinite).sort((a, b) => a - b);
  let motThresh = Infinity;
  if (finiteMot.length >= 10) {
    let c0 = finiteMot[Math.floor(finiteMot.length * 0.1)];
    let c1 = finiteMot[Math.floor(finiteMot.length * 0.9)];
    for (let it = 0; it < 30; it++) {
      const mid = (c0 + c1) / 2;
      let s0 = 0, n0 = 0, s1 = 0, n1 = 0;
      for (const m of finiteMot) {
        if (m <= mid) { s0 += m; n0++; } else { s1 += m; n1++; }
      }
      if (!n0 || !n1) break;
      c0 = s0 / n0;
      c1 = s1 / n1;
    }
    motThresh = (c0 + c1) / 2;
  }
  const nRest = finiteMot.filter((m) => m <= motThresh).length;

  // 多链成链 (运动门控帧不入链; 桥接 ≤2 空隙)
  const chains: ChainObs[] = [];
  const rawChains: { idxs: number[]; obss: FaceObservation[] }[] = [];
  const chainFromFrames = (idxs: number[], obss: FaceObservation[], need: number, fallback: boolean): ChainObs | null => {
    const samples: CellFeat[][] = Array.from({ length: 9 }, () => []);
    let cySum = 0;
    for (let t = 0; t < idxs.length; t++) {
      const ob = obss[t];
      const rgb = frameAt(idxs[t]);
      const rad = Math.max(
        2,
        0.22 * Math.min(Math.hypot(ob.grid.v1.x, ob.grid.v1.y), Math.hypot(ob.grid.v2.x, ob.grid.v2.y)),
      );
      for (let ci = 0; ci < 9; ci++) {
        const { x, y } = cellCenter(ob.grid, Math.floor(ci / 3), ci % 3);
        const m = blockMedianRGB(rgb, meta.w, meta.h, x, y, rad);
        if (m) samples[ci].push(rgbFeature(m.r, m.g, m.b));
      }
      cySum += cellCenter(ob.grid, 1, 1).y;
    }
    const feats = samples.map((ss) => (ss.length >= need ? medFeat(ss) : null));
    const canon = canonicalize(feats, obss[obss.length >> 1].grid);
    const filled = canon.filter(Boolean).length;
    if (filled < 4) return null;
    return {
      from: idxs[0],
      to: idxs[idxs.length - 1],
      len: idxs.length,
      feats: canon,
      filled,
      cy: cySum / idxs.length,
      fallback,
    };
  };
  {
    interface Active { idxs: number[]; obss: FaceObservation[] }
    let active: Active[] = [];
    const finish = (ch: Active) => {
      if (ch.idxs.length < MINLEN) return;
      const need = Math.max(2, Math.ceil(ch.idxs.length * 0.3));
      const co = chainFromFrames(ch.idxs, ch.obss, need, false);
      if (co) {
        chains.push(co);
        rawChains.push({ idxs: ch.idxs, obss: ch.obss });
      }
    };
    for (let i = 0; i < n; i++) {
      active = active.filter((ch) => {
        if (i - ch.idxs[ch.idxs.length - 1] > 3) {
          finish(ch);
          return false;
        }
        return true;
      });
      const rest = frameMotion[i] <= motThresh;
      const gs = rest ? grids[i] : [];
      const used = new Set<number>();
      for (const ch of active) {
        for (let k = 0; k < gs.length; k++) {
          if (used.has(k)) continue;
          if (agree(ch.obss[ch.obss.length - 1], gs[k])) {
            ch.obss.push(gs[k]);
            ch.idxs.push(i);
            used.add(k);
            break;
          }
        }
      }
      for (let k = 0; k < gs.length; k++) {
        if (!used.has(k)) active.push({ idxs: [i], obss: [gs[k]] });
      }
    }
    for (const ch of active) finish(ch);
  }

  // 链→边界归属: 最近 (split_k + LAG)。split = 手动作起点, 拧转滞后 0~8 帧
  // (中位 ~4) — split 后 1~2 帧的链是**拧转前**态 = 边界 k, 不是 k+1;
  // 运动峰值规则被手部持续运动污染 (峰 ≠ 拧转), 已证伪弃用。
  const N = tokens.length;
  const LAG = 4;
  const byBoundary: ChainObs[][] = Array.from({ length: N + 1 }, () => []);
  for (const ch of chains) {
    const center = (ch.from + ch.to) / 2;
    let k = 0;
    let bd = Infinity;
    for (let b = 0; b <= N; b++) {
      const d = Math.abs(center - (splitIdx[b] + LAG));
      if (d < bd) {
        bd = d;
        k = b;
      }
    }
    byBoundary[k].push(ch);
  }

  // 同态对齐自检: 同一边界的两份**时间不重叠**观测 = 同一物理状态。
  // 对齐 (4 旋转取 max) 相似度若打不过随机跨对基线, 守恒前提本身死刑。
  if (SAME_CHECK) {
    let nPair = 0;
    let alignSum = 0;
    let crossSum = 0;
    let winCnt = 0;
    const aligns: number[] = [];
    const shifted: number[] = [];
    const rotWin = [0, 0, 0, 0];
    const rotFeats = (fs: (CellFeat | null)[], k: number): (CellFeat | null)[] => {
      let out = fs;
      for (let t = 0; t < k; t++) {
        const nf: (CellFeat | null)[] = new Array(9);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) nf[r * 3 + c] = out[c * 3 + (2 - r)];
        out = nf;
      }
      return out;
    };
    for (let k = 0; k <= N; k++) {
      const cs = byBoundary[k];
      for (let i = 0; i < cs.length; i++) {
        for (let j2 = i + 1; j2 < cs.length; j2++) {
          const a = cs[i];
          const b = cs[j2];
          const ov = Math.min(a.to, b.to) - Math.max(a.from, b.from) + 1;
          if (ov > 0) continue; // 时间重叠 = 可能是 B/U 两个不同面, 跳过
          let bestAlign = -Infinity;
          let bestShifted = -Infinity; // 加 ±1 格平移 (区分平移漂移 vs 面漂移)
          let bestRot = 0;
          for (let r = 0; r < 4; r++) {
            const rb = rotFeats(b.feats, r);
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                let s = 0;
                let c2 = 0;
                for (let rr = 0; rr < 3; rr++) {
                  for (let cc2 = 0; cc2 < 3; cc2++) {
                    const r2 = rr + dr;
                    const c3 = cc2 + dc;
                    if (r2 < 0 || r2 > 2 || c3 < 0 || c3 > 2) continue;
                    const p = a.feats[rr * 3 + cc2];
                    const q = rb[r2 * 3 + c3];
                    if (p && q) {
                      s += sim(p, q);
                      c2++;
                    }
                  }
                }
                if (c2 >= 4) {
                  const m = s / c2;
                  if (dr === 0 && dc === 0 && m > bestAlign) bestAlign = m;
                  if (m > bestShifted) {
                    bestShifted = m;
                    bestRot = r;
                  }
                }
              }
            }
          }
          if (!Number.isFinite(bestAlign)) continue;
          shifted.push(bestShifted);
          if (bestShifted > -12) rotWin[bestRot]++; // 只统计对齐质量好的对 (差对的旋转是噪声)
          let cs2 = 0;
          let cc = 0;
          for (const p of a.feats) for (const q of b.feats) {
            if (p && q) {
              cs2 += sim(p, q);
              cc++;
            }
          }
          const cross = cs2 / cc;
          nPair++;
          alignSum += bestAlign;
          crossSum += cross;
          if (bestAlign > cross) winCnt++;
          aligns.push(bestAlign);
        }
      }
    }
    aligns.sort((a, b) => a - b);
    shifted.sort((a, b) => a - b);
    const q = (p: number) => (aligns.length ? aligns[Math.min(aligns.length - 1, Math.floor(p * aligns.length))] : NaN);
    const qsh = (p: number) => (shifted.length ? shifted[Math.min(shifted.length - 1, Math.floor(p * shifted.length))] : NaN);
    console.log(
      `${meta.video} 同态自检: ${nPair} 对, 对齐均值 ${(alignSum / Math.max(1, nPair)).toFixed(2)} vs 随机基线 ${(crossSum / Math.max(1, nPair)).toFixed(2)}, 对齐胜率 ${((winCnt / Math.max(1, nPair)) * 100).toFixed(0)}%  分位 p10=${q(0.1).toFixed(1)} p25=${q(0.25).toFixed(1)} p50=${q(0.5).toFixed(1)} p75=${q(0.75).toFixed(1)} p90=${q(0.9).toFixed(1)}`,
    );
    console.log(
      `  +平移对齐: p10=${qsh(0.1).toFixed(1)} p25=${qsh(0.25).toFixed(1)} p50=${qsh(0.5).toFixed(1)} p75=${qsh(0.75).toFixed(1)} p90=${qsh(0.9).toFixed(1)}  好对胜出旋转分布 [${rotWin.join(",")}]`,
    );
    // 链内 split-half 自距: 特征稳定性下限 (同链同网格同索引, 前半共识 vs 后半共识)
    const selfs: number[] = [];
    for (const raw of rawChains) {
      if (raw.idxs.length < 4) continue;
      const h = raw.idxs.length >> 1;
      const need = 2;
      const c1 = chainFromFrames(raw.idxs.slice(0, h), raw.obss.slice(0, h), need, false);
      const c2 = chainFromFrames(raw.idxs.slice(h), raw.obss.slice(h), need, false);
      if (!c1 || !c2) continue;
      let s = 0;
      let cc = 0;
      for (let ci = 0; ci < 9; ci++) {
        const p = c1.feats[ci];
        const q2 = c2.feats[ci];
        if (p && q2) {
          s += sim(p, q2);
          cc++;
        }
      }
      if (cc >= 4) selfs.push(s / cc);
    }
    selfs.sort((a, b) => a - b);
    const qs = (p: number) => (selfs.length ? selfs[Math.min(selfs.length - 1, Math.floor(p * selfs.length))] : NaN);
    console.log(
      `  链内 split-half 自距 (${selfs.length} 条): p10=${qs(0.1).toFixed(1)} p25=${qs(0.25).toFixed(1)} p50=${qs(0.5).toFixed(1)} p75=${qs(0.75).toFixed(1)} p90=${qs(0.9).toFixed(1)}`,
    );
  }

  // 每边界一个视图集: 时间重叠双链 → B/U 配对联合; 单链 → 两个 View 各押身份
  const fbUsed: boolean[] = new Array(N + 1).fill(false);
  const boundaryViews: (View[] | null)[] = byBoundary.map((cs, k) => {
    const sorted = [...cs].sort((a, b) => b.filled - a.filled || b.len - a.len).slice(0, 6);
    let bestPair: [ChainObs, ChainObs] | null = null;
    let bestPf = -1;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        const ov = Math.min(a.to, b.to) - Math.max(a.from, b.from) + 1;
        if (ov < 0.5 * Math.min(a.len, b.len)) continue;
        if (a.filled + b.filled > bestPf) {
          bestPf = a.filled + b.filled;
          bestPair = a.cy >= b.cy ? [a, b] : [b, a];
        }
      }
    }
    if (bestPair) return [{ b: bestPair[0], u: bestPair[1] }];
    if (sorted.length) return [{ b: sorted[0], u: null }, { b: null, u: sorted[0] }];
    if (NO_FB) return null;
    // 回退: v1 单帧提取 (取可读格最多的偏移帧)
    let bestObs: ChainObs[] = [];
    let bestFilled = -1;
    for (const off of [0, 1, -1, 2]) {
      const i = splitIdx[k] + off;
      if (i < 0 || i >= n) continue;
      const obs = extractFaceObservations(frameAt(i), meta.w, meta.h, mask, {});
      if (!obs.length) continue;
      const cos = obs
        .map((o) => chainFromFrames([i], [o], 1, true))
        .filter((c): c is ChainObs => c !== null);
      const filled = cos.reduce((s, c) => s + c.filled, 0);
      if (filled > bestFilled) {
        bestFilled = filled;
        bestObs = cos;
      }
    }
    if (!bestObs.length) return null;
    fbUsed[k] = true;
    if (bestObs.length >= 2) {
      const [a, b] = bestObs[0].cy >= bestObs[1].cy ? [bestObs[0], bestObs[1]] : [bestObs[1], bestObs[0]];
      return [{ b: a, u: b }];
    }
    return [{ b: bestObs[0], u: null }, { b: null, u: bestObs[0] }];
  });

  // 神谕诊断: GT 物理回放边界态 (boundary k = token k 前态; N = 复原前 tail 旋转态)
  if (ORACLE || ORACLE_COV) {
    const fullSeq = [...tokens, ...tailRotations];
    const states: number[][] = new Array(N + 1);
    let cur: number[] = [...IDENTITY_PERM];
    for (let j = fullSeq.length - 1; j >= 0; j--) {
      cur = ((sc: readonly number[], perm: readonly number[]) => {
        const next = new Array<number>(54);
        for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
        return next;
      })(cur, invertPerm(physicalPerm(fullSeq[j])));
      if (j <= N) states[j] = cur;
    }
    if (fullSeq.length === N) states[N] = [...IDENTITY_PERM];
    const colorFeat = (fid: number): CellFeat => ({
      a: 100 * Math.cos((fid * Math.PI) / 3),
      b: 100 * Math.sin((fid * Math.PI) / 3),
      v: 128,
    });
    const aB0 = B_ASSIGNS[0];
    const aU0 = U_ASSIGNS[0];
    const synth = (k: number, assign: readonly number[], keep: ((i: number) => boolean) | null): ChainObs => {
      const feats = Array.from({ length: 9 }, (_, i) =>
        !keep || keep(i) ? colorFeat(Math.floor(states[k][assign[i]] / 9)) : null,
      );
      return { from: 0, to: 0, len: 1, feats, filled: feats.filter(Boolean).length, cy: 0, fallback: false };
    };
    for (let k = 0; k <= N; k++) {
      if (ORACLE) {
        boundaryViews[k] = [{ b: synth(k, aB0, null), u: synth(k, aU0, null) }];
      } else if (boundaryViews[k]) {
        boundaryViews[k] = boundaryViews[k]!.map((v) => ({
          b: v.b ? synth(k, aB0, (i) => v.b!.feats[i] !== null) : null,
          u: v.u ? synth(k, aU0, (i) => v.u!.feats[i] !== null) : null,
        }));
      }
    }
  }

  const nChainBound = byBoundary.filter((cs) => cs.length > 0).length;
  const nCovBound = boundaryViews.filter(Boolean).length;
  console.log(
    `--- ${meta.video}: 链 ${chains.length} 条, 边界覆盖 ${nCovBound}/${N + 1} (链 ${nChainBound} 回退 ${nCovBound - nChainBound}), 运动阈 ${motThresh.toFixed(1)} (rest ${((nRest / Math.max(1, finiteMot.length)) * 100).toFixed(0)}%) ---`,
  );

  // 逐段守恒打分: 先算每段 16 指派组合 × 34 动作分矩阵。指派是每视频常数
  // (相机不动), 不能逐段自由 max — 否则动作被窗口旋转共轭 (U↔R/D/L 混),
  // 神谕实测天花板 73%。无监督全局拟合: 取 Σ_seg max_m 最大的组合钉死。
  const app: (CellFeat | null)[] = new Array(54).fill(null);
  const NC = 16;
  const SHIFTS: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const SHIFT_PEN = 2;
  interface SegScore {
    j: number;
    mat: Float64Array;
    pureChain: boolean;
  }
  const segScores: SegScore[] = [];
  for (let j = 0; j < N; j++) {
    const before = boundaryViews[j];
    const after = boundaryViews[j + 1];
    if (!before || !after) continue;
    const pureChain = !fbUsed[j] && !fbUsed[j + 1];

    // μ_neutral: 前后所有可读格跨对的期望相似度 (无信息基线)
    const bf: CellFeat[] = [];
    const af: CellFeat[] = [];
    const seenB = new Set<ChainObs>();
    const seenA = new Set<ChainObs>();
    for (const v of before) {
      for (const c of [v.b, v.u]) {
        if (c && !seenB.has(c)) {
          seenB.add(c);
          for (const f of c.feats) if (f) bf.push(f);
        }
      }
    }
    for (const v of after) {
      for (const c of [v.b, v.u]) {
        if (c && !seenA.has(c)) {
          seenA.add(c);
          for (const f of c.feats) if (f) af.push(f);
        }
      }
    }
    let nsum = 0;
    let ncnt = 0;
    for (const p of bf) for (const q of af) {
      nsum += sim(p, q);
      ncnt++;
    }
    const neutral = ncnt ? nsum / ncnt : -4;

    // 平移边缘化: 重获取晶格常带 ±1 格平移漂移 (同态自检实锤: 加平移 p50 -30→-10),
    // 每链独立 5 向平移假设; 假设下越界格 = 画外垃圾, 跳过; 带惩罚防噪声 max 膨胀。
    const mat = new Float64Array(NC * CANDS.length).fill(-Infinity);
    const placeShift = (co: ChainObs, assign: readonly number[], dr: number, dc: number) => {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const f = co.feats[r * 3 + c];
          if (!f) continue;
          const r2 = r + dr;
          const c2 = c + dc;
          if (r2 < 0 || r2 > 2 || c2 < 0 || c2 > 2) continue;
          app[assign[r2 * 3 + c2]] = f;
        }
      }
    };
    for (const vb of before) {
      for (const va of after) {
        const vbCombos: [number, number][] = [];
        const vaCombos: [number, number][] = [];
        for (let i = 0; i < (vb.b ? SHIFTS.length : 1); i++) {
          for (let k = 0; k < (vb.u ? SHIFTS.length : 1); k++) vbCombos.push([i, k]);
        }
        for (let i = 0; i < (va.b ? SHIFTS.length : 1); i++) {
          for (let k = 0; k < (va.u ? SHIFTS.length : 1); k++) vaCombos.push([i, k]);
        }
        for (let bi = 0; bi < 4; bi++) {
          const aB = B_ASSIGNS[bi];
          for (let ui = 0; ui < 4; ui++) {
            const aU = U_ASSIGNS[ui];
            const cBase = (bi * 4 + ui) * CANDS.length;
            for (const [sb, su] of vbCombos) {
              app.fill(null);
              let pen = 0;
              if (vb.b) {
                placeShift(vb.b, aB, SHIFTS[sb][0], SHIFTS[sb][1]);
                pen += SHIFT_PEN * (Math.abs(SHIFTS[sb][0]) + Math.abs(SHIFTS[sb][1]));
              }
              if (vb.u) {
                placeShift(vb.u, aU, SHIFTS[su][0], SHIFTS[su][1]);
                pen += SHIFT_PEN * (Math.abs(SHIFTS[su][0]) + Math.abs(SHIFTS[su][1]));
              }
              for (const [sab, sau] of vaCombos) {
                let pen2 = pen;
                if (va.b) pen2 += SHIFT_PEN * (Math.abs(SHIFTS[sab][0]) + Math.abs(SHIFTS[sab][1]));
                if (va.u) pen2 += SHIFT_PEN * (Math.abs(SHIFTS[sau][0]) + Math.abs(SHIFTS[sau][1]));
                for (let mi = 0; mi < perms.length; mi++) {
                  const perm = perms[mi];
                  let s = 0;
                  let cnt = 0;
                  if (va.b) {
                    const [dr, dc] = SHIFTS[sab];
                    for (let r = 0; r < 3; r++) {
                      for (let c = 0; c < 3; c++) {
                        const q = va.b.feats[r * 3 + c];
                        if (!q) continue;
                        const r2 = r + dr;
                        const c2 = c + dc;
                        // 越界格同样付 neutral (免费跳过会让平移假设靠丢格逃罚)
                        const p = r2 < 0 || r2 > 2 || c2 < 0 || c2 > 2 ? null : app[perm[aB[r2 * 3 + c2]]];
                        s += p ? sim(q, p) : neutral;
                        cnt++;
                      }
                    }
                  }
                  if (va.u) {
                    const [dr, dc] = SHIFTS[sau];
                    for (let r = 0; r < 3; r++) {
                      for (let c = 0; c < 3; c++) {
                        const q = va.u.feats[r * 3 + c];
                        if (!q) continue;
                        const r2 = r + dr;
                        const c2 = c + dc;
                        const p = r2 < 0 || r2 > 2 || c2 < 0 || c2 > 2 ? null : app[perm[aU[r2 * 3 + c2]]];
                        s += p ? sim(q, p) : neutral;
                        cnt++;
                      }
                    }
                  }
                  if (cnt) {
                    const mean = s / cnt - pen2;
                    if (mean > mat[cBase + mi]) mat[cBase + mi] = mean;
                  }
                }
              }
            }
          }
        }
      }
    }
    segScores.push({ j, mat, pureChain });
  }

  // 全局指派组合拟合 (无监督: 每段最优动作分之和最大)
  let bestCombo = 0;
  let bestTot = -Infinity;
  for (let c = 0; c < NC; c++) {
    let tot = 0;
    for (const ss of segScores) {
      let m = -Infinity;
      for (let mi = 0; mi < CANDS.length; mi++) {
        const v = ss.mat[c * CANDS.length + mi];
        if (v > m) m = v;
      }
      if (Number.isFinite(m)) tot += m;
    }
    if (tot > bestTot) {
      bestTot = tot;
      bestCombo = c;
    }
  }
  if (FORCE_COMBO >= 0) bestCombo = FORCE_COMBO;

  allSeg += N;
  let cov = 0;
  let faceOk = 0;
  let faceOk2 = 0;
  let moveOk = 0;
  for (const ss of segScores) {
    const j = ss.j;
    cov++;
    allCov++;
    if (ss.pureChain) chainCov++;
    const scores = CANDS.map((m, mi) => ({ m, s: ss.mat[bestCombo * CANDS.length + mi] })).sort(
      (a, b) => b.s - a.s,
    );

    const gtFace = getFace(tokens[j]) ?? "?";
    const gtPermKey = physicalPerm(tokens[j]).join(",");
    const predFace = getFace(scores[0].m) ?? "?";
    const top2Faces = [...new Set(scores.slice(0, 4).map((x) => getFace(x.m)))].slice(0, 2);
    if (predFace === gtFace) {
      faceOk++;
      allFaceOk++;
      if (ss.pureChain) chainFaceOk++;
    }
    if (top2Faces.includes(gtFace)) {
      faceOk2++;
      allFaceOk2++;
    }
    const mi = scores.findIndex((x) => physicalPerm(x.m).join(",") === gtPermKey);
    if (mi === 0) {
      moveOk++;
      allMoveOk++;
    }
    const row = confusion.get(gtFace) ?? new Map();
    row.set(predFace, (row.get(predFace) ?? 0) + 1);
    confusion.set(gtFace, row);
    if (DO_HIST) {
      const desc = (vs: View[]) => {
        const v0 = vs[0];
        const c = v0.b ?? v0.u!;
        const kind = c.fallback ? "回退" : v0.b && v0.u ? "双链" : "单链";
        return `${kind}[${c.from + frame0}..${c.to + frame0}]`;
      };
      console.log(
        `  段${j} ${tokens[j]} (${gtFace}): 前${desc(boundaryViews[j]!)} 后${desc(boundaryViews[j + 1]!)}  ` +
          scores.slice(0, 4).map((x) => `${x.m} ${x.s.toFixed(2)}`).join("  ") +
          (predFace === gtFace ? "" : "  ✗"),
      );
    }
  }
  console.log(
    `${meta.video}: 覆盖 ${cov}/${N}, face top1 ${((faceOk / Math.max(1, cov)) * 100).toFixed(1)}% top2 ${((faceOk2 / Math.max(1, cov)) * 100).toFixed(1)}%, move top1 ${((moveOk / Math.max(1, cov)) * 100).toFixed(1)}% (组合 ${bestCombo})`,
  );
}

console.log(
  `\n合计: 覆盖 ${allCov}/${allSeg} (${((allCov / allSeg) * 100).toFixed(0)}%), face top1 ${((allFaceOk / allCov) * 100).toFixed(1)}% top2 ${((allFaceOk2 / allCov) * 100).toFixed(1)}%, move top1 ${((allMoveOk / allCov) * 100).toFixed(1)}% (probs 基线 argmax 57.6%/top2 79.0%)`,
);
console.log(
  `纯链子集: 覆盖 ${chainCov}/${allSeg} (${((chainCov / allSeg) * 100).toFixed(0)}%), face top1 ${((chainFaceOk / Math.max(1, chainCov)) * 100).toFixed(1)}%`,
);
const faces = [...confusion.keys()].sort();
const preds = [...new Set([...confusion.values()].flatMap((r) => [...r.keys()]))].sort();
console.log("\n混淆 (行=真 face, 列=预测):");
console.log("      " + preds.map((p) => p.padStart(4)).join(""));
for (const f of faces) {
  const row = confusion.get(f)!;
  console.log(`  ${f.padStart(3)} ` + preds.map((p) => String(row.get(p) ?? 0).padStart(4)).join(""));
}
