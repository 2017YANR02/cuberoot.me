/**
 * video-frames.ts — 用 ffmpeg 抽取指定帧号的 ROI 区域 (Node 无原生 OpenCV)。
 *
 * 单次 ffmpeg pass 用 select 滤镜挑出所有目标帧并 crop 到 ROI, 输出 rawvideo rgb24,
 * 按 帧号升序 切分。帧号 n 与 cv2 CAP_PROP_POS_FRAMES 同为 0 基解码序。
 */
import { spawnSync } from "node:child_process";

export interface Roi {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoiFrame {
  index: number;
  rgb: Uint8Array;
  w: number;
  h: number;
}

/** 抽取 indices 指定帧的 ROI (RGB)。返回按帧号升序; 若 ffmpeg 输出帧数不符会告警。 */
export function extractRoiFrames(
  videoPath: string,
  indices: number[],
  roi: Roi,
  ffmpegPath = "ffmpeg",
): RoiFrame[] {
  if (indices.length === 0) return [];
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const sel = "select=" + sorted.map((f) => `eq(n\\,${f})`).join("+");
  const vf = `${sel},crop=${roi.w}:${roi.h}:${roi.x}:${roi.y}`;
  const args = [
    "-hide_banner", "-v", "error", "-i", videoPath,
    "-vf", vf, "-fps_mode", "passthrough",
    "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1",
  ];
  const res = spawnSync(ffmpegPath, args, { maxBuffer: 1 << 30 });
  if (res.status !== 0) {
    throw new Error(`ffmpeg failed (${res.status}): ${res.stderr?.toString() || res.error}`);
  }

  const buf = res.stdout as Buffer;
  const frameBytes = roi.w * roi.h * 3;
  const nFrames = Math.floor(buf.length / frameBytes);
  if (nFrames !== sorted.length) {
    console.warn(`ffmpeg 输出 ${nFrames} 帧, 期望 ${sorted.length} (帧号对齐可能有偏差)`);
  }

  const out: RoiFrame[] = [];
  for (let i = 0; i < nFrames && i < sorted.length; i++) {
    const rgb = new Uint8Array(buf.buffer, buf.byteOffset + i * frameBytes, frameBytes);
    out.push({ index: sorted[i], rgb, w: roi.w, h: roi.h });
  }
  return out;
}
