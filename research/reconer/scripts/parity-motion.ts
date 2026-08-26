/**
 * parity-motion.ts — 差分测试: Step 1 状态机 TS vs 原始 motion_detect.py。
 *
 * 用法: npx tsx scripts/parity-motion.ts ["videos/3 4.375.MP4"] [--ffmpeg]
 *
 * 默认: Python 在真视频上算出 diffs, 把 *同一份 diffs* 喂给 TS segmentFromDiffs,
 *       逐段比对 → 纯验状态机逻辑 (绕开 ffmpeg/cv2 解码差异)。
 * --ffmpeg: 额外用 TS computeFrameDiffs 自己抽帧算 diffs 再切分, 报告与 Python 分段
 *           的一致度 (会有出入, 源于解码差异, 非状态机 bug), 需再读一遍视频, 慢。
 */
import { spawnSync } from "node:child_process";
import { segmentFromDiffs, detectMotionSegments, type Segment } from "../src/motion-detect.ts";

function findPython(): string | null {
  for (const cmd of ["python", "py", "python3"]) {
    if (spawnSync(cmd, ["--version"], { encoding: "utf8" }).status === 0) return cmd;
  }
  return null;
}

const key = (s: { type: string; startFrame: number; endFrame: number }) =>
  `${s.type}:${s.startFrame}:${s.endFrame}`;

const video = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "videos/3 4.375.MP4";
const withFfmpeg = process.argv.includes("--ffmpeg");

const python = findPython();
if (!python) {
  console.error("PARITY SKIP: no python interpreter found.");
  process.exit(3);
}

console.log(`Running motion_detect.py on ${video} (读 4K 视频, 稍慢)...`);
const py = spawnSync(python, ["scripts/_dump_motion.py", video], { encoding: "utf8", maxBuffer: 1 << 28 });
if (py.status !== 0) {
  console.error("motion_detect.py failed:", py.stderr || py.error);
  process.exit(2);
}
const ref = JSON.parse(py.stdout) as {
  fps: number;
  totalFrames: number;
  diffs: number[];
  segments: Segment[];
};

// —— 主检验: 同一份 diffs → TS 状态机应与 Python 逐段一致 ——
const tsSegs = segmentFromDiffs(ref.diffs, ref.fps);
const refKeys = ref.segments.map(key);
const tsKeys = tsSegs.map(key);
const same = refKeys.length === tsKeys.length && refKeys.every((k, i) => k === tsKeys[i]);

console.log(`\n=== 状态机 parity (共享 diffs) ===`);
console.log(`Python 段: ${ref.segments.length}  |  TS 段: ${tsSegs.length}`);
if (same) {
  console.log(`PASS: ${tsKeys.length}/${refKeys.length} 段逐值一致 ✅`);
} else {
  console.log(`FAIL: 分段不一致`);
  const n = Math.max(refKeys.length, tsKeys.length);
  for (let i = 0; i < n; i++) {
    if (refKeys[i] !== tsKeys[i]) console.log(`  [${i}] py=${refKeys[i] ?? "-"}  ts=${tsKeys[i] ?? "-"}`);
  }
  process.exitCode = 1;
}

// —— 可选: TS 自抽帧 (ffmpeg) 端到端, 与 Python 分段对照 (预期有解码差) ——
if (withFfmpeg) {
  console.log(`\n=== 端到端 (TS ffmpeg 抽帧) — 信息参考 ===`);
  const { segments: e2e, diffs: tsDiffs } = await detectMotionSegments(video);
  const moves = (s: Segment[]) => s.filter((x) => x.type === "MOVING").length;
  console.log(`diffs 数: py=${ref.diffs.length} ts=${tsDiffs.length}`);
  console.log(`MOVING 段数: py=${moves(ref.segments)} ts=${moves(e2e)}  (差异源于 ffmpeg/cv2 H.264 解码, 非状态机)`);
}
