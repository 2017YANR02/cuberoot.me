/**
 * motion-detect.ts — Step 1: 从速拧视频切分 静止/转动 片段 (对应 motion_detect.py)。
 *
 * 两层:
 *   - segmentFromDiffs(diffs, fps): 纯状态机 (阈值+回滞→聚合→过滤短段→合并), 可单测,
 *     并修掉原 Python 空输入即 IndexError 的 bug。
 *   - computeFrameDiffs(video): ffmpeg 单 pass 流式算 ROI 灰度帧差均值喂给状态机。
 *
 * 注意: ffmpeg 的 gray/gblur 与 cv2 的 BGR2GRAY/GaussianBlur 近似不同, 帧差 *幅值* 与
 * cv2 略有出入 (同 B 面色的 H.264 解码差), 但状态机逻辑与 Python 逐值一致 (parity-motion.ts)。
 */
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ============================================================
// 配置 (与 motion_detect.py 完全一致)
// ============================================================

/** 魔方 ROI (归一化坐标, 相对整帧): 左上 (X1,Y1) 右下 (X2,Y2) */
export const ROI_X1 = 0.25, ROI_Y1 = 0.15;
export const ROI_X2 = 0.75, ROI_Y2 = 0.85;

export const MOTION_THRESHOLD = 5.0; // 高于此 → 运动帧
export const STATIC_THRESHOLD = 3.0; // 低于此 → 静止帧 (回滞防抖)
export const MIN_MOVE_FRAMES = 3; // 过短运动段视为噪声
export const MIN_STATIC_FRAMES = 5; // 过短静止间隔并入同一动作

export type SegType = "STATIC" | "MOVING";

export interface Segment {
  type: SegType;
  startFrame: number;
  endFrame: number;
  startTime?: number;
  endTime?: number;
}

// ============================================================
// 纯状态机 (可单测)
// ============================================================

/**
 * 由逐帧差值序列切分片段。diffs[i] = 帧 i 与 i+1 的 ROI 灰度绝对差均值
 * (即 diffs 从第 1 帧起, 与 motion_detect.py 同)。空输入返回 []。
 */
export function segmentFromDiffs(diffs: number[], fps: number): Segment[] {
  if (diffs.length === 0) return []; // 修 Python 的空输入 IndexError

  // 逐帧状态 (带回滞)
  const states: SegType[] = [];
  let state: SegType = "STATIC";
  for (const diff of diffs) {
    if (state === "STATIC") {
      if (diff > MOTION_THRESHOLD) state = "MOVING";
    } else {
      if (diff < STATIC_THRESHOLD) state = "STATIC";
    }
    states.push(state);
  }

  // 聚合为片段 (startFrame = startIdx+1, 因 diffs 从第 1 帧起)
  const rawSegments: Segment[] = [];
  let currState = states[0];
  let startIdx = 0;
  for (let i = 1; i < states.length; i++) {
    if (states[i] !== currState) {
      rawSegments.push({ type: currState, startFrame: startIdx + 1, endFrame: i });
      currState = states[i];
      startIdx = i;
    }
  }
  rawSegments.push({ type: currState, startFrame: startIdx + 1, endFrame: states.length });

  // 过短运动段 → 静止
  const filtered: Segment[] = rawSegments.map((seg) => {
    const duration = seg.endFrame - seg.startFrame;
    return seg.type === "MOVING" && duration < MIN_MOVE_FRAMES ? { ...seg, type: "STATIC" as const } : seg;
  });

  // 合并相邻同类型
  const merged: Segment[] = [{ ...filtered[0] }];
  for (const seg of filtered.slice(1)) {
    const last = merged[merged.length - 1];
    if (seg.type === last.type) last.endFrame = seg.endFrame;
    else merged.push({ ...seg });
  }

  // 过短静止间隔 → 运动 (需前面已有段)
  const filtered2: Segment[] = [];
  for (const seg of merged) {
    const duration = seg.endFrame - seg.startFrame;
    if (seg.type === "STATIC" && duration < MIN_STATIC_FRAMES && filtered2.length) seg.type = "MOVING";
    filtered2.push(seg);
  }

  // 再次合并
  const final: Segment[] = [{ ...filtered2[0] }];
  for (const seg of filtered2.slice(1)) {
    const last = final[final.length - 1];
    if (seg.type === last.type) last.endFrame = seg.endFrame;
    else final.push({ ...seg });
  }

  // 时间信息
  for (const seg of final) {
    seg.startTime = seg.startFrame / fps;
    seg.endTime = seg.endFrame / fps;
  }
  return final;
}

// ============================================================
// ffmpeg 帧差喂料
// ============================================================

interface VideoMeta {
  fps: number;
  width: number;
  height: number;
}

