import { roundEven } from "./preprocess";
import type { FittedPose } from "./pose-types";
/** The raw pose object score and keypoint-presence channel remain separate. */
export interface ModelVariant {
  size: number;
  file: string;
  bytes: number;
  inputName: string;
  outputName: string;
  outputShape: number[];
}
export interface ModelManifest {
  version: number;
  name: string;
  defaultSize: number;
  viewSize: number;
  classes: string[];
  classThresholds: number[];
  keypointShape: number[];
  presenceThreshold: number;
  stickerPresenceThreshold: number;
  iouThreshold: number;
  maxDetections: number;
  layout: string;
  variants: ModelVariant[];
  bbox: ModelVariant & {
    threshold: number;
    classes: string[];
    layout: string;
    stride: number;
    rect: boolean;
    dynamic: boolean;
  };
  tracking: {
    roiPadding: number;
    gain: number;
    padding: number;
    presenceThreshold: number;
  };
}
export interface Settings {
  thresholds: number[];
  presenceThreshold: number;
  bboxThreshold: number;
  roiPadding: number;
}
export type Box = [number, number, number, number];
export interface CubeBox {
  box: Box;
  score: number;
}
export interface Transform {
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  resizedWidth: number;
  resizedHeight: number;
  padX: number;
  padY: number;
  size: number;
  inputWidth: number;
  inputHeight: number;
}
export interface Detection {
  classId: number;
  score: number;
  presence: number;
  x: number;
  y: number;
  localX?: number;
  localY?: number;
  box: Box;
}
export interface StageTimings {
  preprocessing?: "cpu" | "gpu";
  gpuSubmitMs?: number;
  pixelReadMs: number;
  resizeMs: number;
  tensorMs: number;
  inferenceMs: number;
  copyCleanupMs: number;
}
export interface FrameProfile {
  bbox: StageTimings | null;
  pose: StageTimings | null;
  bboxDecodeMs: number;
  poseDecodeMs: number;
  trackingDecodeMs: number;
  roiUpdateMs: number;
  nonInferenceMs: number;
  otherMs: number;
}
export interface FrameResult {
  inputCrop?: import('./source-crop').InputCrop;
  detectorHashes?:{pose:string;bbox:string};
  fittedPose?: FittedPose;
  fittingError?: string;
  pipeline?: {
    detectorStartedAtMs: number;
    detectorCompletedAtMs: number;
    fitStartedAtMs?: number;
    fitCompletedAtMs?: number;
    presentedAtMs: number;
    presentationMs: number;
    camera?:{captureFps:number;queuedFrames:number;bufferedFits:number;sourceAgeMs:number;skippedFrames:number;browserSkippedFrames:number;copyMs?:number;deliveryMs?:number};
  };
  detections: Detection[];
  transform: Transform;
  inferenceMs: number;
  bboxMs: number | null;
  poseMs: number | null;
  cube: CubeBox | null;
  roi: Box | null;
  roiSource: "detector" | "tracker" | "none";
  trackingLost: boolean;
  totalMs: number;
  profile: FrameProfile;
}
export type InferenceBackend = "webgpu" | "wasm";
export type WorkerRequest =
  | {
      type: "init";
      baseUrl: string;
      manifest: ModelManifest;
      size: number;
      backend: InferenceBackend;
      /** Developer benchmark override; GPU preprocessing is the WebGPU default. */
      preprocessing?: "cpu" | "gpu";
    }
  | {
      type: "frame";
      bitmap: ImageBitmap;
      crop?: import('./source-crop').PixelCrop;
      settings: Settings;
      resetTracking: boolean;
      /** Preserve the existing canvas alpha conversion for still images. */
      preserveAlpha?: boolean;
    };
export type WorkerResponse =
  | { type: "progress"; fraction: number; stage: string }
  | {
      type: "ready";
      threads: number;
      isolated: boolean;
      preprocessing: "cpu" | "gpu";
      models?:{pose:{file:string;size:number;bytes:number;sha256:string};bbox:{file:string;size:number;bytes:number;sha256:string}};
    }
  | { type: "error"; message: string }
  | { type: "result"; result: FrameResult };

