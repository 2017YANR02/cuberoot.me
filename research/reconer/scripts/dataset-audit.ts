/** Metadata-only by default; ffprobe/hash and any output files are explicit. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  buildSparseAnnotationQueue, discoverMedia, emptyVisibleDataset, inventoryLegacyDataset,
  mediaPresence, sourceFromPath, validateSourceManifest, validateVisibleDataset,
  type SourceManifest, type VideoTiming,
} from "../src/dataset-manifest.ts";

const USAGE = `Usage: tsx scripts/dataset-audit.ts [options]
  --root DIR                Research directory (default: script parent)
  --media-root DIR          Explicit media directory to inventory (repeatable; bounded)
  --manifest FILE           Owner-reviewed source grouping manifest to audit
  --coco FILE               Audit visible-instance COCO labels (strict review gate)
  --manifest-out FILE       Write source inventory without inventing groups (new file only)
  --coco-template FILE      Write empty visible-instance COCO template (new file only)
  --output FILE             Write report and sparse frame requests (new file only)
  --frames-per-video N      Sparse annotation requests, default 20 (no decoding)
  --probe                   Read ffprobe metadata; no pixel decoding
  --hash                    Stream SHA-256 of source media
  --help                    Show usage

The default audits tracked metadata and reports missing media. It does not decode,
train, assign train/validation/test groups, or convert old grid reads into labels.
Real-time scale and duplicate-frame verification remain unknown after ffprobe.`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log(USAGE); return; }
  const values = new Map<string, string[]>();
  const flags = new Set<string>();
  const valueFlags = new Set(["--root", "--media-root", "--manifest", "--coco", "--manifest-out", "--coco-template", "--output", "--frames-per-video"]);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--probe" || key === "--hash") flags.add(key);
    else if (valueFlags.has(key)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}.`);
      if (key !== "--media-root" && values.has(key)) throw new Error(`${key} may only be specified once.`);
      values.set(key, [...(values.get(key) ?? []), value]);
    } else throw new Error(`Unknown option ${key}.\n${USAGE}`);
  }
  const get = (key: string) => values.get(key)?.[0];
  const root = resolve(get("--root") ?? resolve(import.meta.dirname, ".."));
  const legacy = inventoryLegacyDataset(root);
  const manifestPath = get("--manifest") ? resolve(get("--manifest")!) : null;
  const baseDir = manifestPath ? dirname(manifestPath) : root;
  const manifest: SourceManifest = manifestPath ? JSON.parse(readFileSync(manifestPath, "utf8")) as SourceManifest : legacy.manifest;
  // Validate the input shape before enumerating it or opening its file paths.
  const inputIssues = validateSourceManifest(manifest);
  if (inputIssues.some((x) => ["manifest-shape", "source-shape", "source-path"].includes(x.code))) {
    throw new Error(JSON.stringify(inputIssues, null, 2));
  }
  const paths = new Set(manifest.sources.map((s) => resolve(baseDir, s.file_name)));
  for (const mediaRoot of values.get("--media-root") ?? []) {
    for (const path of discoverMedia(mediaRoot)) {
      if (paths.has(path)) continue;
      paths.add(path);
      manifest.sources.push(sourceFromPath(path, baseDir));
    }
  }
  for (const source of manifest.sources) {
    if (!mediaPresence(source, baseDir).present) continue;
    const path = resolve(baseDir, source.file_name);
    if (flags.has("--probe")) {
      const result = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,avg_frame_rate,r_frame_rate,time_base,duration:format=duration", "-of", "json", path], { encoding: "utf8", timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
      if (result.status !== 0) throw new Error(`ffprobe failed for ${source.id}: ${result.stderr || result.error}`);
      const data = JSON.parse(result.stdout) as { streams?: { width: number; height: number; duration?: string; avg_frame_rate: string; r_frame_rate: string; time_base: string }[]; format?: { duration?: string } };
      const stream = data.streams?.[0];
      if (!stream) throw new Error(`No video stream in ${source.id}.`);
      source.timing = { width: stream.width, height: stream.height, duration_seconds: Number(stream.duration ?? data.format?.duration), avg_frame_rate: stream.avg_frame_rate, r_frame_rate: stream.r_frame_rate, time_base: stream.time_base,
        real_seconds_per_pts_second: source.timing?.real_seconds_per_pts_second ?? null,
        pts_and_duplicates_verified: source.timing?.pts_and_duplicates_verified ?? false } satisfies VideoTiming;
    }
    if (flags.has("--hash")) {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(path, { highWaterMark: 1024 * 1024 })) hash.update(chunk);
      source.source_sha256 = hash.digest("hex");
    }
  }
  const issues = validateSourceManifest(manifest);
  const cocoPath = get("--coco");
  const coco: unknown = cocoPath ? JSON.parse(readFileSync(resolve(cocoPath), "utf8")) : null;
  if (cocoPath) issues.push(...validateVisibleDataset(coco));
  const files = manifest.sources.map((s) => mediaPresence(s, baseDir));
  const queue = buildSparseAnnotationQueue(manifest.sources, Number(get("--frames-per-video") ?? 20));
  const report = {
    schema_version: 1, mode: "metadata-only", root, manifest_base: baseDir, media: files,
    totals: { sources: files.length, available_media: files.filter((f) => f.present).length, missing_media: files.filter((f) => !f.present).length,
      legacy_segments: legacy.labels.filter((l) => l.id.startsWith("legacy-")).reduce((sum, l) => sum + l.segments, 0),
      legacy_nonrotation_segments: legacy.labels.filter((l) => l.id.startsWith("legacy-")).reduce((sum, l) => sum + l.nonrotation_segments, 0),
      sparse_requests: queue.length },
    labels: legacy.labels, legacy_census: legacy.legacy_census, stage_a: legacy.stage_a,
    issues, sparse_annotation_queue: queue,
    coco_audit: cocoPath ? { path: resolve(cocoPath), file_hashes_verified: false, scope: "Schema, visible annotation review, and source/recording/hash split isolation; image bytes are verified by the vision loader." } : null,
    next_requirements: ["Supply original media paths.", "Confirm source/recording groups and freeze splits before labeling.", "Verify actual PTS, slow-motion scale and duplicate frames for 1080p50.", "Freeze the six Stage A clips and baseline before independent pixel annotation."],
  };
  function save(file: string, data: unknown): void {
    writeFileSync(resolve(file), `${JSON.stringify(data, null, 2)}\n`, { flag: "wx" });
  }
  if (get("--manifest-out")) {
    // Relative media paths in an exported manifest resolve from its new location.
    const exportBase = dirname(resolve(get("--manifest-out")!));
    save(get("--manifest-out")!, { ...manifest, sources: manifest.sources.map((s) => ({ ...s, file_name: relative(exportBase, resolve(baseDir, s.file_name)) })) });
  }
  if (get("--coco-template")) save(get("--coco-template")!, emptyVisibleDataset());
  if (get("--output")) save(get("--output")!, report);
  console.log(JSON.stringify(report, null, 2));
  if (issues.some((x) => x.severity === "error")) process.exitCode = 1;
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
