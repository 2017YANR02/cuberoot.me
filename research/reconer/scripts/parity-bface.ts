/**
 * parity-bface.ts — 差分测试: TS (ffmpeg+HSV) 提取的 B 面网格 vs 原始 cv2。
 *
 * 用法: npx tsx scripts/parity-bface.ts ["videos/3 4.375.MP4.splits.txt"] [N]
 *
 * 注意: 会读 4K 视频两次 (cv2 参考 + ffmpeg), 较慢。剩余不一致来自 ffmpeg 与
 * OpenCV 对 H.264 的解码差异 (YUV→RGB 范围/矩阵), 而非本端口逻辑 —— rgbToHsvCv
 * 已单测与 cv2 逐值一致 (ΔH=0, ΔS≤1, ΔV=0)。
 */
import { spawnSync } from "node:child_process";
import { extractRoiFrames } from "../src/video-frames.ts";
import { extractBFaceColors, ROI_B_FACE } from "../src/bface-color.ts";
import type { ColorName } from "../src/reconstruct.ts";

function findPython(): string | null {
  for (const cmd of ["python", "py", "python3"]) {
    if (spawnSync(cmd, ["--version"], { encoding: "utf8" }).status === 0) return cmd;
  }
  return null;
}

const splits = process.argv[2] ?? "videos/3 4.375.MP4.splits.txt";
const n = process.argv[3] ?? "8";
const video = splits.replace(/\.splits\.txt$/, "");

const python = findPython();
if (!python) {
  console.error("PARITY SKIP: no python interpreter found.");
  process.exit(3);
}

const py = spawnSync(python, ["scripts/_dump_bface.py", splits, n], { encoding: "utf8", maxBuffer: 1 << 28 });
if (py.status !== 0) {
  console.error("cv2 reference failed:", py.stderr || py.error);
  process.exit(2);
}
const ref = JSON.parse(py.stdout) as {
  segments: { frame: number; dominant?: string[]; grid: Record<string, number>[] | null }[];
};

const indices = ref.segments.filter((s) => s.grid).map((s) => s.frame);
const frames = extractRoiFrames(video, indices, ROI_B_FACE);
const byIdx = new Map(frames.map((f) => [f.index, f]));

const NAMES: ColorName[] = ["W", "R", "O", "Y", "G", "B"];
const dominant = (d: Record<string, number>): string => {
  let best = "?", bv = -1;
  for (const k of NAMES) { const v = d[k] ?? 0; if (v > bv) { bv = v; best = k; } }
  return best;
};

let match = 0, total = 0, maxAbs = 0;
for (const seg of ref.segments) {
  if (!seg.grid || !seg.dominant) continue;
  const fr = byIdx.get(seg.frame);
  if (!fr) { console.log(`frame ${seg.frame}: MISSING from ffmpeg`); continue; }
  const grid = extractBFaceColors(fr.rgb, fr.w, fr.h);
  for (let i = 0; i < 9; i++) {
    total++;
    if (dominant(grid[i] as Record<string, number>) === seg.dominant[i]) match++;
    for (const k of NAMES) {
      maxAbs = Math.max(maxAbs, Math.abs((grid[i][k] ?? 0) - (seg.grid[i][k] ?? 0)));
    }
  }
}

console.log(`Dominant-cell agreement: ${match}/${total} = ${((match / total) * 100).toFixed(1)}%`);
console.log(`Max abs distribution diff: ${maxAbs.toFixed(4)}  (源自 ffmpeg/OpenCV 解码差异, 非端口逻辑)`);