/** 用 ffprobe 取 帧率/宽/高。 */
export function probeVideo(videoPath: string, ffprobePath = "ffprobe"): VideoMeta {
  const args = [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate",
    "-of", "json", videoPath,
  ];
  const res = spawnSync(ffprobePath, args, { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`ffprobe failed (${res.status}): ${res.stderr || res.error}`);
  const stream = (JSON.parse(res.stdout).streams ?? [])[0];
  if (!stream) throw new Error(`ffprobe: ${videoPath} 无视频流`);
  const [num, den] = String(stream.r_frame_rate).split("/").map(Number);
  const fps = den ? num / den : num;
  if (!Number.isFinite(fps) || fps <= 0) throw new Error(`ffprobe: 非法帧率 "${stream.r_frame_rate}"`);
  return { fps, width: stream.width, height: stream.height };
}

/** ROI 归一化坐标 → 像素裁剪框 (int 截断, 与 Python 一致)。 */
export function roiCrop(width: number, height: number): { x: number; y: number; w: number; h: number } {
  const x1 = Math.floor(width * ROI_X1), y1 = Math.floor(height * ROI_Y1);
  const x2 = Math.floor(width * ROI_X2), y2 = Math.floor(height * ROI_Y2);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * ffmpeg 单 pass 流式计算逐帧 ROI 灰度帧差均值 (仅驻留 2 帧, 支持长 4K 视频)。
 * 顺序: format=gray → gblur(sigma≈1.1, 对应 cv2 GaussianBlur 5×5) → crop 到 ROI。
 */
export function computeFrameDiffs(
  videoPath: string,
  ffmpegPath = "ffmpeg",
  ffprobePath = "ffprobe",
): Promise<{ diffs: number[]; fps: number; width: number; height: number }> {
  const meta = probeVideo(videoPath, ffprobePath);
  const crop = roiCrop(meta.width, meta.height);
  const frameBytes = crop.w * crop.h;
  const vf = `format=gray,gblur=sigma=1.1,crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`;
  const args = [
    "-hide_banner", "-v", "error", "-i", videoPath,
    "-vf", vf, "-fps_mode", "passthrough",
    "-pix_fmt", "gray", "-f", "rawvideo", "pipe:1",
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args);
    const diffs: number[] = [];
    let prev: Uint8Array | null = null;
    let pending: Buffer = Buffer.alloc(0);
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      let off = 0;
      while (pending.length - off >= frameBytes) {
        const frame = pending.subarray(off, off + frameBytes);
        if (prev) {
          let sum = 0;
          for (let i = 0; i < frameBytes; i++) sum += Math.abs(frame[i] - prev[i]);
          diffs.push(sum / frameBytes);
        }
        prev = new Uint8Array(frame); // 拷贝, 脱离 pending 底层
        off += frameBytes;
      }
      if (off) pending = Buffer.from(pending.subarray(off));
    });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`ffmpeg failed (${code}): ${stderr}`));
      else resolve({ diffs, fps: meta.fps, width: meta.width, height: meta.height });
    });
  });
}

/** 完整 Step 1: 抽帧差 → 状态机切分。 */
export async function detectMotionSegments(
  videoPath: string,
  ffmpegPath = "ffmpeg",
  ffprobePath = "ffprobe",
): Promise<{ segments: Segment[]; diffs: number[]; fps: number; totalFrames: number }> {
  const { diffs, fps } = await computeFrameDiffs(videoPath, ffmpegPath, ffprobePath);
  const segments = segmentFromDiffs(diffs, fps);
  return { segments, diffs, fps, totalFrames: diffs.length + 1 };
}

/** 打印运动时间线 (对应 motion_detect.printTimeline)。 */
export function printTimeline(segments: Segment[]): void {
  let moveCount = 0;
  console.log("\n" + "=".repeat(70));
  console.log("Motion Timeline");
  console.log("=".repeat(70));
  for (const seg of segments) {
    const duration = (seg.endTime ?? 0) - (seg.startTime ?? 0);
    const frameCount = seg.endFrame - seg.startFrame;
    const label = seg.type === "MOVING" ? `  MOVE #${String(++moveCount).padStart(2)}` : "  STATIC   ";
    console.log(
      `${label}  [${(seg.startTime ?? 0).toFixed(2)}s - ${(seg.endTime ?? 0).toFixed(2)}s]` +
      `  (${duration.toFixed(2)}s, ${frameCount} frames)`,
    );
  }
  console.log("=".repeat(70));
  console.log(`Total moves detected: ${moveCount}`);
  console.log(`Total segments: ${segments.length}`);
}

// CLI: tsx src/motion-detect.ts <video.mp4>
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const videoPath = process.argv[2];
  if (!videoPath) {
    console.error("Usage: tsx src/motion-detect.ts <video.mp4>");
    process.exit(1);
  }
  console.log(`Analyzing: ${videoPath}`);
  detectMotionSegments(videoPath)
    .then(({ segments, diffs, fps, totalFrames }) => {
      console.log(`Computed ${diffs.length} frame diffs (${totalFrames} frames, ${fps.toFixed(2)} fps)`);
      printTimeline(segments);
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
