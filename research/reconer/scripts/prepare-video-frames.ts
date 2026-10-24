/** Bounded, answer-free video intake. No splits, move labels or implicit real-time mapping. */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HELP = `Usage: tsx scripts/prepare-video-frames.ts --video FILE --video-id ID --from-pts-seconds N --to-pts-seconds N --output NEW_DIR [--crop x,y,w,h] [--max-edge 1920] [--max-frames 750] [--max-seconds 120] [--time-mapping FILE] [--plan]
Time mapping JSON: {ptsOrigin:"0",realTimeOriginMs:0,realSecondsPerPtsSecond:1,verified:true}.
Only supply verified:true after checking the source's real-time scale. Omit it to retain unknown time.
All decoded frames in the requested PTS interval are kept; no artificial FPS or duplicate-frame claim.
--max-seconds limits the decoder; source hashing and file verification add wall time.
--plan reads stream metadata only. Execution is subject to the repository's local compute policy.
Partial extraction is preserved as frames.partial.jsonl, never published as a complete manifest.
No training, prediction or evaluation is started by this command.`;

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
function sourceFingerprint(file: string): string {
  const stat = statSync(file, { bigint: true });
  if (!stat.isFile()) throw new Error("Video source must be a regular file");
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
}
function atomicJson(path: string, value: unknown): void {
  writeFileSync(`${path}.part`, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  renameSync(`${path}.part`, path);
}
function numberOption(options: Map<string, string>, key: string, fallback?: number): number {
  const value = options.has(key) ? Number(options.get(key)) : fallback;
  if (value === undefined || !Number.isFinite(value)) throw new Error(`Missing or invalid ${key}`);
  return value;
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) { console.log(HELP); return; }
  const options = new Map<string, string>();
  let plan = false;
  const allowed = ["--video", "--video-id", "--from-pts-seconds", "--to-pts-seconds", "--output", "--crop", "--max-edge", "--max-frames", "--max-seconds", "--time-mapping"];
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--plan" && !plan) { plan = true; continue; }
    const value = args[++i];
    if (!allowed.includes(key) || options.has(key) || !value || value.startsWith("--")) throw new Error(`Invalid option ${key}; use --help`);
    options.set(key, value);
  }
  for (const key of ["--video", "--video-id", "--output"]) if (!options.has(key)) throw new Error(`${key} is required`);
  const video = resolve(options.get("--video")!);
  const output = resolve(options.get("--output")!);
  const videoId = options.get("--video-id")!;
  if (videoId.trim() !== videoId || !videoId) throw new Error("video-id must be nonempty and trimmed");
  if (video.trim() !== video) throw new Error("Video path must not have surrounding whitespace");
  const from = numberOption(options, "--from-pts-seconds"), to = numberOption(options, "--to-pts-seconds");
  const maxEdge = numberOption(options, "--max-edge", 1920), maxFrames = numberOption(options, "--max-frames", 750);
  const maxSeconds = numberOption(options, "--max-seconds", 120);
  if (from < 0 || to <= from || !Number.isInteger(maxEdge) || maxEdge < 64 || maxEdge > 3840
    || !Number.isInteger(maxFrames) || maxFrames < 1 || maxFrames > 3000 || maxSeconds <= 0 || maxSeconds > 600) {
    throw new Error("Invalid interval or budget: max-edge 64..3840, max-frames 1..3000, max-seconds (0,600]");
  }
  const sourceFingerprintBefore = sourceFingerprint(video);
  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,time_base:stream_side_data=rotation", "-of", "json", video], { encoding: "utf8", timeout: 15_000, maxBuffer: 1_048_576 });
  if (probe.status !== 0) throw new Error(probe.error?.message ?? probe.stderr);
  const stream = JSON.parse(probe.stdout).streams?.[0] as { width: number; height: number; time_base: string; side_data_list?: unknown[] } | undefined;
  if (!stream || !Number.isSafeInteger(stream.width) || !Number.isSafeInteger(stream.height) || stream.width <= 0 || stream.height <= 0) throw new Error("No valid video dimensions");
  const timeBaseParts = stream.time_base?.split("/").map(Number);
  if (timeBaseParts?.length !== 2 || !timeBaseParts.every(n => Number.isSafeInteger(n) && n > 0)) throw new Error("Invalid source time_base");
  const [numerator, denominator] = timeBaseParts;
  const crop = options.has("--crop") ? options.get("--crop")!.split(",").map(Number) : [0, 0, stream.width, stream.height];
  if (crop.length !== 4 || !crop.every(Number.isSafeInteger) || crop[0] < 0 || crop[1] < 0 || crop[2] <= 0 || crop[3] <= 0 || crop[0] + crop[2] > stream.width || crop[1] + crop[3] > stream.height) throw new Error("crop must be integer x,y,w,h inside the unrotated source");
  const scale = Math.min(1, maxEdge / Math.max(crop[2], crop[3]));
  const width = Math.max(1, Math.round(crop[2] * scale)), height = Math.max(1, Math.round(crop[3] * scale));
  const timeMapping = options.has("--time-mapping") ? JSON.parse(readFileSync(resolve(options.get("--time-mapping")!), "utf8")) : {
    ptsOrigin: "0", realTimeOriginMs: 0, realSecondsPerPtsSecond: null, verified: false,
  };
  const mappingKeys = ["ptsOrigin", "realTimeOriginMs", "realSecondsPerPtsSecond", "verified"];
  if (!timeMapping || typeof timeMapping !== "object" || Array.isArray(timeMapping)
    || Object.keys(timeMapping).length !== mappingKeys.length || !mappingKeys.every(key => Object.hasOwn(timeMapping, key))
    || typeof timeMapping.ptsOrigin !== "string" || !/^(?:0|-?[1-9][0-9]*)$/.test(timeMapping.ptsOrigin)
    || !Number.isFinite(timeMapping.realTimeOriginMs) || timeMapping.realTimeOriginMs < 0 || typeof timeMapping.verified !== "boolean"
    || !(timeMapping.realSecondsPerPtsSecond === null || Number.isFinite(timeMapping.realSecondsPerPtsSecond) && timeMapping.realSecondsPerPtsSecond > 0)
    || timeMapping.verified && timeMapping.realSecondsPerPtsSecond === null) throw new Error("Invalid explicit time mapping");
  const config = { video, videoId, from, to, crop, width, height, maxFrames, maxSeconds, timeMapping, autorotate: false, sourceDisplayMetadata: stream.side_data_list ?? [] };
  const configHash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  if (plan) { console.log(JSON.stringify({ mode: "plan-only", ...config, sourceWidth: stream.width, sourceHeight: stream.height, timeBase: { numerator, denominator }, existingOutput: existsSync(output), computesPixels: false }, null, 2)); return; }
  if (existsSync(output) && readdirSync(output).length) throw new Error("Use a new or empty output directory; prior results are preserved");
  mkdirSync(output, { recursive: true });
  const disk = statfsSync(output);
  const estimatedBytes = (maxFrames + 1) * width * height * 4;
  if (disk.bavail * disk.bsize < estimatedBytes + 2 * 1024 ** 3) throw new Error(`Insufficient disk headroom: conservatively reserve ${estimatedBytes} bytes plus 2 GiB`);
  const sourceHash = await sha256(video);
  if (sourceFingerprint(video) !== sourceFingerprintBefore) throw new Error("Video source changed while probing or hashing; extraction was not started");
  const header = { schemaVersion: 1, kind: "reconer-frame-manifest", videoId, sourceHash, sourcePath: video,
    sourceWidth: stream.width, sourceHeight: stream.height, timeBase: { numerator, denominator }, timeMapping,
    sampling: { kind: "all-decoded-frames", duplicatesVerified: false }, producerConfigHash: configHash };
  const manifestPart = join(output, "frames.partial.jsonl");
  writeFileSync(manifestPart, `${JSON.stringify(header)}\n`, { flag: "wx" });
  const startedAt = Date.now();
  atomicJson(join(output, "prepare-run.json"), { status: "extracting", config, sourceHash, sourceFingerprintBefore, configHash, startedAt, pid: process.pid });
  // trim preserves source timestamps and ends the requested interval; do not
  // discard all later frames with select while continuing through a long source.
  const filter = `trim=start=${from}:end=${to},showinfo,crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]}:exact=1,scale=${width}:${height}`;
  const child = spawn("ffmpeg", ["-hide_banner", "-nostdin", "-loglevel", "info", "-copyts", "-noautorotate", "-threads", "2", "-i", video,
    "-map", "0:v:0", "-an", "-sn", "-dn", "-filter_threads", "1", "-vf", filter,
    "-fps_mode", "passthrough", "-frames:v", String(maxFrames + 1), "-threads:v", "1", "-start_number", "0", "-n", join(output, "frame-%06d.png")], { stdio: ["ignore", "ignore", "pipe"] });
  const ptsByIndex = new Map<number, string>();
  const ptsJournal = join(output, "decoded-pts.jsonl");
  writeFileSync(ptsJournal, "", { flag: "wx" });
  let logTail = "", buffer = "", observedTimeBase = "", reason: string | null = null, childClosed = false;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = (why: string) => {
    reason ??= why;
    if (!childClosed) { child.kill("SIGTERM"); killTimer ??= setTimeout(() => child.kill("SIGKILL"), 3000); }
  };
  const timer = setTimeout(() => stop("max-seconds"), maxSeconds * 1000);
  const onSignal = () => stop("interrupted");
  process.on("SIGINT", onSignal); process.on("SIGTERM", onSignal);
  const consumeLogLine = (line: string): void => {
    if (!line.includes("showinfo")) return;
    try {
      const tb = line.match(/config in time_base:\s*(\d+\/\d+)/);
      if (tb) {
        if (tb[1] !== `${numerator}/${denominator}` || observedTimeBase && observedTimeBase !== tb[1]) {
          stop("showinfo-time-base-changed-or-mismatched"); return;
        }
        observedTimeBase = tb[1];
        appendFileSync(ptsJournal, `${JSON.stringify({ timeBase: observedTimeBase })}\n`);
      }
      if (!/\bn:\s*/.test(line)) return;
      const sample = line.match(/\bn:\s*(\d+)\s+pts:\s*(-?\d+)\s+pts_time:/);
      const dimensions = line.match(/\bs:\s*(\d+)x(\d+)/);
      if (!sample || !/^(?:0|-?[1-9][0-9]*)$/.test(sample[2]) || !dimensions || !observedTimeBase) {
        stop("unparseable-showinfo-frame"); return;
      }
      const index = Number(sample[1]);
      if (!Number.isSafeInteger(index) || index > maxFrames) { stop("max-frames"); return; }
      if (ptsByIndex.has(index) || index !== ptsByIndex.size) { stop("repeated-or-discontinuous-showinfo-index"); return; }
      if (Number(dimensions[1]) !== stream.width || Number(dimensions[2]) !== stream.height) {
        stop("source-dimensions-changed"); return;
      }
      ptsByIndex.set(index, sample[2]);
      appendFileSync(ptsJournal, `${JSON.stringify({ frameIndex: index, sourcePts: sample[2] })}\n`);
    } catch (error) {
      stop(`pts-journal-failed:${error instanceof Error ? error.message : String(error)}`);
    }
  };
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    logTail = (logTail + text).slice(-65_536);
    buffer += text;
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? "";
    if (buffer.length > 1_048_576) { stop("oversized-ffmpeg-log"); buffer = ""; }
    for (const line of lines) consumeLogLine(line);
  });
  const exitCode = await new Promise<number | null>(resolveExit => {
    child.once("error", error => { reason ??= error.message; });
    child.once("close", resolveExit);
  });
  childClosed = true;
  if (buffer) consumeLogLine(buffer);
  clearTimeout(timer); if (killTimer) clearTimeout(killTimer);
  process.off("SIGINT", onSignal); process.off("SIGTERM", onSignal);
  writeFileSync(join(output, "ffmpeg.log"), logTail, { flag: "wx" });
  if (observedTimeBase !== `${numerator}/${denominator}`) reason ??= "showinfo-time-base-mismatch";
  const pngFiles = readdirSync(output).filter(name => /^frame-[0-9]{6}\.png$/.test(name));
  if (pngFiles.length !== ptsByIndex.size || pngFiles.some(name => !ptsByIndex.has(Number(name.slice(6, -4))))) reason ??= "png-timestamp-count-mismatch";
  let written = 0, previousPts: bigint | null = null;
  const rows: unknown[] = [];
  for (let i = 0; i < Math.min(ptsByIndex.size, maxFrames); i++) {
    const sourcePts = ptsByIndex.get(i), imageName = `frame-${String(i).padStart(6, "0")}.png`, imagePath = join(output, imageName);
    if (!sourcePts || !existsSync(imagePath)) { reason ??= "missing-frame-or-timestamp"; break; }
    const bytes = readFileSync(imagePath);
    if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.subarray(-12).toString("hex") !== "0000000049454e44ae426082"
      || bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) { reason ??= "incomplete-or-mismatched-png"; break; }
    const pts = BigInt(sourcePts);
    if (previousPts !== null && pts <= previousPts) { reason ??= "nonmonotonic-source-pts"; break; }
    const ptsSeconds = Number(pts) * numerator / denominator;
    const realTimeMs = timeMapping.verified ? Number(pts - BigInt(timeMapping.ptsOrigin)) * numerator / denominator * timeMapping.realSecondsPerPtsSecond * 1000 + timeMapping.realTimeOriginMs : null;
    if (!Number.isFinite(ptsSeconds) || realTimeMs !== null && (!Number.isFinite(realTimeMs) || realTimeMs < 0)) { reason ??= "invalid-real-time-mapping"; break; }
    rows.push({ kind: "frame", frameId: `${videoId}:${sourcePts}`, frameIndex: i, imagePath: imageName,
      imageHash: createHash("sha256").update(bytes).digest("hex"), width, height, sourcePts, ptsSeconds, realTimeMs, sourceCrop: crop });
    previousPts = pts; written++;
  }
  // A nonzero exit may still leave independently verified frames available for recovery.
  if (exitCode !== 0) reason ??= "ffmpeg-failed";
  if (ptsByIndex.size > maxFrames) reason ??= "max-frames";
  if (!written) reason ??= "empty-interval";
  let sourceHashAfter: string | null = null, sourceFingerprintAfter: string | null = null;
  try {
    sourceHashAfter = await sha256(video);
    sourceFingerprintAfter = sourceFingerprint(video);
    if (sourceHashAfter !== sourceHash || sourceFingerprintAfter !== sourceFingerprintBefore) reason ??= "source-changed-during-extraction";
  } catch (error) {
    reason ??= `source-recheck-failed:${error instanceof Error ? error.message : String(error)}`;
  }
  writeFileSync(manifestPart, [header, ...rows].map(row => JSON.stringify(row)).join("\n") + "\n");
  const complete = reason === null;
  if (complete) renameSync(manifestPart, join(output, "frames.jsonl"));
  const report = { status: complete ? "prepared" : "partial", config, sourceHash, sourceHashAfter, sourceFingerprintBefore, sourceFingerprintAfter,
    configHash, frames: written, decodedTimestampCount: ptsByIndex.size, pngCount: pngFiles.length, reason,
    manifest: complete ? "frames.jsonl" : "frames.partial.jsonl", startedAt, elapsedMs: Date.now() - startedAt, pid: process.pid, decoderPid: child.pid,
    timingVerified: timeMapping.verified, duplicateFramesVerified: false, modelRun: false };
  atomicJson(join(output, "prepare-run.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (!complete) process.exitCode = 2;
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
