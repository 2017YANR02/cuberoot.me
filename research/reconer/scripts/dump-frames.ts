/**
 * dump-frames.ts — 全程连续帧整帧降采样落盘 (供色块检测器离线迭代, 免重复解码 4K 视频)。
 *
 * 每视频单次 ffmpeg pass: [首 split-20, 末 split+20] 逐帧, 整帧 scale 到 960×540
 * raw RGB24, 写 <video>.framedump.bin + .framedump.json 索引。连续帧是静止区间检测
 * (跨帧网格稳定性) 的前提 — 稀疏偏移 dump 会把同一可读帧归到多个边界造成时间错位污染。
 * 固定 ROI 已被目检否决 (魔方在画面里大范围移动), 故存整帧。
 *
 * 用法: npx tsx scripts/dump-frames.ts [--threads 12] [--force]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseSplitFrames } from "../src/splits.ts";

const W = 960;
const H = 540;
const MARGIN = 20; // 首末 split 外扩帧数
const tArg = process.argv.indexOf("--threads");
const THREADS = tArg >= 0 ? parseInt(process.argv[tArg + 1], 10) : 12;
const FORCE = process.argv.includes("--force");

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
  if (existsSync(jsonPath) && !FORCE) {
    // 旧稀疏 dump (带 offsets 字段) 需重建; 连续 dump 已存在则跳过
    const old = JSON.parse(readFileSync(jsonPath, "utf8")) as { offsets?: unknown };
    if (!old.offsets) {
      console.log(`已存在连续 dump, 跳过: ${basename(jsonPath)}`);
      continue;
    }
    console.log(`旧稀疏 dump, 重建: ${basename(jsonPath)}`);
  }

  const splitFrames = parseSplitFrames(readFileSync(join(videosDir, sf), "utf8"));
  const from = Math.max(0, splitFrames[0] - MARGIN);
  const to = splitFrames[splitFrames.length - 1] + MARGIN;

  const t0 = Date.now();
  const partPath = binPath + ".part";
  const args = [
    "-hide_banner", "-v", "error", "-threads", String(THREADS),
    "-i", videoPath,
    "-vf", `select=between(n\\,${from}\\,${to}),scale=${W}:${H}`,
    "-fps_mode", "passthrough", "-pix_fmt", "rgb24", "-f", "rawvideo", partPath, "-y",
  ];
  const res = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
  if (res.status !== 0) throw new Error(`ffmpeg failed (${res.status}) on ${videoPath}`);
  const gotFrames = Math.floor(statSync(partPath).size / (W * H * 3));
  const expected = to - from + 1;
  if (gotFrames !== expected) {
    console.warn(`  WARN: 输出 ${gotFrames} 帧, 期望 ${expected}`);
  }
  if (existsSync(binPath)) rmSync(binPath);
  renameSync(partPath, binPath);

  const allFrames = Array.from({ length: gotFrames }, (_, i) => from + i);
  writeFileSync(
    jsonPath,
    JSON.stringify({
      video: basename(videoPath),
      w: W,
      h: H,
      sourceW: 3840,
      sourceH: 2160,
      splitFrames,
      frames: allFrames,
    }),
  );
  console.log(
    `${basename(videoPath)}: ${gotFrames} 帧 [${from}..${to}] (${(statSync(binPath).size / 1e6).toFixed(0)}MB, ${((Date.now() - t0) / 1000).toFixed(0)}s)`,
  );
}
console.log("全部完成");
