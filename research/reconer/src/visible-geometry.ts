/**
 * Project independently observed visible instances through supplied face geometry.
 * This is a geometry consumer, not an automatic pose/center detector. It has no
 * solution, scramble-state, old-grid, or GT input. Thresholds are uncalibrated.
 */
import { ORIENTATION_PERMS } from "./rotation-perms.ts";
import { CUBE_COLOR_TO_NAME, type ColorName } from "./reconstruct.ts";

export type PointXY = readonly [number, number];
export type FaceQuad = readonly [PointXY, PointXY, PointXY, PointXY];
export type GeometryMode = "automatic" | "diagnostic-manual";
export type SpatialFace = "U" | "R" | "F" | "D" | "L" | "B";

export interface GeometrySource {
  evidenceId: string;
  method: "model" | "manual" | "tracked";
  /** Tracking never erases a manually supplied ancestor. */
  origin: "model" | "manual";
  producer: string;
}

export interface VisiblePredictionInstance {
  instanceId: string;
  color: ColorName | null;
  detectionScore: number;
  detectorBoxXYXY: readonly [number, number, number, number];
  visibleMask: { path: string; sha256: string };
  visibleAreaPx: number;
  visibleCentroidXY: PointXY;
  visibleBBoxXYXY: readonly [number, number, number, number];
  /** Actual visible-mask foreground pixel centers, not bounding-box corners. */
  visibleSupportXY: readonly PointXY[];
  colorDistribution: Partial<Record<ColorName, number>> | null;
  isCenter: boolean | null;
}

export interface FaceGeometryEvidence {
  faceId: string;
  trackHint?: string;
  /**
   * Outer face corners in local TL,TR,BR,BL order; no reflection. The producer
   * must independently calibrate corner identity against the actual image's
   * rotation/mirroring. Historical camera prose is not calibration evidence.
   */
  quad: FaceQuad;
  source: GeometrySource;
  /** A turning/non-coplanar layer must not be forced into a rigid 3x3 grid. */
  layersAligned: boolean | null;
  assignmentEvidence?: {
    source: GeometrySource;
    /**
     * Indices into physical ORIENTATION_PERMS: local cell i -> rho[45+i].
     * With U up and an unmirrored exterior B view, 45 is the top-left sticker
     * (R affects column 45/48/51). The 24 proper rotations cannot absorb a
     * reflected image or establish the producer's corner calibration.
     */
    orientationIds?: readonly number[];
    /** Explicit camera-to-physical-space evidence, never inferred from a color name. */
    spatialFace?: SpatialFace;
  };
  /** Supplied semantic center evidence must also geometrically land in cell 4. */
  center?: { instanceId: string; source: GeometrySource };
}

/** Prediction JSONL frame row plus its header videoId/sourceHash and sidecar. */
export interface VisibleFrameInput {
  videoId: string;
  sourceHash: string;
  frameId: string;
  frameIndex: number;
  imageHash: string;
  width: number;
  height: number;
  sourcePts: string;
  ptsSeconds: number;
  /** Forwarded from a verified manifest mapping; this layer never derives real time from PTS. */
  realTimeMs: number | null;
  sourceCrop: readonly [number, number, number, number];
  instances: readonly VisiblePredictionInstance[];
  geometry: readonly FaceGeometryEvidence[];
}

export interface ObservedFace {
  faceId: string;
  trackHint: string | null;
  trackId: string | null;
  frameId: string;
  sourceId: string;
  sourceHash: string;
  ptsSeconds: number;
  realTimeMs: number | null;
  quad: FaceQuad;
  colors: (ColorName | null)[];
  instanceIds: (string | null)[];
  assignments: number[][];
  assignmentStatus: "geometric" | "ambiguous" | "unanchored";
  evidenceIds: string[];
  centerEvidence: { instanceId: string; color: ColorName | null; evidenceId: string } | null;
  /** Colors are hard detector labels; detector scores are not probabilities. */
  scoresCalibrated: false;
}

