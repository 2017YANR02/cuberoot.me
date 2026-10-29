import { DRIVE_CHUNK_BYTES } from './drive';
import type { ReconRecording } from './recon_intake';

export const RECON_CAPTURE_MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
export const RECON_CAPTURE_CHUNK_BYTES = DRIVE_CHUNK_BYTES;
export const RECON_CAPTURE_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

/** Hash every original byte in fixed blocks; no transcoding or filename-only resume identity. */
export interface ReconCaptureVideo {
  filename: string;
  sizeBytes: number;
  mimeType: string;
  lastModified: number;
  /** Browser metadata, not a verified frame clock or synchronization anchor. */
  durationMs: number | null;
  chunkBytes: number;
  chunkSha256: string[];
}
export interface ReconCaptureInput {
  sourceSolveId: string;
  recording: ReconRecording;
  driveNodeId: string;
  video: ReconCaptureVideo;
}
export interface ReconCaptureAnchor {
  moveIndex: number;
  videoTimeMs: number;
}
export type ReconCaptureSyncWarning = 'clock-scale' | 'anchor-residual' | 'outside-video'
  | 'two-anchors-only' | 'unverified-video-duration';
export interface ReconCaptureSync {
  source: 'manual-anchors';
  qualityVerified: false;
  anchors: ReconCaptureAnchor[];
  /** videoTimeMs = offsetMs + scale * recording.moves[index].ts */
  offsetMs: number;
  scale: number;
  maxResidualMs: number;
  rmsResidualMs: number;
  warnings: ReconCaptureSyncWarning[];
}
export interface ReconCapture {
  id: string;
  revision: number;
  input: ReconCaptureInput;
  recordingHash: string;
  contentHash: string;
  status: 'uploading' | 'needs-review';
  videoSha256: string | null;
  /** Server container signature, independent of client metadata. */
  videoMimeType: string | null;
  /** Server container metadata; still not evidence of real-time playback or distinct frames. */
  videoDurationMs: number | null;
  sync: ReconCaptureSync | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  upload: {
    id: string | null;
    receivedBytes: number;
    expectedBytes: number;
    chunkBytes: number;
    ready: boolean;
    available: boolean;
  };
}
export interface ReconCaptureList { items: ReconCapture[]; hasMore: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const MOVE = /^[URFDLBurfdlbMESxyz]w?(?:2'?|')?$/;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
const text = (v: unknown, limit: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= limit && !v.includes('\0');

/** Shared structural boundary for the browser, API and research downloader. */
export function validateReconCaptureInput(value: unknown): string[] {
  const errors: string[] = [];
  if (!record(value) || !keys(value, ['sourceSolveId', 'recording', 'driveNodeId', 'video'])) return ['Invalid capture input'];
  if (!text(value.sourceSolveId, 200)) errors.push('Invalid source solve ID');
  if (typeof value.driveNodeId !== 'string' || !UUID.test(value.driveNodeId)) errors.push('Invalid Drive node ID');
  const r = value.recording;
  if (!record(r) || !keys(r, ['scramble', 'moves', 'timeMs', 'model', 'gyro'])) errors.push('Invalid recording');
  else {
    if (!text(r.scramble, 4000)) errors.push('A scramble is required');
    if (!finite(r.timeMs) || r.timeMs <= 0 || r.timeMs > 86_400_000) errors.push('Invalid solve duration');
    if (typeof r.model !== 'string' || r.model.length > 100 || r.model.includes('\0')) errors.push('Invalid device model');
    if (r.gyro !== undefined && (typeof r.gyro !== 'string' || r.gyro.length > 1_500_000)) errors.push('Invalid gyro recording');
    if (!Array.isArray(r.moves) || !r.moves.length || r.moves.length > 10000) errors.push('Recorded moves are required');
    else {
      let previous = -1;
      for (const m of r.moves) {
        if (!record(m) || !keys(m, ['m', 'ts']) || typeof m.m !== 'string' || !MOVE.test(m.m)
          || !finite(m.ts) || m.ts < 0 || m.ts > 86_400_000 || m.ts < previous) {
          errors.push('Invalid move or nonmonotonic move time'); break;
        }
        previous = m.ts;
      }
    }
  }
  const v = value.video;
  if (!record(v) || !keys(v, ['filename', 'sizeBytes', 'mimeType', 'lastModified', 'durationMs', 'chunkBytes', 'chunkSha256'])) errors.push('Invalid video manifest');
  else {
    if (!text(v.filename, 255) || /[\\/\u0000-\u001f\u007f]/.test(v.filename)) errors.push('Invalid original filename');
    if (!Number.isSafeInteger(v.sizeBytes) || (v.sizeBytes as number) <= 0 || (v.sizeBytes as number) > RECON_CAPTURE_MAX_VIDEO_BYTES) errors.push('Video must be between 1 byte and 1 GiB');
    if (!RECON_CAPTURE_VIDEO_MIMES.some(mime => mime === v.mimeType)) errors.push('Use an MP4, MOV or WebM original');
    if (!Number.isSafeInteger(v.lastModified) || (v.lastModified as number) < 0) errors.push('Invalid file modification time');
    if (v.durationMs !== null && (!finite(v.durationMs) || v.durationMs <= 0 || v.durationMs > 86_400_000)) errors.push('Invalid video duration');
    if (v.chunkBytes !== RECON_CAPTURE_CHUNK_BYTES) errors.push('Invalid fingerprint block size');
    if (!Array.isArray(v.chunkSha256) || v.chunkSha256.length !== Math.ceil((v.sizeBytes as number) / RECON_CAPTURE_CHUNK_BYTES)
      || v.chunkSha256.length > RECON_CAPTURE_MAX_VIDEO_BYTES / RECON_CAPTURE_CHUNK_BYTES
      || v.chunkSha256.some(h => typeof h !== 'string' || !SHA256.test(h))) errors.push('Invalid video block fingerprints');
  }
  return errors;
}

/** A human-provided time mapping is a review aid, never a verified completion-time label. */
export function fitReconCaptureSync(
  recording: ReconRecording,
  video: ReconCaptureVideo,
  anchors: readonly ReconCaptureAnchor[],
): ReconCaptureSync {
  if (!Array.isArray(anchors) || anchors.length < 2 || anchors.length > 20) throw new Error('Provide 2–20 synchronization anchors');
  for (const anchor of anchors) {
    if (!record(anchor) || !keys(anchor, ['moveIndex', 'videoTimeMs'])
      || typeof anchor.moveIndex !== 'number' || !Number.isSafeInteger(anchor.moveIndex) || anchor.moveIndex < 0 || anchor.moveIndex >= recording.moves.length
      || !finite(anchor.videoTimeMs) || anchor.videoTimeMs < 0 || anchor.videoTimeMs > 86_400_000
      || (video.durationMs !== null && anchor.videoTimeMs > video.durationMs)) {
      throw new Error('Anchors must reference distinct moves and increasing video times');
    }
  }
  const ordered = [...anchors].sort((a, b) => a.moveIndex - b.moveIndex);
  if (ordered.some((a, i) => i > 0 && (a.moveIndex <= ordered[i - 1].moveIndex || a.videoTimeMs <= ordered[i - 1].videoTimeMs))) {
    throw new Error('Anchors must reference distinct moves and increasing video times');
  }
  const points = ordered.map(a => ({ x: recording.moves[a.moveIndex].ts, y: a.videoTimeMs }));
  const meanX = points.reduce((s, p) => s + p.x, 0) / points.length;
  const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
  const variance = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  if (variance <= 0) throw new Error('Anchors need distinct recorded times');
  const scale = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0) / variance;
  const offsetMs = meanY - scale * meanX;
  if (!Number.isFinite(scale) || !Number.isFinite(offsetMs) || scale < 0.01 || scale > 100) throw new Error('Invalid clock mapping');
  const residuals = points.map(p => Math.abs(p.y - offsetMs - scale * p.x));
  const maxResidualMs = Math.max(...residuals);
  const rmsResidualMs = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
  const warnings: ReconCaptureSyncWarning[] = [];
  if (Math.abs(scale - 1) > 0.02) warnings.push('clock-scale');
  if (maxResidualMs > 20) warnings.push('anchor-residual');
  if (ordered.length === 2) warnings.push('two-anchors-only');
  if (video.durationMs === null) warnings.push('unverified-video-duration');
  const firstTime = offsetMs + scale * recording.moves[0].ts;
  const lastTime = offsetMs + scale * recording.moves[recording.moves.length - 1].ts;
  if (firstTime < 0 || (video.durationMs !== null && lastTime > video.durationMs)) warnings.push('outside-video');
  return { source: 'manual-anchors', qualityVerified: false, anchors: ordered.map(a => ({ ...a })), offsetMs, scale, maxResidualMs, rmsResidualMs, warnings };
}