export const COLORS = [
  "#ffffff",
  "#ffe052",
  "#e68eff",
  "#ffffff",
  "#ffe052",
  "#ff9b45",
  "#ff5555",
  "#57a0ff",
  "#48d88c",
];
export const LABELS = [
  "Corner",
  "Edge landmark",
  "Face landmark",
  "White",
  "Yellow",
  "Orange",
  "Red",
  "Blue",
  "Green",
];

export function letterbox(
  width: number,
  height: number,
  size: number,
  centerCrop: boolean,
  stride = 0,
): Transform {
  const cropWidth = centerCrop ? Math.min(width, height) : width;
  const cropHeight = centerCrop ? Math.min(width, height) : height;
  const gain = Math.min(size / cropWidth, size / cropHeight);
  const resizedWidth = roundEven(cropWidth * gain);
  const resizedHeight = roundEven(cropHeight * gain);
  const dw = stride ? (size - resizedWidth) % stride : size - resizedWidth;
  const dh = stride ? (size - resizedHeight) % stride : size - resizedHeight;
  return {
    sourceWidth: width,
    sourceHeight: height,
    cropX: (width - cropWidth) / 2,
    cropY: (height - cropHeight) / 2,
    cropWidth,
    cropHeight,
    resizedWidth,
    resizedHeight,
    // Match Ultralytics' centered LetterBox integer rounding.
    padX: Math.max(0, roundEven(dw / 2 - 0.1)),
    padY: Math.max(0, roundEven(dh / 2 - 0.1)),
    size,
    inputWidth: resizedWidth + dw,
    inputHeight: resizedHeight + dh,
  };
}

export function rgbaToChw(rgba: Uint8ClampedArray): Float32Array {
  const pixels = rgba.length / 4;
  const input = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    input[i] = rgba[i * 4] / 255;
    input[pixels + i] = rgba[i * 4 + 1] / 255;
    input[pixels * 2 + i] = rgba[i * 4 + 2] / 255;
  }
  return input;
}

function iou(a: Box, b: Box, classId: number): number {
  const f = Math.fround;
  const offset = classId * 7680;
  const aa = a.map((v) => f(v + offset)),
    bb = b.map((v) => f(v + offset));
  const intersection = f(
    Math.max(0, f(Math.min(aa[2], bb[2]) - Math.max(aa[0], bb[0]))) *
      Math.max(0, f(Math.min(aa[3], bb[3]) - Math.max(aa[1], bb[1]))),
  );
  const areaA = f(f(aa[2] - aa[0]) * f(aa[3] - aa[1]));
  const areaB = f(f(bb[2] - bb[0]) * f(bb[3] - bb[1]));
  return f(intersection / f(f(areaA + areaB) - intersection));
}

