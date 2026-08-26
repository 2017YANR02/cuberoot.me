/**
 * dump-hand-segments.ts — 手部通道数据准备: 每段 GT token/面标签 + 帧区间。
 *
 * splits.txt (GT) + framedump.json → hands/data/segments.json。
 * 对齐不变量: tokens.length === splitFrames.length - 1 (每段恰一个 token;
 * 组合转体如 L2'x' 是单 token 单段, 末尾校正转体不占段), 违反即报错退出。
 *
 * 用法: npx tsx scripts/dump-hand-segments.ts
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getFace } from "../src/notation.ts";
import { parseGT, parseSplitFrames } from "../src/splits.ts";

const videosDir = join(import.meta.dirname, "..", "videos");
const outDir = join(import.meta.dirname, "..", "hands", "data");

interface SegOut {
  idx: number;
  token: string;
  /** U D L R F B 或 y (纯转体段) */
  face: string;
  /** 视频帧号 (源 100fps) */
  startFrame: number;
  endFrame: number;
  /** framedump.bin 内帧索引 */
  startBin: number;
  endBin: number;
}

interface VideoOut {
  video: string;
  w: number;
  h: number;
  nBinFrames: number;
  /** bin 帧 i 对应视频帧号 frame0 + i (断言连续) */
  frame0: number;
  segments: SegOut[];
}

const out: VideoOut[] = [];
let bad = 0;

for (const sf of readdirSync(videosDir).filter((f) => f.endsWith(".splits.txt")).sort()) {
  const videoPath = join(videosDir, sf.replace(/\.splits\.txt$/, ""));
  const dumpJson = videoPath + ".framedump.json";
  if (!existsSync(dumpJson)) {
    console.warn(`跳过 (无 dump): ${sf}`);
    continue;
  }
  const content = readFileSync(join(videosDir, sf), "utf8");
  const { tokens } = parseGT(content);
  const splitFrames = parseSplitFrames(content);
  const meta = JSON.parse(readFileSync(dumpJson, "utf8")) as {
    video: string;
    w: number;
    h: number;
    frames: number[];
  };

  const nSeg = splitFrames.length - 1;
  if (tokens.length !== nSeg) {
    console.error(`✗ ${meta.video}: tokens ${tokens.length} ≠ 段数 ${nSeg} — 对齐破坏`);
    bad++;
    continue;
  }
  const frame0 = meta.frames[0];
  const contiguous = meta.frames.every((f, i) => f === frame0 + i);
  if (!contiguous) {
    console.error(`✗ ${meta.video}: framedump 帧号非连续`);
    bad++;
    continue;
  }
  const binOf = (frame: number): number => {
    const b = frame - frame0;
    if (b < 0 || b >= meta.frames.length) throw new Error(`${meta.video}: 帧 ${frame} 超出 dump 范围`);
    return b;
  };

  const segments: SegOut[] = tokens.map((token, j) => ({
    idx: j,
    token,
    face: getFace(token) ?? "?",
    startFrame: splitFrames[j],
    endFrame: splitFrames[j + 1],
    startBin: binOf(splitFrames[j]),
    endBin: binOf(splitFrames[j + 1]),
  }));
  const faceCount = new Map<string, number>();
  for (const s of segments) faceCount.set(s.face, (faceCount.get(s.face) ?? 0) + 1);
  console.log(
    `✓ ${meta.video}: ${nSeg} 段, dump ${meta.frames.length} 帧 [${frame0}..${meta.frames[meta.frames.length - 1]}], 面分布 ` +
      [...faceCount.entries()].sort().map(([f, n]) => `${f}:${n}`).join(" "),
  );
  out.push({ video: meta.video, w: meta.w, h: meta.h, nBinFrames: meta.frames.length, frame0, segments });
}

if (bad) {
  console.error(`${bad} 个视频对齐失败, 不写出`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "segments.json");
writeFileSync(outPath, JSON.stringify(out, null, 1));
const total = out.reduce((s, v) => s + v.segments.length, 0);
console.log(`\n写出 ${outPath}: ${out.length} 视频, ${total} 段`);
