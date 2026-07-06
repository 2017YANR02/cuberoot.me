/**
 * dump-frames.ts — 段边界帧整帧降采样落盘 (供色块检测器离线迭代, 免重复解码 4K 视频)。
 *
 * 每视频单次 ffmpeg pass: 全部 split 点 (每 token 段起点 + 末点) × 偏移 {+2,+5},
 * 整帧 scale 到 960×540 raw RGB24, 写 <video>.framedump.bin + .framedump.json 索引。
 * 固定 ROI 已被目检否决 (魔方在画面里大范围移动), 故存整帧。
 *
 * 用法: npx tsx scripts/dump-frames.ts [--threads 12]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseSplitFrames } from "../src/splits.ts";

const W = 960;
const H = 540;
/** 每 split 点抽 [f-2, f+2] 连续 5 帧 + f+5 (ffmpeg 表达式项数受限, 用 between 区间) */
const OFFSETS: readonly number[] = [-2, -1, 0, 1, 2, 5];
const tArg = process.argv.indexOf("--threads");
const THREADS = tArg >= 0 ? parseInt(process.argv[tArg + 1], 10) : 12;

const videosDir = join(import.meta.dirname, "..", "videos");
const splitsFiles = readdirSync(videosDir)
  .filter((f) => f.endsWith(".splits.txt"))
  .sort();

for (const sf of splitsFiles) {
  const videoPath = join(videosDir, sf.replace(/\.splits\.txt$/, ""));
  const binPath = videoPath + ".framedump.bin";
  const jsonPath = videoPath + ".framedump.json";
  if (!existsSync(videoPath)) {
    console.warn(`跳过 (无视频): ${sf}`);
    continue;
  }
  if (existsSync(jsonPath)) {
    console.log(`已存在, 跳过: ${basename(jsonPath)}`);
    continue;
  }

  const splitFrames = parseSplitFrames(readFileSync(join(videosDir, sf), "utf8"));
  // ffmpeg 表达式解析器 ~100 项上限 → 按 split 点分块 (每块 ≤40 点 = 80 项), 分 pass 拼接
  const chunks: number[][] = [];
  for (let i = 0; i < splitFrames.length; i += 40) chunks.push(splitFrames.slice(i, i + 40));

  const t0 = Date.now();
  const allFrames: number[] = [];
  const parts: Buffer[] = [];
  for (const chunk of chunks) {
    const wanted = [...new Set(chunk.flatMap((f) => OFFSETS.map((o) => f + o)))].sort((a, b) => a - b);
    const sel =
      "select=" + chunk.map((f) => `between(n\\,${f - 2}\\,${f + 2})+eq(n\\,${f + 5})`).join("+");
    const partPath = binPath + ".part";
    const args = [
      "-hide_banner", "-v", "error", "-threads", String(THREADS),
      "-i", videoPath,
      "-vf", `${sel},scale=${W}:${H}`,
      "-fps_mode", "passthrough", "-pix_fmt", "rgb24", "-f", "rawvideo", partPath, "-y",
    ];
    const res = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
    if (res.status !== 0) throw new Error(`ffmpeg failed (${res.status}) on ${videoPath}`);
    const buf = readFileSync(partPath);
    rmSync(partPath);
    const gotFrames = Math.floor(buf.length / (W * H * 3));
    if (gotFrames !== wanted.length) {
      console.warn(`  WARN: chunk 输出 ${gotFrames} 帧, 期望 ${wanted.length}`);
    }
    allFrames.push(...wanted.slice(0, gotFrames));
    parts.push(buf.subarray(0, gotFrames * W * H * 3));
  }
  writeFileSync(binPath, Buffer.concat(parts));

  const gotBytes = statSync(binPath).size;
  writeFileSync(
    jsonPath,
    JSON.stringify({
      video: basename(videoPath),
      w: W,
      h: H,
      sourceW: 3840,
      sourceH: 2160,
      offsets: OFFSETS,
      splitFrames,
      frames: allFrames,
    }),
  );
  console.log(`  完成 ${allFrames.length} 帧 (${(gotBytes / 1e6).toFixed(0)}MB, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
console.log("全部完成");
