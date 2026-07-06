/**
 * oracle-diag.ts — GT 路径回放诊断。
 *
 * 1. 沿 GT token 逐段倒推, 验证终态 == 打乱态 (锚点可达性, 排除引擎 bug)
 * 2. 计算 GT 路径在当前评分下的累积得分, 与 beam 最优路径得分对比
 *    → 差距 = exp(gap) 量级的路径排在 GT 前面, 决定纯 beam 是否可行
 * 3. 报告每段 GT 面在 probs 里的排名分布 (top1/top2/top3/未列出)
 */
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { CubeState } from "../src/cube-state.ts";
import { parseGT } from "../src/splits.ts";
import { ROTATION_TOKENS, getMoveFace } from "../src/notation.ts";
import type { ProbDist } from "../src/reconstruct.ts";
import { invertMove, normalizeToken } from "../src/anchored-search.ts";

const FLOOR = 0.03;

/** 与 buildVocabulary 一致的先验折扣 */
function priorOf(tok: string): number {
  const n = normalizeToken(tok);
  if (/x/.test(n)) return 0.25;
  if (/^U('|2)?D('|2)?$/.test(n)) return 0.35;
  if (/^[udlrf]('|2)?$/.test(n)) return 0.5;
  return 1.0;
}

const videosDir = join(import.meta.dirname, "..", "videos");
const files = readdirSync(videosDir)
  .filter((f) => f.endsWith(".splits.txt"))
  .sort()
  .map((f) => join(videosDir, f));

for (const splitsPath of files) {
  const content = readFileSync(splitsPath, "utf8");
  const probDists = JSON.parse(
    readFileSync(splitsPath.replace(/\.splits\.txt$/, ".probs.json"), "utf8"),
  ) as ProbDist[];

  const { tokens, tailRotations } = parseGT(content);
  const gtNoRot = tokens.filter((t) => !ROTATION_TOKENS.has(t));

  // 打乱态 (锚点)
  const scramble = new CubeState();
  const fullSeq = [...tokens, ...tailRotations];
  for (let i = fullSeq.length - 1; i >= 0; i--) scramble.apply(invertMove(fullSeq[i]));

  // GT 回放: 从 solved (undo tail) 倒推
  const state = new CubeState();
  for (let i = tailRotations.length - 1; i >= 0; i--) state.apply(invertMove(tailRotations[i]));

  let score = 0;
  const rankCount = [0, 0, 0, 0, 0]; // top1/2/3/更后/未列出
  for (let t = gtNoRot.length - 1; t >= 0; t--) {
    const tok = gtNoRot[t];
    state.apply(invertMove(tok));
    const face = getMoveFace(tok);
    const dist = probDists[t] ?? {};
    const keys = Object.keys(dist);
    const rank = face ? keys.indexOf(face) : -1;
    rankCount[rank === -1 ? 4 : Math.min(rank, 3)]++;
    const p = (face && dist[face] ? dist[face] : FLOOR) * priorOf(tok);
    score += Math.log(p);
  }

  const anchorOk = state.sc.join(",") === scramble.sc.join(",");
  const name = basename(splitsPath).replace(/\.(MP4|mp4)\.splits\.txt$/, "");
  console.log(
    `${name} | 锚点可达=${anchorOk} | GT score=${score.toFixed(1)} | GT面排名 top1=${rankCount[0]} top2=${rankCount[1]} top3=${rankCount[2]} 更后=${rankCount[3]} 未列=${rankCount[4]} / ${gtNoRot.length}`,
  );
}