export interface GeometryFrame {
  frameId: string;
  frameIndex: number;
  sourceId: string;
  sourceHash: string;
  imageHash: string;
  width: number;
  height: number;
  sourceCrop: readonly [number, number, number, number];
  sourcePts: string;
  ptsSeconds: number;
  realTimeMs: number | null;
  mode: GeometryMode;
  faces: ObservedFace[];
  rejections: { itemId: string; reason: string }[];
  parameters: GeometryOptions;
  parametersCalibrated: false;
}

/** A sidecar must match the exact decoded frame, not just a nearby timestamp. */
export interface FaceGeometrySidecarFrame {
  frameId: string;
  imageHash: string;
  geometry: readonly FaceGeometryEvidence[];
}

export interface GeometryOptions {
  mode: GeometryMode;
  maxFaces: number;
  maxInstances: number;
  maxSupportPoints: number;
  minSupportPoints: number;
  minDetectionScore: number;
  minQuadAreaPx: number;
  minSupportCellFraction: number;
  maxCellCenterDistance: number;
  maxAssignmentCandidates: number;
}

export const DEFAULT_GEOMETRY_OPTIONS: Readonly<GeometryOptions> = {
  mode: "automatic", maxFaces: 3, maxInstances: 64, maxSupportPoints: 64,
  minSupportPoints: 3, minDetectionScore: 0.5, minQuadAreaPx: 36,
  minSupportCellFraction: 0.85, maxCellCenterDistance: 0.65, maxAssignmentCandidates: 24,
};

const SPATIAL_FACES: readonly SpatialFace[] = ["U", "R", "F", "D", "L", "B"];
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const point = (p: unknown): p is PointXY => Array.isArray(p) && p.length === 2 && p.every(finite);
const nonempty = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const sha256 = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const PHYSICAL_FACE_ASSIGNMENTS = ORIENTATION_PERMS.map((rho) => Array.from({ length: 9 }, (_, i) => rho[45 + i]));
const PHYSICAL_FACE_ASSIGNMENT_KEYS = new Set(PHYSICAL_FACE_ASSIGNMENTS.map((assignment) => assignment.join(",")));

type FrameMetadata = Pick<VisibleFrameInput, "frameId" | "frameIndex" | "sourceHash" | "imageHash" | "width" | "height" | "sourcePts" | "ptsSeconds" | "realTimeMs" | "sourceCrop">;
function validFrameMetadata(frame: FrameMetadata): boolean {
  return record(frame) && nonempty(frame.frameId) && sha256(frame.sourceHash) && sha256(frame.imageHash)
    && Number.isSafeInteger(frame.frameIndex) && frame.frameIndex >= 0
    && Number.isSafeInteger(frame.width) && Number.isSafeInteger(frame.height) && frame.width > 0 && frame.height > 0
    && Number.isSafeInteger(frame.width * frame.height) && finite(frame.ptsSeconds)
    && (frame.realTimeMs === null || finite(frame.realTimeMs)) && typeof frame.sourcePts === "string" && frame.sourcePts.length <= 32 && /^-?\d+$/.test(frame.sourcePts)
    && Array.isArray(frame.sourceCrop) && frame.sourceCrop.length === 4 && frame.sourceCrop.every(finite)
    && frame.sourceCrop[0] >= 0 && frame.sourceCrop[1] >= 0 && frame.sourceCrop[2] > 0 && frame.sourceCrop[3] > 0;
}

function physicalFaceAssignment(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 9 && value.every(Number.isInteger) && PHYSICAL_FACE_ASSIGNMENT_KEYS.has(value.join(","));
}

function validBox(box: unknown, width: number, height: number): box is readonly [number, number, number, number] {
  return Array.isArray(box) && box.length === 4 && box.every(finite)
    && box[0] >= 0 && box[1] >= 0 && box[2] <= width && box[3] <= height && box[0] < box[2] && box[1] < box[3];
}