/** Decode [1, 4 + classes + 3, candidates]; class-aware NMS precedes presence filtering. */
export function decode(
  data: Float32Array,
  dims: readonly number[],
  transform: Transform,
  manifest: ModelManifest,
  settings: Settings,
): Detection[] {
  const classCount = manifest.classes.length;
  if (
    dims.length !== 3 ||
    dims[0] !== 1 ||
    dims[1] !== 4 + classCount + 3 ||
    data.length !== dims[1] * dims[2]
  ) {
    throw new Error(`Unexpected pose output shape: ${dims.join(" × ")}`);
  }
  const count = dims[2];
  const candidates: Detection[] = [];
  const at = (channel: number, i: number) => data[channel * count + i];
  for (let i = 0; i < count; i++) {
    let classId = 0;
    for (let c = 1; c < classCount; c++) {
      if (at(4 + c, i) > at(4 + classId, i)) classId = c;
    }
    const score = at(4 + classId, i);
    if (!Number.isFinite(score) || score <= Math.min(...settings.thresholds))
      continue;
    const cx = at(0, i),
      cy = at(1, i),
      w = at(2, i),
      h = at(3, i);
    const x = at(4 + classCount, i),
      y = at(5 + classCount, i);
    const presence = at(6 + classCount, i);
    if (![cx, cy, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    candidates.push({
      classId,
      score,
      presence,
      x,
      y,
      box: [
        Math.fround(cx - Math.fround(w / 2)),
        Math.fround(cy - Math.fround(h / 2)),
        Math.fround(cx + Math.fround(w / 2)),
        Math.fround(cy + Math.fround(h / 2)),
      ],
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const candidate of candidates) {
    if (
      kept.some(
        (other) =>
          other.classId === candidate.classId &&
          iou(other.box, candidate.box, candidate.classId) >
            manifest.iouThreshold,
      )
    )
      continue;
    kept.push(candidate);
    if (kept.length >= manifest.maxDetections) break;
  }
  const t = transform;
  const viewSize = manifest.viewSize ?? t.size;
  const gain = t.size / viewSize;
  const scaleX = Math.fround(t.cropWidth / viewSize),
    scaleY = Math.fround(t.cropHeight / viewSize);
  const localX = (x: number) =>
    Math.fround(
      Math.max(0, Math.min(viewSize, Math.fround(x / gain))) * scaleX,
    );
  const localY = (y: number) =>
    Math.fround(
      Math.max(0, Math.min(viewSize, Math.fround(y / gain))) * scaleY,
    );
  // In production this is always a square pose ROI. Keep the generic letterbox
  // transform usable for diagnostics and decoder fixtures as well.
  const pointX = (x: number) =>
    t.padX || t.padY
      ? Math.fround(
          Math.max(
            0,
            Math.min(
              t.cropWidth,
              ((x - t.padX) * t.cropWidth) / t.resizedWidth,
            ),
          ),
        )
      : localX(x);
  const pointY = (y: number) =>
    t.padX || t.padY
      ? Math.fround(
          Math.max(
            0,
            Math.min(
              t.cropHeight,
              ((y - t.padY) * t.cropHeight) / t.resizedHeight,
            ),
          ),
        )
      : localY(y);
  return kept
    .filter(
      (d) =>
        d.score >= settings.thresholds[d.classId] &&
        Number.isFinite(d.x) &&
        Number.isFinite(d.y) &&
        Number.isFinite(d.presence) &&
        d.presence >=
          (d.classId >= 3
            ? Math.max(
                manifest.stickerPresenceThreshold,
                settings.presenceThreshold,
              )
            : settings.presenceThreshold),
    )
    .map((d) => ({
      ...d,
      localX: pointX(d.x),
      localY: pointY(d.y),
      x: Math.fround(pointX(d.x) + t.cropX),
      y: Math.fround(pointY(d.y) + t.cropY),
      box: [
        Math.fround(pointX(d.box[0]) + t.cropX),
        Math.fround(pointY(d.box[1]) + t.cropY),
        Math.fround(pointX(d.box[2]) + t.cropX),
        Math.fround(pointY(d.box[3]) + t.cropY),
      ] as Box,
    }));
}

/** Full-frame cube acquisition: take the highest-scoring cube above its own threshold.
 * NMS cannot change the top-scoring candidate of this single-class detector.
 */
export function decodeCube(
  data: Float32Array,
  dims: readonly number[],
  t: Transform,
  threshold: number,
): CubeBox | null {
  if (
    dims.length !== 3 ||
    dims[0] !== 1 ||
    dims[1] !== 5 ||
    data.length !== 5 * dims[2]
  ) {
    throw new Error(
      `Unexpected cube detector output shape: ${dims.join(" × ")}`,
    );
  }
  const count = dims[2];
  let best: CubeBox | null = null;
  const gain = Math.min(
    t.inputWidth / t.sourceWidth,
    t.inputHeight / t.sourceHeight,
  );
  const clipX = (x: number) =>
    roundEven(
      Math.max(
        0,
        Math.min(t.sourceWidth, Math.fround(Math.fround(x - t.padX) / gain)),
      ),
    );
  const clipY = (y: number) =>
    roundEven(
      Math.max(
        0,
        Math.min(t.sourceHeight, Math.fround(Math.fround(y - t.padY) / gain)),
      ),
    );
  for (let i = 0; i < count; i++) {
    const score = data[4 * count + i];
    if (
      !Number.isFinite(score) ||
      score <= threshold ||
      (best && score <= best.score)
    )
      continue;
    const x = data[i],
      y = data[count + i],
      w = data[2 * count + i],
      h = data[3 * count + i];
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    const box: Box = [
      clipX(Math.fround(x - Math.fround(w / 2))),
      clipY(Math.fround(y - Math.fround(h / 2))),
      clipX(Math.fround(x + Math.fround(w / 2))),
      clipY(Math.fround(y + Math.fround(h / 2))),
    ];
    if (box[2] > box[0] && box[3] > box[1]) best = { score, box };
  }
  return best;
}

export function squareRoi(
  cx: number,
  cy: number,
  side: number,
  width: number,
  height: number,
): Box {
  const pixels = Math.max(1, Math.min(roundEven(side), width, height));
  const x = Math.max(0, Math.min(width - pixels, roundEven(cx - pixels / 2)));
  const y = Math.max(0, Math.min(height - pixels, roundEven(cy - pixels / 2)));
  return [x, y, x + pixels, y + pixels];
}

/** Port of experiment-records/src/live_recognition/roi_tracking.py: bbox acquisition, then pose-point tracking. */
export class RoiTracker {
  roi: Box | null = null;
  cube: CubeBox | null = null;
  private baseSide = 0;

  reset() {
    this.roi = null;
    this.cube = null;
    this.baseSide = 0;
  }

  initialize(
    cube: CubeBox,
    width: number,
    height: number,
    padding: number,
  ): Box {
    const [x1, y1, x2, y2] = cube.box;
    const side = Math.max(x2 - x1, y2 - y1) * (1 + Math.max(0, padding) * 2);
    this.cube = cube;
    this.roi = squareRoi((x1 + x2) / 2, (y1 + y2) / 2, side, width, height);
    this.baseSide = this.roi[2] - this.roi[0];
    return this.roi;
  }

  observe(
    points: Detection[],
    width: number,
    height: number,
    gain: number,
    padding: number,
  ) {
    if (!this.roi) return;
    const [x1, y1, x2, y2] = this.roi;
    const usable = points.filter(
      (p) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        (p.localX ?? p.x - x1) >= 0 &&
        (p.localX ?? p.x - x1) < x2 - x1 &&
        (p.localY ?? p.y - y1) >= 0 &&
        (p.localY ?? p.y - y1) < y2 - y1,
    );
    if (!usable.length) {
      this.reset();
      return;
    }
    // Renderer tracking_bounds() floors/ceils the extents of usable local points.
    const minX =
      x1 +
      Math.floor(
        Math.min(...usable.map((p) => p.localX ?? Math.fround(p.x - x1))),
      );
    const minY =
      y1 +
      Math.floor(
        Math.min(...usable.map((p) => p.localY ?? Math.fround(p.y - y1))),
      );
    const maxX =
      x1 +
      Math.ceil(
        Math.max(...usable.map((p) => p.localX ?? Math.fround(p.x - x1))),
      );
    const maxY =
      y1 +
      Math.ceil(
        Math.max(...usable.map((p) => p.localY ?? Math.fround(p.y - y1))),
      );
    const cx = (x1 + x2) / 2,
      cy = (y1 + y2) / 2;
    const targetSide = Math.max(
      this.baseSide,
      Math.max(maxX - minX, maxY - minY) * (1 + Math.max(0, padding) * 2),
    );
    this.roi = squareRoi(
      cx + ((minX + maxX) / 2 - cx) * Math.max(0, gain),
      cy + ((minY + maxY) / 2 - cy) * Math.max(0, gain),
      targetSide,
      width,
      height,
    );
  }
}

export function roiTransform(
  width: number,
  height: number,
  size: number,
  roi: Box,
): Transform {
  const [x1, y1, x2, y2] = roi;
  return {
    ...letterbox(x2 - x1, y2 - y1, size, false),
    sourceWidth: width,
    sourceHeight: height,
    cropX: x1,
    cropY: y1,
  };
}
