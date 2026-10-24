/** Connect completed detector observations to geometry, event proposals and bounded physical search. */
import { createHash, type Hash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { TextDecoder } from "node:util";
import { parseReconstructionRequest, reconstructObservations } from "../src/independent-reconstruction.ts";
import { projectVisibleFrame, type FaceGeometrySidecarFrame, type GeometryFrame, type VisibleFrameInput } from "../src/visible-geometry.ts";
import { buildObservationTimeline } from "../src/observation-timeline.ts";

const HELP = `Usage: tsx scripts/reconstruct-observations.ts --prediction-run DIR --geometry FILE --request FILE --output NEW_DIR [--plan]
Consumes a completed vision prediction stream and frame/hash-bound independent geometry.
It accepts no truth, old splits, old probability files, answer candidates or answer-derived initial states.
Manual geometry and manual boundaries are explicitly reported as diagnostic inputs.
Automatic boundary proposals are incomplete and currently return abstained, with reviewable intervals.
--plan reads metadata only; no model, geometry projection or search is run.
All outputs are local research artifacts. See README and src/independent-reconstruction.ts for contracts.`;
function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}
const utf8 = new TextDecoder("utf-8", { fatal: true });
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const positiveInteger = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value) && value > 0;
const sha256Text = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.trim() === value;
function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  if (Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) throw new Error(`Invalid ${label} fields`);
}
function canonicalPts(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^(?:0|-?[1-9][0-9]*)$/.test(value)) throw new Error(`${label} requires a canonical decimal integer string`);
  return BigInt(value);
}
function relativePath(value: unknown): value is string {
  return nonempty(value) && !isAbsolute(value) && !value.includes("\\") && !/^[a-z]:/i.test(value)
    && value.split("/").every(part => part !== "" && part !== "." && part !== "..");
}
function jsonFile(path: string, maxBytes = 16 * 1024 ** 2): { value: unknown; sha256: string } {
  if (statSync(path).size > maxBytes) throw new Error(`Metadata exceeds byte budget: ${path}`);
  const bytes = readFileSync(path);
  if (bytes.length > maxBytes) throw new Error(`Metadata grew past byte budget: ${path}`);
  return { value: JSON.parse(utf8.decode(bytes)), sha256: createHash("sha256").update(bytes).digest("hex") };
}
async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function* predictionLines(path: string, expectedBytes: number, hash: Hash): AsyncGenerator<Buffer> {
  const stream = createReadStream(path);
  let pending: Buffer[] = [], pendingBytes = 0, consumedBytes = 0;
  try {
    for await (const chunk of stream) {
      const bytes = chunk as Buffer;
      consumedBytes += bytes.length;
      if (consumedBytes > expectedBytes) throw new Error("Prediction stream grew past its committed byte count");
      hash.update(bytes);
      let offset = 0;
      while (offset < bytes.length) {
        const newline = bytes.indexOf(10, offset);
        const end = newline < 0 ? bytes.length : newline + 1;
        const piece = bytes.subarray(offset, end);
        pendingBytes += piece.length;
        if (pendingBytes > 2 * 1024 ** 2) throw new Error("Prediction JSONL row exceeds 2 MiB");
        if (newline < 0) { pending.push(piece); break; }
        const line = pending.length ? Buffer.concat([...pending, piece], pendingBytes) : piece;
        pending = []; pendingBytes = 0;
        yield line;
        offset = end;
      }
    }
    if (pendingBytes || consumedBytes !== expectedBytes) throw new Error("Prediction stream is truncated or lacks its final newline");
  } finally {
    stream.destroy();
  }
}
interface PredictionTiming {
  sourceWidth: number;
  sourceHeight: number;
  numerator: number;
  denominator: number;
  ptsOrigin: bigint;
  realTimeOriginMs: number;
  realSecondsPerPtsSecond: number | null;
  verified: boolean;
}
function predictionTiming(header: Record<string, unknown>): PredictionTiming {
  const base = record(header.timeBase, "timeBase"), mapping = record(header.timeMapping, "timeMapping");
  exactKeys(base, ["numerator", "denominator"], "timeBase");
  exactKeys(mapping, ["ptsOrigin", "realTimeOriginMs", "realSecondsPerPtsSecond", "verified"], "timeMapping");
  if (!positiveInteger(header.sourceWidth) || !positiveInteger(header.sourceHeight) || !nonempty(header.sourcePath)
    || !positiveInteger(base.numerator) || !positiveInteger(base.denominator)
    || !finite(mapping.realTimeOriginMs) || mapping.realTimeOriginMs < 0 || typeof mapping.verified !== "boolean"
    || !(mapping.realSecondsPerPtsSecond === null || finite(mapping.realSecondsPerPtsSecond) && mapping.realSecondsPerPtsSecond > 0)
    || mapping.verified && mapping.realSecondsPerPtsSecond === null) throw new Error("Prediction source dimensions or time mapping are invalid");
  if (!finite(header.threshold) || header.threshold < 0 || header.threshold > 1 || header.maskThreshold !== 0.5 || header.scoresCalibrated !== false) throw new Error("Unsupported detector score/mask contract");
  if (header.sampling !== undefined) {
    const sampling = record(header.sampling, "sampling");
    exactKeys(sampling, ["kind", "duplicatesVerified"], "sampling");
    if (sampling.kind !== "all-decoded-frames" || sampling.duplicatesVerified !== false) throw new Error("Unsupported frame sampling claim");
  }
  if (header.producerConfigHash !== undefined && !sha256Text(header.producerConfigHash)) throw new Error("Invalid producerConfigHash");
  return { sourceWidth: header.sourceWidth, sourceHeight: header.sourceHeight, numerator: base.numerator, denominator: base.denominator,
    ptsOrigin: canonicalPts(mapping.ptsOrigin, "timeMapping.ptsOrigin"), realTimeOriginMs: mapping.realTimeOriginMs,
    realSecondsPerPtsSecond: mapping.realSecondsPerPtsSecond, verified: mapping.verified };
}
function closeTime(value: unknown, expected: number, absoluteTolerance: number): boolean {
  return finite(value) && Number.isFinite(expected)
    && Math.abs(value - expected) <= Math.max(absoluteTolerance, 1e-12 * Math.max(Math.abs(value), Math.abs(expected)));
}
function validateFrameTiming(row: Record<string, unknown>, timing: PredictionTiming, previousPts: bigint | null): bigint {
  if (!nonempty(row.frameId) || !sha256Text(row.imageHash) || !relativePath(row.imagePath)
    || !positiveInteger(row.width) || !positiveInteger(row.height)) throw new Error("Prediction frame image identity or dimensions are invalid");
  const pts = canonicalPts(row.sourcePts, "sourcePts");
  if (previousPts !== null && pts <= previousPts) throw new Error("Decoded source PTS must strictly increase");
  const ptsSeconds = Number(pts) * timing.numerator / timing.denominator;
  if (!closeTime(row.ptsSeconds, ptsSeconds, 1e-6)) throw new Error("Frame ptsSeconds does not match sourcePts/timeBase");
  if (!timing.verified) {
    if (row.realTimeMs !== null) throw new Error("An unverified time mapping requires realTimeMs=null");
  } else {
    const realTimeMs = Number(pts - timing.ptsOrigin) * timing.numerator / timing.denominator * timing.realSecondsPerPtsSecond! * 1000 + timing.realTimeOriginMs;
    if (realTimeMs < 0 || !finite(row.realTimeMs) || row.realTimeMs < 0 || !closeTime(row.realTimeMs, realTimeMs, 1e-3)) throw new Error("Frame realTimeMs does not match its verified mapping");
  }
  const crop = row.sourceCrop;
  if (!Array.isArray(crop) || crop.length !== 4 || !crop.every(finite)
    || crop[0] < 0 || crop[1] < 0 || crop[2] <= 0 || crop[3] <= 0
    || crop[0] + crop[2] > timing.sourceWidth || crop[1] + crop[3] > timing.sourceHeight) throw new Error("Frame sourceCrop leaves the unrotated source");
  return pts;
}
function save(path: string, value: unknown): void {
  writeFileSync(`${path}.part`, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  renameSync(`${path}.part`, path);
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) { console.log(HELP); return; }
  const flags = new Map<string, string>();
  let plan = false;
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--plan" && !plan) { plan = true; continue; }
    const value = args[++i];
    if (!["--prediction-run", "--geometry", "--request", "--output"].includes(key) || flags.has(key) || !value || value.startsWith("--")) throw new Error(`Invalid ${key}; use --help`);
    flags.set(key, value);
  }
  for (const key of ["--prediction-run", "--geometry", "--request", "--output"]) if (!flags.has(key)) throw new Error(`${key} is required`);
  const input = realpathSync(resolve(flags.get("--prediction-run")!)), output = resolve(flags.get("--output")!);
  const requestPath = resolve(flags.get("--request")!), geometryPath = resolve(flags.get("--geometry")!);
  const requestDocument = jsonFile(requestPath), runDocument = jsonFile(join(input, "run.json")), geometryDocument = jsonFile(geometryPath);
  const request = parseReconstructionRequest(requestDocument.value);
  const run = record(runDocument.value, "prediction run");
  if (run.schemaVersion !== 1 || run.kind !== "reconer-prediction-run" || run.format !== "reconer-visible-stream-v1" || run.status !== "completed" || run.completed !== true) throw new Error("A completed prediction stream is required; resume partial vision runs first");
  for (const key of ["sourceHash", "checkpointHash", "framesManifestHash", "inputHash", "headerHash", "committedStreamHash"]) {
    if (!sha256Text(run[key])) throw new Error(`Prediction run requires a lowercase SHA-256 ${key}`);
  }
  if (run.inputHash !== run.framesManifestHash) throw new Error("Video prediction inputHash must equal framesManifestHash");
  const frameCount = run.frameCount;
  if (run.videoId !== request.videoId || run.sourceHash !== request.sourceHash || !positiveInteger(frameCount) || frameCount > 3000) throw new Error("Prediction source or frame budget does not match the request");
  const committedBytes = run.committedBytes;
  if (!positiveInteger(committedBytes) || committedBytes > 256 * 1024 ** 2 || run.nextFrameIndex !== frameCount
    || run.lastFrameIndex !== frameCount - 1 || !nonempty(run.lastFrameId)) throw new Error("Invalid completed prediction checkpoint offsets");
  const sidecar = record(geometryDocument.value, "geometry sidecar");
  if (sidecar.schemaVersion !== 1 || sidecar.videoId !== request.videoId || sidecar.sourceHash !== request.sourceHash || !Array.isArray(sidecar.frames) || sidecar.frames.length > 3000) throw new Error("Geometry sidecar must match videoId/sourceHash and contain at most 3000 frames");
  const geometry = new Map<string, FaceGeometrySidecarFrame>();
  for (const value of sidecar.frames) {
    const row = record(value, "geometry frame");
    if (!nonempty(row.frameId) || !sha256Text(row.imageHash) || !Array.isArray(row.geometry)) throw new Error("Geometry frame requires frameId, imageHash and geometry array");
    if (geometry.has(row.frameId)) throw new Error("Duplicate geometry frameId");
    geometry.set(row.frameId, row as unknown as FaceGeometrySidecarFrame);
  }
  if (plan) {
    console.log(JSON.stringify({ mode: "plan-only", videoId: request.videoId, sourceHash: request.sourceHash, frames: frameCount,
      geometryFrames: geometry.size, geometryMode: request.geometryMode, boundaryMode: request.boundaries.mode,
      readsGroundTruth: false, computesPixels: false, startsSearch: false, automaticBoundaryCoverageComplete: false,
      existingOutput: existsSync(output) }, null, 2));
    return;
  }
  if (existsSync(output) && readdirSync(output).length) throw new Error("Use a new or empty output directory; prior evidence is preserved");
  const streamPath = join(input, "predictions.jsonl"), size = statSync(streamPath).size;
  if (size !== committedBytes) throw new Error("Prediction stream size differs from its completed checkpoint");
  mkdirSync(output, { recursive: true });
  const codePaths = ["../src/independent-reconstruction.ts", "../src/visible-geometry.ts", "../src/observation-timeline.ts",
    "../src/anchored-search.ts", "../src/rotation-perms.ts", "../src/cube-state.ts", "../src/reconstruct.ts",
    "../src/evaluation.ts", "../package.json", "reconstruct-observations.ts"];
  const codeHashes = Object.fromEntries(await Promise.all(codePaths.map(async name => [name, await hashFile(resolve(import.meta.dirname, name))] as const)));
  const provenance = { requestHash: requestDocument.sha256, geometryHash: geometryDocument.sha256, predictionRunHash: runDocument.sha256,
    predictionStreamHash: run.committedStreamHash,
    checkpointHash: run.checkpointHash, framesManifestHash: run.framesManifestHash, sourceHash: request.sourceHash,
    codeHashes };
  save(join(output, "run.json"), { status: "projecting", provenance, startedAt: new Date().toISOString(), pid: process.pid });
  const frames: GeometryFrame[] = [];
  const seen = new Set<string>();
  let header: Record<string, unknown> | null = null, timing: PredictionTiming | null = null, previousPts: bigint | null = null, lineIndex = 0;
  const consumedHash = createHash("sha256");
  for await (const raw of predictionLines(streamPath, committedBytes, consumedHash)) {
    if (raw.length <= 1) throw new Error("Empty JSONL row");
    const row = record(JSON.parse(utf8.decode(raw)), "prediction row");
    if (lineIndex++ === 0) {
      header = row;
      if (createHash("sha256").update(raw).digest("hex") !== run.headerHash || header.schemaVersion !== 1
        || header.kind !== "reconer-visible-predictions" || header.format !== "reconer-visible-stream-v1"
        || header.videoId !== request.videoId || header.sourceHash !== request.sourceHash || header.coordinateSpace !== "frame-image-pixels"
        || header.checkpointHash !== run.checkpointHash || header.framesManifestHash !== run.framesManifestHash) throw new Error("Prediction header identity mismatch");
      timing = predictionTiming(header);
      continue;
    }
    if (!header || !timing || row.kind !== "frame" || row.frameIndex !== frames.length || frames.length >= frameCount
      || !nonempty(row.frameId) || seen.has(row.frameId)) throw new Error("Prediction frame order/count/identity is invalid");
    previousPts = validateFrameTiming(row, timing, previousPts);
    seen.add(row.frameId);
    const supplied = geometry.get(row.frameId);
    if (supplied && supplied.imageHash !== row.imageHash) throw new Error(`Geometry belongs to different image bytes: ${row.frameId}`);
    if (!Array.isArray(row.instances)) throw new Error("Missing visible instance array");
    for (const rawInstance of row.instances) {
      const instance = record(rawInstance, "instance"), mask = record(instance.visibleMask, "visible mask");
      if (!relativePath(mask.path) || !sha256Text(mask.sha256)) throw new Error("Mask path and SHA-256 must identify an asset inside its prediction run");
      const maskPath = realpathSync(resolve(input, mask.path)), rel = relative(input, maskPath);
      if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) || await hashFile(maskPath) !== mask.sha256) throw new Error("Visible mask is missing, escaped or changed");
    }
    const frame = projectVisibleFrame({ ...row, videoId: request.videoId, sourceHash: request.sourceHash, geometry: supplied?.geometry ?? [] } as unknown as VisibleFrameInput, { mode: request.geometryMode });
    frames.push(frame);
  }
  // Hash the exact bytes parsed above, including line endings, before any timeline or search.
  if (consumedHash.digest("hex") !== run.committedStreamHash) throw new Error("Consumed prediction bytes differ from their completed checkpoint");
  if (frames.length !== frameCount || frames.at(-1)?.frameId !== run.lastFrameId || run.nextFrameIndex !== frames.length || run.lastFrameIndex !== frames.length - 1) throw new Error("Completed prediction run contains missing frames");
  for (const frameId of geometry.keys()) if (!seen.has(frameId)) throw new Error(`Geometry frame is absent from this prediction run: ${frameId}`);
  save(join(output, "geometry.json"), { schemaVersion: 1, provenance, frames });
  const timeline = buildObservationTimeline(frames, { mode: request.geometryMode, maxFrames: 3000 });
  save(join(output, "timeline.json"), timeline);
  save(join(output, "run.json"), { status: "searching", provenance, pid: process.pid });
  const result = reconstructObservations(request, frames, timeline);
  save(join(output, "reconstruction.json"), { ...result, provenance });
  save(join(output, "predictions.json"), result.predictionDocument);
  save(join(output, "review-queue.json"), { schemaVersion: 1, videoId: request.videoId, sourceHash: request.sourceHash,
    geometryRejections: frames.flatMap(frame => frame.rejections.map(rejection => ({ frameId: frame.frameId, ptsSeconds: frame.ptsSeconds, realTimeMs: frame.realTimeMs, ...rejection }))),
    proposedEvents: timeline.events, unresolvedIntervals: timeline.unresolvedGaps, decodeReasons: result.reasons,
    editsApplied: false, note: "Review items are diagnostics, not automatically accepted ground truth." });
  save(join(output, "run.json"), { status: result.status, provenance, frames: frames.length, candidateCount: result.candidates.length,
    qualityVerified: false, parametersCalibrated: false, pid: process.pid, completedAt: new Date().toISOString() });
  console.log(JSON.stringify({ status: result.status, reasons: result.reasons, output, candidates: result.candidates.length, qualityVerified: false }, null, 2));
  if (result.status !== "completed") process.exitCode = 2;
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
