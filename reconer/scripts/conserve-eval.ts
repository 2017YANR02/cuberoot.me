/**
 * conserve-eval.ts — 贴纸外观守恒动作打分: 分类之外的第三条证据通道。
 *
 * 原理: 一步动作 = 可见格的已知置换。候选动作 m 下, 段后格 i 的外观应等于
 * 段前来源格 j 的外观 (来源可见时), 比的是**原始 RGB 相似度, 零颜色分类** —
 * 负结果⑤⑥⑦杀的是外观→标签映射 (类间重叠), 未杀同一贴纸跨一步的自相似。
 *
 * 评分 (每段, 指派/视图边缘化 max):
 *   score(m|A,oA,oB) = Σ_i  sim(after[i], before[j])   (j = A⁻¹[π_m[A[i]]] 可见)
 *                        |  μ_neutral                   (来源藏面, 无信息)
 *   关键: 预测"不动"的格实际大变 → 付大负分 (F 假设不能在 U 段白捡);
 *   全流入的转体假设 (y) 恰得中性分×9 — 其他假设付错分时 y 靠"无罪"胜出。
 *
 * 用法: npx tsx scripts/conserve-eval.ts [--video 1] [--hist]
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { assignsForFaces } from "../src/anchored-search.ts";
import { blockMedianRGB, rgbFeature } from "../src/color-calib.ts";
import { getFace } from "../src/notation.ts";
import { physicalPerm } from "../src/rotation-perms.ts";
import { parseGT, parseSplitFrames } from "../src/splits.ts";
import {
  activityMask,
  cellCenter,
  extractFaceObservations,
  medianBackground,
} from "../src/sticker-blobs.ts";

const vArg = process.argv.indexOf("--video");
const ONLY = vArg >= 0 ? process.argv[vArg + 1] : null;
const DO_HIST = process.argv.includes("--hist");

/** 候选动作 (GT 记谱只涉及 U D L R F B? + 宽转 r f u + 转体 x y) */
const CANDS = [
  "U", "U'", "U2", "D", "D'", "D2", "R", "R'", "R2", "L", "L'", "L2",
  "F", "F'", "F2", "B", "B'", "B2",
  "r", "r'", "r2", "f", "f'", "f2", "u", "u'", "u2",
  "y", "y'", "y2", "x", "x'", "x2",
] as const;

const ASSIGNS = assignsForFaces(["B", "U"]);
const END_OFFS = [0, 1, -1, 2];

interface CellObs {
  /** (a,b,v) 色度盘特征, null = 不可读 */
  feats: ({ a: number; b: number; v: number } | null)[];
  filled: number;
}

