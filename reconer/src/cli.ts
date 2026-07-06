/**
 * cli.ts — Step-3 逆推复盘入口 (对应 greedy_reverse.py main)。
 *
 * 用法:
 *   tsx src/cli.ts "videos/3 4.375.MP4.splits.txt"              # 有视频则自动视觉评分
 *   tsx src/cli.ts "videos/3 4.375.MP4.splits.txt" --prob-only  # 仅概率排序
 *
 * 视觉模式: ffmpeg 抽 splitFrames[t]+3 帧 → HSV 提 B 面 3×3 网格 → greedyReverse 评分。
 */
import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { parseGT, parseSplitFrames } from "./splits.ts";
import { greedyReverse, compareMoves, type BFaceGrid, type ProbDist } from "./reconstruct.ts";
import { ROTATION_TOKENS } from "./notation.ts";
import { extractRoiFrames } from "./video-frames.ts";
import { extractBFaceColors, ROI_B_FACE } from "./bface-color.ts";

const OFFSET = 3; // split 点后 3 帧: 上一动作已稳、当前未开始 (与 greedy_reverse 一致)

function buildGrids(
  videoPath: string,
  splitFrames: number[],
  nSegs: number,
): (BFaceGrid | null)[] {
  const indices = Array.from({ length: nSegs }, (_, t) => splitFrames[t] + OFFSET);
  const frames = extractRoiFrames(videoPath, indices, ROI_B_FACE);
  const byIdx = new Map(frames.map((f) => [f.index, f]));
  return indices.map((idx) => {
    const fr = byIdx.get(idx);
    return fr ? extractBFaceColors(fr.rgb, fr.w, fr.h) : null;
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const probOnly = args.includes("--prob-only");
  const splitsPath = args.find((a) => !a.startsWith("--"));
  if (!splitsPath) {
    console.error('Usage: tsx src/cli.ts "<splits.txt>" [--prob-only]');
    process.exit(1);
  }

  const content = readFileSync(splitsPath, "utf8");
  const probsPath = splitsPath.replace(/\.splits\.txt$/, ".probs.json");
  const probDists = JSON.parse(readFileSync(probsPath, "utf8")) as ProbDist[];

  const { tokens, tailRotations } = parseGT(content);
  const gtNoRot = tokens.filter((t) => !ROTATION_TOKENS.has(t));
  const videoName = basename(splitsPath).replace(/\.MP4\.splits\.txt$/, "");

  // 与 greedy_reverse.py 一致: 末尾转体段不参与逆推 (已预先 apply 其逆)
  const nTail = tailRotations.length;
  const probs = nTail ? probDists.slice(0, -nTail) : probDists;
  const splitFrames = nTail ? parseSplitFrames(content).slice(0, -nTail) : parseSplitFrames(content);

  const videoPath = splitsPath.replace(/\.splits\.txt$/, "");
  const useVisual = !probOnly && existsSync(videoPath);
  const grids = useVisual ? buildGrids(videoPath, splitFrames, probs.length) : undefined;

  console.log(`Video: ${videoName}`);
  console.log(`Mode: ${useVisual ? "visual (ffmpeg+HSV)" : "prob-only"}`);
  console.log(`Prob segments: ${probDists.length}  |  GT moves (excl rot): ${gtNoRot.length}  |  tail: ${JSON.stringify(tailRotations)}`);
  if (probDists.length !== gtNoRot.length) {
    console.log(`WARNING: count mismatch probs=${probDists.length} gt=${gtNoRot.length}`);
  }

  const { predicted, finalState } = greedyReverse(probs, tailRotations, grids);
  const cmp = compareMoves(predicted, gtNoRot);

  console.log(`\nPredicted: ${predicted.join(" ")}`);
  const pct = (n: number) => (cmp.total ? ((n / cmp.total) * 100).toFixed(1) : "0.0");
  console.log(`Face accuracy: ${cmp.faceCorrect}/${cmp.total} = ${pct(cmp.faceCorrect)}%`);
  console.log(`Full accuracy: ${cmp.fullCorrect}/${cmp.total} = ${pct(cmp.fullCorrect)}%`);

  // 自洽校验: 从逆推出的初态 (finalState) 正向执行 predicted + tail 应回到 Solved
  const check = finalState.clone();
  check.apply(predicted.join(" "));
  for (const r of tailRotations) check.apply(r);
  console.log(`Self-consistency (finalState + predicted + tail → Solved): ${check.isSolved()}`);
}

main();