function sourceAllowed(source: GeometrySource, mode: GeometryMode): boolean {
  if (!record(source) || !nonempty(source.evidenceId) || !nonempty(source.producer)) return false;
  if (!["model", "manual", "tracked"].includes(source.method) || !["model", "manual"].includes(source.origin)) return false;
  if (source.method !== "tracked" && source.method !== source.origin) return false;
  return mode !== "automatic" || source.origin === "model";
}

function quadArea(quad: FaceQuad): number {
  return quad.reduce((sum, p, i) => sum + p[0] * quad[(i + 1) % 4][1] - p[1] * quad[(i + 1) % 4][0], 0) / 2;
}

function validQuad(quad: FaceQuad, width: number, height: number, minArea: number): boolean {
  if (!Array.isArray(quad) || quad.length !== 4 || !quad.every(point)) return false;
  if (quad.some(([x, y]) => x < 0 || y < 0 || x > width || y > height) || quadArea(quad) < minArea) return false;
  // Positive winding in image coordinates; reject mirrored/bow-tie/concave quads.
  return quad.every((a, i) => {
    const b = quad[(i + 1) % 4], c = quad[(i + 2) % 4];
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > 1e-8;
  });
}

/** Image pixels -> local [0,3]x[0,3], solving only an eight-variable homography. */
function imageToGrid(quad: FaceQuad): number[] | null {
  const uv: PointXY[] = [[0, 0], [3, 0], [3, 3], [0, 3]];
  const rows: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = quad[i], [u, v] = uv[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[pivot][c])) pivot = r;
    if (Math.abs(rows[pivot][c]) < 1e-9) return null;
    [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
    const divisor = rows[c][c];
    for (let j = c; j < 9; j++) rows[c][j] /= divisor;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const factor = rows[r][c];
      for (let j = c; j < 9; j++) rows[r][j] -= factor * rows[c][j];
    }
  }
  const h = rows.map((row) => row[8]);
  return h.every(finite) ? h : null;
}

function project(h: readonly number[], [x, y]: PointXY): PointXY | null {
  const d = h[6] * x + h[7] * y + 1;
  if (Math.abs(d) < 1e-9) return null;
  const p: PointXY = [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
  return p.every(finite) ? p : null;
}

function cellAt(p: PointXY | null): number | null {
  if (!p || p[0] < 0 || p[1] < 0 || p[0] >= 3 || p[1] >= 3) return null;
  return Math.floor(p[1]) * 3 + Math.floor(p[0]);
}

function deriveAssignments(evidence: FaceGeometryEvidence["assignmentEvidence"], options: GeometryOptions): number[][] {
  if (!record(evidence) || !sourceAllowed(evidence.source, options.mode)) return [];
  if (evidence.orientationIds === undefined && evidence.spatialFace === undefined) return [];
  if (evidence.spatialFace !== undefined && !SPATIAL_FACES.includes(evidence.spatialFace)) return [];
  // Malformed explicit null is not permission to expand to every orientation.
  const ids = evidence.orientationIds === undefined ? ORIENTATION_PERMS.map((_, i) => i) : evidence.orientationIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > ORIENTATION_PERMS.length || ids.some((i) => !Number.isInteger(i) || i < 0 || i >= ORIENTATION_PERMS.length)) return [];
  const allowed = [...new Set(ids)].filter((id) => evidence.spatialFace === undefined || SPATIAL_FACES[Math.floor(ORIENTATION_PERMS[id][49] / 9)] === evidence.spatialFace);
  // Never silently truncate ambiguity and choose an arbitrary orientation.
  if (allowed.length > options.maxAssignmentCandidates) return [];
  return allowed.map((id) => [...PHYSICAL_FACE_ASSIGNMENTS[id]]);
}

