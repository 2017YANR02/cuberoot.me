/**
 * Dataset provenance and visible-instance annotation contract.
 *
 * Source/recording groups are supplied by the dataset owner, never inferred from
 * filenames. All derivatives of a source stay in one split. Old development
 * videos are not a new holdout. This module does not read reconstruction answers
 * into pixel labels, decode frames, or declare pending annotations trainable.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { parseGT, parseSegMoves, parseSplitFrames } from "./splits.ts";

export const DATASET_SPLITS = ["train", "val", "test", "development", "unassigned"] as const;
export type DatasetSplit = typeof DATASET_SPLITS[number];
export const VISIBLE_COLORS = ["W", "Y", "R", "O", "B", "G"] as const;
export const VISIBLE_CATEGORIES = VISIBLE_COLORS.map((name, i) => ({ id: i + 1, name }));

export interface VideoTiming {
  width: number;
  height: number;
  duration_seconds: number;
  avg_frame_rate: string;
  r_frame_rate: string;
  time_base: string;
  /** A slow-motion video's duration is not its real solve duration. */
  real_seconds_per_pts_second: number | null;
  pts_and_duplicates_verified: boolean;
}

export interface SourceVideo {
  id: string;
  file_name: string;
  source_id: string | null;
  recording_group: string | null;
  split: DatasetSplit;
  historical_development: boolean;
  source_sha256: string | null;
  timing: VideoTiming | null;
}

export interface SourceManifest {
  schema_version: 1;
  sources: SourceVideo[];
}

/** Shared COCO extensions, also consumed by vision/dataset.py. */
export interface VisibleImage {
  id: number;
  file_name: string;
  width: number;
  height: number;
  source_id: string;
  recording_group: string;
  split: DatasetSplit;
  image_sha256: string;
  pts_seconds: number;
  reviewed: boolean;
  annotation_complete: boolean;
  annotation_provenance: "human-visible" | "vlm-visible" | "model-prediction" | "pending";
  reviewer?: string;
}

export interface VisibleAnnotation {
  id: number;
  image_id: number;
  category_id: number | null;
  segmentation: number[][];
  bbox: [number, number, number, number];
  area: number;
  iscrowd: 0;
  visibility: "visible" | "unknown";
  is_center: boolean | null;
  ignore?: boolean;
  ignore_reason?: string;
}

export interface VisibleDataset {
  images: VisibleImage[];
  annotations: VisibleAnnotation[];
  categories: { id: number; name: string }[];
}

export interface DatasetIssue {
  severity: "error" | "warning";
  code: string;
  item: string;
  message: string;
}