/** -d² 相似度 (色度盘 σc=25, 明度 σv=40) */
function sim(p: { a: number; b: number; v: number }, q: { a: number; b: number; v: number }): number {
  const da = (p.a - q.a) / 25;
  const db = (p.b - q.b) / 25;
  const dv = (p.v - q.v) / 40;
  return -(da * da + db * db + dv * dv);
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
const confusion = new Map<string, Map<string, number>>();

for (const sf of files) {
  const splitsPath = join(videosDir, sf);
  const videoPath = splitsPath.replace(/\.splits\.txt$/, "");
  const dumpJson = videoPath + ".framedump.json";
  if (!existsSync(dumpJson)) continue;
  const content = readFileSync(splitsPath, "utf8");
  const { tokens } = parseGT(content);
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

  // 每边界: 候选偏移中取"总可读格最多"的一帧的观测列表 (每面一个 CellObs)
  const boundaryObs: CellObs[][] = splitFrames.map((sFrame) => {
    let best: CellObs[] = [];
    let bestFilled = -1;
    for (const off of END_OFFS) {
      const i = sFrame - frame0 + off;
      if (i < 0 || i >= n) continue;
      const rgb = frameAt(i);
      const obs = extractFaceObservations(rgb, meta.w, meta.h, mask, {});
      if (!obs.length) continue;
      const cells: CellObs[] = obs.map((o) => {
        const rad = Math.max(
          2,
          0.22 * Math.min(Math.hypot(o.grid.v1.x, o.grid.v1.y), Math.hypot(o.grid.v2.x, o.grid.v2.y)),
        );
        const feats = Array.from({ length: 9 }, (_, ci) => {
          const { x, y } = cellCenter(o.grid, Math.floor(ci / 3), ci % 3);
          const m = blockMedianRGB(rgb, meta.w, meta.h, x, y, rad);
          return m ? rgbFeature(m.r, m.g, m.b) : null;
        });
        return { feats, filled: feats.filter(Boolean).length };
      });
      const filled = cells.reduce((s, c) => s + c.filled, 0);
      if (filled > bestFilled) {
        bestFilled = filled;
        best = cells;
      }
    }
    return best;
  });

  let cov = 0;
  let faceOk = 0;
  let faceOk2 = 0;
  let moveOk = 0;
  for (let j = 0; j < tokens.length; j++) {
    allSeg++;
    const before = boundaryObs[j];
    const after = boundaryObs[j + 1];
    if (!before.length || !after.length) continue;
    cov++;
    allCov++;

    // μ_neutral: 段内随机跨格对的期望相似度 (无信息基线)
    let nsum = 0;
    let ncnt = 0;
    for (const oA of before) {
      for (const oB of after) {
        for (let i = 0; i < 9; i++) {
          for (let k = 0; k < 9; k++) {
            const p = oA.feats[i];
            const q = oB.feats[k];
            if (p && q) {
              nsum += sim(p, q);
              ncnt++;
            }
          }
        }
      }
    }
    const neutral = ncnt ? nsum / ncnt : -4;

    const scores = perms.map((perm, mi) => {
      let best = -Infinity;
      for (const oA of before) {
        for (const oB of after) {
          for (const assign of ASSIGNS) {
            const inv = new Map<number, number>();
            for (let i = 0; i < 9; i++) inv.set(assign[i], i);
            let s = 0;
            let scored = 0;
            for (let i = 0; i < 9; i++) {
              const q = oB.feats[i];
              if (!q) continue;
              const srcPos = perm[assign[i]];
              const srcCell = inv.get(srcPos);
              const p = srcCell !== undefined ? oA.feats[srcCell] : null;
              if (p) {
                s += sim(q, p);
                scored++;
              } else {
                s += neutral;
              }
            }
            // scored=0 (全流入) 合法 — 中性分即其证据
            if (s > best) best = s;
          }
        }
      }
      return { m: CANDS[mi], s: best };
    });
    scores.sort((a, b) => b.s - a.s);

    const gtFace = getFace(tokens[j]) ?? "?";
    const gtPermKey = physicalPerm(tokens[j]).join(",");
    const predFace = getFace(scores[0].m) ?? "?";
    const top2Faces = [...new Set(scores.slice(0, 4).map((x) => getFace(x.m)))].slice(0, 2);
    if (predFace === gtFace) {
      faceOk++;
      allFaceOk++;
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
      console.log(
        `  段${j} ${tokens[j]} (${gtFace}): ` +
          scores.slice(0, 4).map((x) => `${x.m} ${x.s.toFixed(1)}`).join("  ") +
          (predFace === gtFace ? "" : "  ✗"),
      );
    }
  }
  console.log(
    `${meta.video}: 覆盖 ${cov}/${tokens.length}, face top1 ${((faceOk / cov) * 100).toFixed(1)}% top2 ${((faceOk2 / cov) * 100).toFixed(1)}%, move top1 ${((moveOk / cov) * 100).toFixed(1)}%`,
  );
}

console.log(
  `\n合计: 覆盖 ${allCov}/${allSeg} (${((allCov / allSeg) * 100).toFixed(0)}%), face top1 ${((allFaceOk / allCov) * 100).toFixed(1)}% top2 ${((allFaceOk2 / allCov) * 100).toFixed(1)}%, move top1 ${((allMoveOk / allCov) * 100).toFixed(1)}% (probs 基线 argmax 57.6%/top2 79.0%)`,
);
const faces = [...confusion.keys()].sort();
const preds = [...new Set([...confusion.values()].flatMap((r) => [...r.keys()]))].sort();
console.log("\n混淆 (行=真 face, 列=预测):");
console.log("      " + preds.map((p) => p.padStart(4)).join(""));
for (const f of faces) {
  const row = confusion.get(f)!;
  console.log(`  ${f.padStart(3)} ` + preds.map((p) => String(row.get(p) ?? 0).padStart(4)).join(""));
}