/** Validate serialized geometry before temporal association; provenance remains a source declaration. */
export function assertGeometryFrame(frame: GeometryFrame): void {
  if (!validFrameMetadata(frame) || !nonempty(frame.sourceId) || !["automatic", "diagnostic-manual"].includes(frame.mode)
    || frame.parametersCalibrated !== false || !Array.isArray(frame.faces) || frame.faces.length > 3) throw new Error("Invalid geometry frame metadata or face budget.");
  const faceIds = new Set<string>();
  const usedInstances = new Set<string>();
  for (const face of frame.faces) {
    if (!record(face) || !nonempty(face.faceId) || faceIds.has(face.faceId)) throw new Error("Invalid or duplicate observed face id.");
    faceIds.add(face.faceId);
    if (face.frameId !== frame.frameId || face.sourceId !== frame.sourceId || face.sourceHash !== frame.sourceHash
      || face.ptsSeconds !== frame.ptsSeconds || face.realTimeMs !== frame.realTimeMs
      || (face.trackHint !== null && !nonempty(face.trackHint)) || (face.trackId !== null && !nonempty(face.trackId))
      || !validQuad(face.quad, frame.width, frame.height, Number.MIN_VALUE)) throw new Error("Observed face provenance, identity or quad is invalid.");
    if (!Array.isArray(face.colors) || face.colors.length !== 9 || face.colors.some((color) => color !== null && !CUBE_COLOR_TO_NAME.includes(color))
      || !Array.isArray(face.instanceIds) || face.instanceIds.length !== 9 || face.instanceIds.some((id) => id !== null && !nonempty(id))
      || face.colors.some((color, cell) => color !== null && face.instanceIds[cell] === null)) throw new Error("Observed cells require nine colors and associated instance ids.");
    for (const id of face.instanceIds) {
      if (id === null) continue;
      if (usedInstances.has(id)) throw new Error("One visible instance cannot occupy multiple observed cells.");
      usedInstances.add(id);
    }
    if (!Array.isArray(face.assignments) || face.assignments.length > 24 || !face.assignments.every(physicalFaceAssignment)
      || new Set(face.assignments.map((assignment) => assignment.join(","))).size !== face.assignments.length) throw new Error("Observed assignments must be distinct physical B-window pullbacks.");
    const status = face.assignments.length === 0 ? "unanchored" : face.assignments.length === 1 ? "geometric" : "ambiguous";
    if (face.assignmentStatus !== status || face.scoresCalibrated !== false || !Array.isArray(face.evidenceIds)
      || !face.evidenceIds.length || face.evidenceIds.length > 256 || !face.evidenceIds.every(nonempty)) throw new Error("Observed face evidence metadata is invalid.");
    if (face.centerEvidence !== null && (!record(face.centerEvidence) || !nonempty(face.centerEvidence.instanceId)
      || face.centerEvidence.instanceId !== face.instanceIds[4] || face.centerEvidence.color !== face.colors[4]
      || !nonempty(face.centerEvidence.evidenceId) || !face.evidenceIds.includes(face.centerEvidence.evidenceId))) throw new Error("Center evidence must match the observed center cell.");
  }
}