function issue(code: string, item: string, message: string, severity: DatasetIssue["severity"] = "error"): DatasetIssue {
  return { severity, code, item, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validSplit(value: unknown): value is DatasetSplit {
  return DATASET_SPLITS.includes(value as DatasetSplit);
}

/** Reject leakage through either source identity, a recording group, or bytes. */
function splitLeakage(rows: { id: string; split: unknown; keys: Record<string, unknown> }[]): DatasetIssue[] {
  const seen = new Map<string, { split: unknown; id: string }>();
  const issues: DatasetIssue[] = [];
  for (const row of rows) {
    if (!validSplit(row.split) || row.split === "unassigned") continue;
    for (const [kind, value] of Object.entries(row.keys)) {
      if (!nonempty(value)) continue;
      const key = `${kind}:${value.trim()}`;
      const prior = seen.get(key);
      if (prior && prior.split !== row.split) {
        issues.push(issue("split-leakage", row.id, `${kind} ${value} spans ${prior.split} (${prior.id}) and ${row.split}.`));
      } else if (!prior) {
        seen.set(key, { split: row.split, id: row.id });
      }
    }
  }
  return issues;
}

export function validateSourceManifest(value: unknown): DatasetIssue[] {
  if (!isRecord(value) || value.schema_version !== 1 || !Array.isArray(value.sources)) {
    return [issue("manifest-shape", "manifest", "Expected schema_version: 1 and sources array.")];
  }
  const issues: DatasetIssue[] = [];
  const seen = new Set<string>();
  const rows: Parameters<typeof splitLeakage>[0] = [];
  for (const source of value.sources) {
    if (!isRecord(source)) {
      issues.push(issue("source-shape", "source", "Source must be an object."));
      continue;
    }
    const id = String(source.id ?? "missing-id");
    if (!nonempty(source.id) || seen.has(id)) issues.push(issue("source-id", id, "Source id must be nonempty and unique."));
    seen.add(id);
    if (!nonempty(source.file_name)) issues.push(issue("source-path", id, "file_name is required."));
    if (!validSplit(source.split)) issues.push(issue("source-split", id, "Unknown split."));
    if (typeof source.historical_development !== "boolean") issues.push(issue("source-history", id, "historical_development must be explicit."));
    if (source.historical_development === true && (source.split === "val" || source.split === "test")) {
      issues.push(issue("historical-holdout", id, "Previously tuned development footage cannot become a new validation/test holdout."));
    }
    for (const key of ["source_id", "recording_group"] as const) {
      if (!nonempty(source[key])) issues.push(issue("group-unverified", id, `${key} requires an explicitly verified group.`, source.split === "unassigned" || source.split === "development" ? "warning" : "error"));
    }
    if (source.source_sha256 !== null && (typeof source.source_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.source_sha256))) {
      issues.push(issue("source-hash", id, "source_sha256 must be a lowercase SHA-256 or null."));
    }
    if (source.timing !== null) {
      const t = source.timing;
      if (!isRecord(t) || !finite(t.width) || t.width <= 0 || !finite(t.height) || t.height <= 0 || !finite(t.duration_seconds) || t.duration_seconds <= 0) {
        issues.push(issue("source-timing", id, "Timing requires positive dimensions and duration."));
      } else if (t.real_seconds_per_pts_second !== null && (!finite(t.real_seconds_per_pts_second) || t.real_seconds_per_pts_second <= 0)) {
        issues.push(issue("source-time-scale", id, "Real-time scale must be positive or explicitly unknown (null)."));
      }
    }
    rows.push({ id, split: source.split, keys: { source_id: source.source_id, recording_group: source.recording_group, source_sha256: source.source_sha256 } });
  }
  return [...issues, ...splitLeakage(rows)];
}

/** Strict mode gates training/evaluation; pending templates can use strict=false. */
export function validateVisibleDataset(value: unknown, strict = true): DatasetIssue[] {
  if (!isRecord(value) || !Array.isArray(value.images) || !Array.isArray(value.annotations) || !Array.isArray(value.categories)) {
    return [issue("coco-shape", "dataset", "Expected COCO images, annotations and categories arrays.")];
  }
  const issues: DatasetIssue[] = [];
  if (value.images.length === 0) issues.push(issue("empty-dataset", "images", "No decoded, independently annotated images are present.", strict ? "error" : "warning"));
  const categories = value.categories.filter(isRecord);
  if (categories.length !== 6 || VISIBLE_CATEGORIES.some((c) => !categories.some((actual) => actual.id === c.id && actual.name === c.name))) {
    issues.push(issue("color-categories", "categories", "Required mapping: 1 W, 2 Y, 3 R, 4 O, 5 B, 6 G; these are visual labels, not CubeState indices."));
  }
  const images = new Map<number, Record<string, unknown>>();
  const rows: Parameters<typeof splitLeakage>[0] = [];
  for (const image of value.images) {
    if (!isRecord(image)) {
      issues.push(issue("image-shape", "image", "Image must be an object."));
      continue;
    }
    const id = String(image.id ?? "missing-id");
    if (!Number.isInteger(image.id) || images.has(image.id as number)) issues.push(issue("image-id", id, "Image id must be an integer and unique."));
    if (Number.isInteger(image.id)) images.set(image.id as number, image);
    if (!nonempty(image.file_name)) issues.push(issue("image-path", id, "file_name is required."));
    for (const key of ["width", "height"] as const) {
      if (!Number.isInteger(image[key]) || (image[key] as number) <= 0) issues.push(issue("image-size", id, `${key} must be a positive integer.`));
    }
    for (const key of ["source_id", "recording_group"] as const) {
      if (!nonempty(image[key])) issues.push(issue("image-group", id, `${key} is required; frame-random splitting is forbidden.`));
    }
    if (!validSplit(image.split)) issues.push(issue("image-split", id, "Unknown split."));
    if (typeof image.image_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(image.image_sha256)) issues.push(issue("image-hash", id, "image_sha256 must identify the actual image bytes."));
    if (!finite(image.pts_seconds) || image.pts_seconds < 0) issues.push(issue("image-pts", id, "pts_seconds must be an actual nonnegative source timestamp."));
    const reviewed = image.reviewed === true && image.annotation_complete === true && image.annotation_provenance === "human-visible" && nonempty(image.reviewer);
    if (!reviewed) issues.push(issue("annotation-not-ready", id, "Complete visible-region annotation and independent human review are required; pending/model/GT-derived labels are not ground truth.", strict ? "error" : "warning"));
    rows.push({ id, split: image.split, keys: { source_id: image.source_id, recording_group: image.recording_group, image_sha256: image.image_sha256 } });
  }
  const ids = new Set<number>();
  for (const annotation of value.annotations) {
    if (!isRecord(annotation)) {
      issues.push(issue("annotation-shape", "annotation", "Annotation must be an object."));
      continue;
    }
    const id = String(annotation.id ?? "missing-id");
    if (!Number.isInteger(annotation.id) || ids.has(annotation.id as number)) issues.push(issue("annotation-id", id, "Annotation id must be an integer and unique."));
    ids.add(annotation.id as number);
    const image = images.get(annotation.image_id as number);
    if (!image) issues.push(issue("annotation-image", id, "image_id does not reference an image."));
    if (annotation.ignore !== undefined && typeof annotation.ignore !== "boolean") issues.push(issue("ignore-type", id, "ignore must be a boolean when present; strings must not silently remove ground truth."));
    const ignored = annotation.ignore === true;
    if (ignored && !nonempty(annotation.ignore_reason)) issues.push(issue("ignore-reason", id, "Ignored visible regions require a reason fixed before evaluation."));
    if (annotation.category_id === null) {
      if (!ignored) issues.push(issue("unknown-as-background", id, "Unknown color/merged instances must be an explicit ignore region, never a background negative."));
    } else if (!Number.isInteger(annotation.category_id) || (annotation.category_id as number) < 1 || (annotation.category_id as number) > 6) {
      issues.push(issue("annotation-color", id, "category_id must be one of 1..6 or null for an ignore region."));
    }
    if (annotation.visibility !== "visible" && !(ignored && annotation.visibility === "unknown")) issues.push(issue("annotation-visibility", id, "Only visible pixels are labels; uncertain regions must be ignored."));
    if (annotation.is_center !== null && typeof annotation.is_center !== "boolean") issues.push(issue("center-identity", id, "is_center must be true, false, or unknown (null)."));
    if (annotation.iscrowd !== 0) issues.push(issue("annotation-crowd", id, "Use explicit visible polygons and iscrowd: 0; ambiguous merged pieces are ignore regions."));
    const polygons = annotation.segmentation;
    if (!Array.isArray(polygons) || polygons.length === 0 || polygons.some((p) => !Array.isArray(p) || p.length < 6 || p.length % 2 !== 0 || !p.every(finite))) {
      issues.push(issue("annotation-polygon", id, "segmentation must contain finite polygons with at least three points."));
    } else if (image) {
      const width = image.width as number, height = image.height as number;
      for (const p of polygons as number[][]) {
        if (p.some((v, i) => v < 0 || v > (i % 2 === 0 ? width : height))) {
          issues.push(issue("polygon-bounds", id, "Visible polygon leaves the image bounds."));
          break;
        }
        let twiceArea = 0;
        for (let i = 0; i < p.length; i += 2) twiceArea += p[i] * p[(i + 3) % p.length] - p[(i + 2) % p.length] * p[i + 1];
        if (Math.abs(twiceArea) < 1e-6) issues.push(issue("polygon-area", id, "Polygon has no visible area."));
      }
    }
    const box = annotation.bbox;
    if (!Array.isArray(box) || box.length !== 4 || !box.every(finite) || box[0] < 0 || box[1] < 0 || box[2] <= 0 || box[3] <= 0) {
      issues.push(issue("annotation-bbox", id, "bbox must be a positive [x,y,width,height] rectangle."));
    } else if (image && (box[0] + box[2] > (image.width as number) + 1e-6 || box[1] + box[3] > (image.height as number) + 1e-6)) {
      issues.push(issue("bbox-bounds", id, "Bounding box leaves the image bounds."));
    } else if (Array.isArray(polygons) && polygons.every((p) => Array.isArray(p) && p.every(finite))) {
      if ((polygons as number[][]).some((p) => p.some((v, i) => v < box[i % 2] - 1e-6 || v > box[i % 2] + box[i % 2 + 2] + 1e-6))) {
        issues.push(issue("bbox-polygon-mismatch", id, "Bounding box does not contain its visible mask polygons."));
      }
    }
    if (!finite(annotation.area) || annotation.area <= 0 || (image && annotation.area > (image.width as number) * (image.height as number))) {
      issues.push(issue("annotation-area", id, "area must be the positive visible mask area within the image."));
    }
  }
  return [...issues, ...splitLeakage(rows)];
}

export function emptyVisibleDataset(): VisibleDataset {
  return { images: [], annotations: [], categories: VISIBLE_CATEGORIES.map((c) => ({ ...c })) };
}

export interface SparseFrameCandidate {
  source_id: string;
  video_id: string;
  file_name: string;
  requested_pts_seconds: number;
  decoded_pts_seconds: null;
  image_sha256: null;
  reviewed: false;
  annotation_complete: false;
  status: "pending-decode-and-dedup";
}

/** Annotation scheduling only. These are PTS requests, not decoded frames or verified labels. */
export function buildSparseAnnotationQueue(sources: SourceVideo[], framesPerVideo = 20): SparseFrameCandidate[] {
  if (!Number.isInteger(framesPerVideo) || framesPerVideo < 1 || framesPerVideo > 400) throw new Error("framesPerVideo must be 1..400.");
  const queue: SparseFrameCandidate[] = [];
  for (const source of sources) {
    if (!source.source_id || !source.recording_group || !source.timing || source.split === "test" || source.split === "unassigned") continue;
    const duration = source.timing.duration_seconds;
    if (!finite(duration) || duration <= 0) continue;
    for (let i = 0; i < framesPerVideo; i++) {
      queue.push({ source_id: source.source_id, video_id: source.id, file_name: source.file_name,
        requested_pts_seconds: duration * (i + 0.5) / framesPerVideo,
        decoded_pts_seconds: null, image_sha256: null, reviewed: false, annotation_complete: false,
        status: "pending-decode-and-dedup" });
    }
  }
  return queue;
}

/** Metadata-only local inventory. No media bytes are decoded or cached. */
export function inventoryLegacyDataset(researchRoot: string) {
  const sources: SourceVideo[] = [];
  const labels: { id: string; split_file: string; split_points: number; segments: number; gt_tokens: number; nonrotation_segments: number; probabilities: number | null; media_present: boolean; declared_segments: number | null; warnings: string[] }[] = [];
  for (const dir of ["videos", "videos_new"]) {
    const fullDir = join(researchRoot, dir);
    if (!existsSync(fullDir)) continue;
    for (const file of readdirSync(fullDir).filter((f) => f.endsWith(".splits.txt")).sort()) {
      const video = file.slice(0, -".splits.txt".length);
      const content = readFileSync(join(fullDir, file), "utf8");
      const frames = parseSplitFrames(content);
      const gt = parseGT(content);
      const seg = parseSegMoves(content);
      const known = dir === "videos" && /^[1-5] /.test(file);
      const id = known ? `legacy-v${file[0]}` : `unverified-${createHash("sha256").update(`${dir}/${video}`).digest("hex").slice(0, 12)}`;
      const probPath = join(fullDir, `${video}.probs.json`);
      const probs: unknown = existsSync(probPath) ? JSON.parse(readFileSync(probPath, "utf8")) : null;
      const n = Math.max(0, frames.length - 1);
      const declared = content.match(/^\s*(\d+)段\s*$/m);
      const declaredSegments = declared ? Number(declared[1]) : null;
      const nonrotation = seg.segLabels.filter((s) => !["x", "y", "z"].includes(s)).length;
      const warnings: string[] = [];
      if (frames.some((f, i) => !Number.isInteger(f) || f < 0 || (i > 0 && f <= frames[i - 1]))) warnings.push("Split frames are not strictly increasing nonnegative integers.");
      if (gt.tokens.length !== n) warnings.push(`GT tokens (${gt.tokens.length}) do not match segments (${n}).`);
      if (declaredSegments !== null && declaredSegments !== n) warnings.push(`Declared ${declaredSegments} segments, but ${frames.length} boundaries define ${n}.`);
      if (Array.isArray(probs) && probs.length !== nonrotation) warnings.push("Probability rows do not match nonrotation segments.");
      sources.push({ id, file_name: join(dir, video), source_id: known ? id : null, recording_group: null,
        split: known ? "development" : "unassigned", historical_development: known, source_sha256: null, timing: null });
      labels.push({ id, split_file: join(dir, file), split_points: frames.length, segments: n, gt_tokens: gt.tokens.length,
        nonrotation_segments: nonrotation, probabilities: Array.isArray(probs) ? probs.length : null,
        media_present: existsSync(join(fullDir, video)), declared_segments: declaredSegments, warnings });
    }
  }
  const censusPath = join(researchRoot, "scripts", "vlm-census-cells.json");
  const census: unknown = existsSync(censusPath) ? JSON.parse(readFileSync(censusPath, "utf8")) : [];
  const cells = Array.isArray(census) ? census.filter(isRecord) : [];
  const readsPath = join(researchRoot, "scripts", "vlm-census-reads.json");
  const reads: unknown = existsSync(readsPath) ? JSON.parse(readFileSync(readsPath, "utf8")) : {};
  const grids = isRecord(reads) ? Object.values(reads).filter(isRecord).flatMap((v) => Object.values(v).filter(Array.isArray)) : [];
  return {
    manifest: { schema_version: 1 as const, sources }, labels,
    legacy_census: { rgb_rows: cells.length, good: cells.filter((c) => c.bad === 0).length, bad: cells.filter((c) => c.bad === 1).length,
      grid_reads: grids.length, known_cells: grids.flat().filter((c) => c !== null).length, unknown_cells: grids.flat().filter((c) => c === null).length,
      independent_visible_instance_masks: 0,
      limitation: "Legacy RGB/grid records lack image provenance and visible instance polygons; they are not detector ground truth." },
    stage_a: { status: "pending-media-and-frozen-baseline", video_ids: ["legacy-v1", "legacy-v3", "legacy-v2"], clips_per_video: 2,
      steps_per_clip: [5, 10], limitation: "Do not select favorable clips after an intervention. Freeze failing v1/v3 baselines and v2 controls before labeling." },
  };
}

/** Explicit roots only, bounded recursion, no symlink traversal. */
export function discoverMedia(root: string, maxDepth = 3, maxFiles = 500): string[] {
  const files: string[] = [];
  let visited = 0;
  function visit(dir: string, depth: number): void {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (++visited > 10_000) throw new Error(`Directory traversal limit reached under ${root}; use a narrower media root.`);
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory() && depth < maxDepth) visit(path, depth + 1);
      else if (entry.isFile() && /\.(mp4|mov|m4v|mkv|avi)$/i.test(entry.name)) {
        files.push(resolve(path));
        if (files.length > maxFiles) throw new Error(`Media limit ${maxFiles} reached under ${root}; use a narrower media root.`);
      }
    }
  }
  visit(resolve(root), 0);
  return files;
}

export function sourceFromPath(path: string, baseDir: string): SourceVideo {
  return { id: `media-${createHash("sha256").update(resolve(path)).digest("hex").slice(0, 12)}`,
    file_name: relative(baseDir, resolve(path)), source_id: null, recording_group: null, split: "unassigned",
    historical_development: false, source_sha256: null, timing: null };
}

export function mediaPresence(source: SourceVideo, baseDir: string) {
  const path = resolve(baseDir, source.file_name);
  const present = existsSync(path) && statSync(path).isFile();
  return { id: source.id, file_name: source.file_name, basename: basename(path), present, bytes: present ? statSync(path).size : null };
}