/** No images are read. Support-point membership is supplied by the mask producer. */
export function projectVisibleFrame(frame: VisibleFrameInput, overrides: Partial<GeometryOptions> = {}): GeometryFrame {
  if (!record(overrides)) throw new Error("Geometry options must be an object.");
  const options = { ...DEFAULT_GEOMETRY_OPTIONS, ...overrides };
  if (!["automatic", "diagnostic-manual"].includes(options.mode)) throw new Error("Unknown geometry mode.");
  for (const key of ["maxFaces", "maxInstances", "maxSupportPoints", "minSupportPoints", "maxAssignmentCandidates"] as const) {
    if (!Number.isInteger(options[key]) || options[key] < 1 || options[key] > 256) throw new Error(`Invalid geometry budget ${key}.`);
  }
  if (options.maxFaces > 3 || options.maxAssignmentCandidates > 24) throw new Error("A visible cube has at most three faces and 24 physical face assignments.");
  if (options.minSupportPoints > options.maxSupportPoints || !finite(options.minQuadAreaPx) || options.minQuadAreaPx <= 0 || !finite(options.maxCellCenterDistance) || options.maxCellCenterDistance <= 0 || options.maxCellCenterDistance > 1) throw new Error("Invalid geometry thresholds.");
  for (const value of [options.minDetectionScore, options.minSupportCellFraction]) if (!finite(value) || value <= 0 || value > 1) throw new Error("Geometry fractions must be in (0,1].");
  if (!validFrameMetadata(frame) || !nonempty(frame.videoId)) throw new Error("Frame provenance, dimensions, timestamps or source crop is invalid.");
  if (!Array.isArray(frame.instances) || !Array.isArray(frame.geometry) || frame.instances.length > options.maxInstances || frame.geometry.length > options.maxFaces) throw new Error("Frame exceeds geometry/instance budget.");
  const result: GeometryFrame = { frameId: frame.frameId, frameIndex: frame.frameIndex, sourceId: frame.videoId,
    sourceHash: frame.sourceHash, imageHash: frame.imageHash, width: frame.width, height: frame.height,
    sourceCrop: frame.sourceCrop, sourcePts: frame.sourcePts, ptsSeconds: frame.ptsSeconds,
    realTimeMs: frame.realTimeMs, mode: options.mode, faces: [], rejections: [], parameters: options, parametersCalibrated: false };
  const reject = (itemId: string, reason: string) => result.rejections.push({ itemId, reason });
  const faceIds = new Set<string>();
  const validFaces: { geometry: FaceGeometryEvidence; h: number[]; observed: ObservedFace }[] = [];
  for (const face of frame.geometry) {
    if (!record(face) || !nonempty(face.faceId) || faceIds.has(face.faceId)) throw new Error("Face ids must be unique within a frame.");
    faceIds.add(face.faceId);
    if (face.trackHint !== undefined && !nonempty(face.trackHint)) { reject(face.faceId, "invalid-face-track-hint"); continue; }
    if (!sourceAllowed(face.source, options.mode)) { reject(face.faceId, "geometry-provenance-not-allowed"); continue; }
    if (face.layersAligned !== true) { reject(face.faceId, "face-not-confirmed-layer-aligned"); continue; }
    if (!validQuad(face.quad, frame.width, frame.height, options.minQuadAreaPx)) { reject(face.faceId, "invalid-face-quad"); continue; }
    const h = imageToGrid(face.quad);
    if (!h) { reject(face.faceId, "singular-face-projection"); continue; }
    const assignments = deriveAssignments(face.assignmentEvidence, options);
    if (assignments.length === 0) reject(face.faceId, "missing-or-ambiguous-geometric-assignment-evidence");
    const observed: ObservedFace = { faceId: face.faceId, trackHint: face.trackHint ?? null, trackId: null,
      frameId: frame.frameId, sourceId: frame.videoId, sourceHash: frame.sourceHash, ptsSeconds: frame.ptsSeconds,
      realTimeMs: frame.realTimeMs, quad: face.quad, colors: Array<ColorName | null>(9).fill(null), instanceIds: Array<string | null>(9).fill(null),
      assignments, assignmentStatus: assignments.length === 0 ? "unanchored" : assignments.length === 1 ? "geometric" : "ambiguous",
      evidenceIds: [face.source.evidenceId, ...(face.assignmentEvidence && assignments.length ? [face.assignmentEvidence.source.evidenceId] : [])],
      centerEvidence: null, scoresCalibrated: false };
    validFaces.push({ geometry: face, h, observed });
  }
  if (frame.geometry.length === 0) reject(frame.frameId, "missing-face-geometry");
  const instanceIds = new Set<string>();
  const occupied = new Map<string, VisiblePredictionInstance[]>();
  for (const instance of frame.instances) {
    if (!record(instance) || !nonempty(instance.instanceId) || instanceIds.has(instance.instanceId)) throw new Error("Instance ids must be unique within a frame.");
    instanceIds.add(instance.instanceId);
    if (!finite(instance.detectionScore) || instance.detectionScore < options.minDetectionScore || instance.detectionScore > 1) { reject(instance.instanceId, "detection-score-below-threshold-or-invalid"); continue; }
    if (instance.color !== null && !CUBE_COLOR_TO_NAME.includes(instance.color)) { reject(instance.instanceId, "unknown-color-label"); continue; }
    if (!point(instance.visibleCentroidXY) || !Number.isSafeInteger(instance.visibleAreaPx) || instance.visibleAreaPx <= 0 || instance.visibleAreaPx > frame.width * frame.height
      || !record(instance.visibleMask) || !sha256(instance.visibleMask.sha256) || !nonempty(instance.visibleMask.path)
      || !validBox(instance.visibleBBoxXYXY, frame.width, frame.height)) { reject(instance.instanceId, "missing-visible-mask-evidence"); continue; }
    if (!Array.isArray(instance.visibleSupportXY) || instance.visibleSupportXY.length < options.minSupportPoints || instance.visibleSupportXY.length > options.maxSupportPoints || !instance.visibleSupportXY.every(point)) { reject(instance.instanceId, "insufficient-or-over-budget-visible-support"); continue; }
    if (new Set(instance.visibleSupportXY.map(([x, y]) => `${x},${y}`)).size !== instance.visibleSupportXY.length || instance.visibleSupportXY.length > instance.visibleAreaPx) { reject(instance.instanceId, "duplicate-or-impossible-visible-support"); continue; }
    const [left, top, right, bottom] = instance.visibleBBoxXYXY;
    if (instance.visibleAreaPx > (right - left) * (bottom - top) || [instance.visibleCentroidXY, ...instance.visibleSupportXY].some(([x, y]) => x < left || y < top || x >= right || y >= bottom)) { reject(instance.instanceId, "visible-support-outside-mask-bounds"); continue; }
    const matches: { face: typeof validFaces[number]; cell: number }[] = [];
    for (const face of validFaces) {
      const p = project(face.h, instance.visibleCentroidXY), cell = cellAt(p);
      if (cell === null || !p) continue;
      if (Math.hypot(p[0] - (cell % 3 + 0.5), p[1] - (Math.floor(cell / 3) + 0.5)) > options.maxCellCenterDistance) continue;
      const support = instance.visibleSupportXY.filter((s) => cellAt(project(face.h, s)) === cell).length;
      if (support / instance.visibleSupportXY.length < options.minSupportCellFraction) continue;
      matches.push({ face, cell });
    }
    if (matches.length !== 1) { reject(instance.instanceId, matches.length ? "ambiguous-face-association" : "visible-instance-crosses-or-misses-grid-cell"); continue; }
    const { face, cell } = matches[0], key = `${face.geometry.faceId}:${cell}`;
    occupied.set(key, [...(occupied.get(key) ?? []), instance]);
  }
  for (const face of validFaces) {
    for (let cell = 0; cell < 9; cell++) {
      const candidates = occupied.get(`${face.geometry.faceId}:${cell}`) ?? [];
      if (candidates.length > 1) { for (const instance of candidates) reject(instance.instanceId, "multiple-instances-in-one-grid-cell"); continue; }
      if (candidates.length === 1) {
        face.observed.colors[cell] = candidates[0].color;
        face.observed.instanceIds[cell] = candidates[0].instanceId;
      }
    }
    const center = face.geometry.center;
    if (center !== undefined) {
      if (!record(center) || !nonempty(center.instanceId) || !sourceAllowed(center.source, options.mode) || face.observed.instanceIds[4] !== center.instanceId) reject(face.geometry.faceId, "center-not-supported-by-associated-face-cell");
      else {
        face.observed.centerEvidence = { instanceId: center.instanceId, color: face.observed.colors[4], evidenceId: center.source.evidenceId };
        face.observed.evidenceIds.push(center.source.evidenceId);
      }
    }
    result.faces.push(face.observed);
  }
  return result;
}
