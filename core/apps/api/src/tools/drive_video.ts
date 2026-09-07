import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, realpathSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DRIVE_TOTAL_BYTES, type DriveCompressionResolution } from '@cuberoot/shared/drive';
import { sql } from '../db/connection.js';
import { DRIVE_STORAGE_ROOT, driveStorageKey, driveStoredPath } from '../utils/drive_storage.js';

const BIN = process.env.DRIVE_FFMPEG_BIN_DIR ?? '';
const QUEUE_LOCK = 2026090601;
const QUOTA_LOCK = 2026082901;
let child: ChildProcess | undefined;
let stopping = false;

// One adapter, no shell, no user-provided executable or remote media URL.
async function native(executable: 'ffmpeg' | 'ffprobe', args: string[], onProgress?: (text: string) => void): Promise<string> {
  if (!path.isAbsolute(BIN) || !['ffmpeg', 'ffprobe'].includes(executable)) throw new Error('native-tool-unavailable');
  if (stopping) throw new Error('worker-stopping');
  return new Promise((resolve, reject) => {
    const proc = spawn(path.join(BIN, executable), args, {
      shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, LANG: 'C.UTF-8', OMP_NUM_THREADS: '2' },
    });
    child = proc;
    let stdout = '', stderr = '', overflow = false;
    // ponytail: one job has a four-hour ceiling; use a dedicated encoder fleet if throughput requires it.
    const timer = setTimeout(() => proc.kill('SIGKILL'), 4 * 60 * 60 * 1000);
    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      if (onProgress) onProgress(text);
      else stdout += text;
      if (stdout.length > 128 * 1024 * 1024) { overflow = true; proc.kill('SIGKILL'); }
    });
    proc.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-8192); });
    proc.once('error', (error) => { clearTimeout(timer); child = undefined; reject(error); });
    proc.once('close', (code) => {
      clearTimeout(timer); child = undefined;
      if (code !== 0 || overflow) {
        console.error(`[drive-video] ${executable} failed: ${stderr}`);
        reject(new Error('native-processing-failed'));
      } else resolve(stdout);
    });
  });
}

interface Stream {
  index: number; codec_type: string; codec_name: string; width?: number; height?: number;
  pix_fmt?: string; field_order?: string; sample_aspect_ratio?: string; time_base: string;
  avg_frame_rate: string; r_frame_rate: string; duration: string; start_time?: string;
  color_range?: string; color_space?: string; color_transfer?: string; color_primaries?: string;
  sample_rate?: string; channels?: number; side_data_list?: Array<{ rotation?: number; side_data_type?: string }>;
  tags?: { rotate?: string };
}
interface Probe { streams: Stream[]; format: { duration: string; size: string } }
const inputOptions = ['-threads', '2', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm'];

async function probe(file: string): Promise<Probe> {
  return JSON.parse(await native('ffprobe', ['-v', 'error', ...inputOptions, '-show_streams', '-show_format', '-of', 'json', file]));
}

export function videoSize(width: number, height: number, mode: DriveCompressionResolution): [number, number] {
  if (![width, height].every((n) => Number.isSafeInteger(n) && n >= 2 && n <= 8192)
      || width % 2 || height % 2) throw new Error('unsupported-video');
  if (mode === 'original') return [width, height];
  if (mode !== '1080p') throw new Error('invalid-resolution');
  const factor = Math.min(1, 1920 / Math.max(width, height), 1080 / Math.min(width, height));
  return [Math.max(2, Math.floor(width * factor / 2) * 2), Math.max(2, Math.floor(height * factor / 2) * 2)];
}

function sourceVideo(info: Probe): Stream {
  const videos = info.streams.filter((s) => s.codec_type === 'video');
  const v = videos[0];
  if (videos.length !== 1 || !v.width || !v.height || !(Number(v.duration ?? info.format.duration) > 0)
      || !['yuv420p', 'yuv420p10le'].includes(v.pix_fmt ?? '')
      || !['progressive', 'unknown', undefined].includes(v.field_order)
      || !['1:1', 'N/A', undefined].includes(v.sample_aspect_ratio)
      || ['smpte2084', 'arib-std-b67'].includes(v.color_transfer ?? '')
      || Number(v.tags?.rotate ?? 0) !== 0
      || v.side_data_list?.some((s) => s.rotation || /DOVI|Mastering|Content light/i.test(s.side_data_type ?? ''))
      || info.streams.some((s) => !['video', 'audio'].includes(s.codec_type))) throw new Error('unsupported-video');
  videoSize(v.width, v.height, 'original');
  if (v.width * v.height > 4096 * 2160) throw new Error('unsupported-video');
  return v;
}

async function fileHash(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function frameTimes(file: string): Promise<Array<{ best_effort_timestamp_time: string; duration_time?: string }>> {
  const result = JSON.parse(await native('ffprobe', ['-v', 'error', ...inputOptions, '-select_streams', 'v:0',
    '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time,duration_time', '-of', 'json', file]));
  return result.frames;
}

export function checkFrameTimes(source: Array<{ best_effort_timestamp_time: string }>, output: Array<{ best_effort_timestamp_time: string }>): void {
  if (!source.length || source.length !== output.length || source.some((frame, i) => {
    const a = Number(frame.best_effort_timestamp_time), b = Number(output[i].best_effort_timestamp_time);
    return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 0.000002;
  })) throw new Error('frame-timing-changed');
}

export function checkQuality(scores: number[]): { mean: number; p1: number; min: number; samples: number } {
  if (!scores.length || scores.some((score) => !Number.isFinite(score))) throw new Error('quality-check-failed');
  const sorted = [...scores].sort((a, b) => a - b);
  const result = { mean: scores.reduce((a, b) => a + b, 0) / scores.length,
    p1: sorted[Math.floor((sorted.length - 1) * 0.01)], min: sorted[0], samples: scores.length };
  if (result.mean < 97 || result.p1 < 93 || result.min < 80) throw new Error('quality-check-failed');
  return result;
}

async function audioPackets(file: string, track: number): Promise<string> {
  return native('ffprobe', ['-v', 'error', ...inputOptions, '-select_streams', `a:${track}`, '-show_packets',
    '-show_data_hash', 'sha256', '-show_entries', 'packet=pts_time,duration_time,data_hash', '-of', 'compact', file]);
}

export async function validateVideo(input: string, output: string, mode: DriveCompressionResolution) {
  const source = await probe(input), encoded = await probe(output), v = sourceVideo(source), out = sourceVideo(encoded);
  const [width, height] = videoSize(v.width!, v.height!, mode);
  if (out.codec_name !== 'av1' || out.width !== width || out.height !== height || out.pix_fmt !== v.pix_fmt
      || Math.abs(Number(out.duration) - Number(v.duration)) > 0.002
      || ['color_range', 'color_space', 'color_transfer', 'color_primaries'].some((key) => {
        const k = key as keyof Stream; return v[k] && v[k] !== 'unknown' && out[k] !== v[k];
      })) throw new Error('video-properties-changed');
  if (Number(encoded.format.size) >= Number(source.format.size)) throw new Error('not-smaller');
  const sourceFrames = await frameTimes(input), outputFrames = await frameTimes(output);
  checkFrameTimes(sourceFrames, outputFrames);
  const audio = (info: Probe) => info.streams.filter((s) => s.codec_type === 'audio')
    .map((s) => [s.codec_name, s.sample_rate, s.channels]);
  if (JSON.stringify(audio(source)) !== JSON.stringify(audio(encoded))) throw new Error('audio-changed');
  for (let track = 0; track < audio(source).length; track++) {
    if (await audioPackets(input, track) !== await audioPackets(output, track)) throw new Error('audio-changed');
  }
  const model = Math.max(width, height) > 1920 ? 'vmaf_4k_v0.6.1' : 'vmaf_v0.6.1';
  // The 1080p reference is resized identically; this measures encoding loss, not retained 4K detail.
  const scale = width !== v.width || height !== v.height ? `scale=${width}:${height}:flags=lanczos,setsar=1,` : '';
  const log = path.join(path.dirname(output), 'vmaf.json');
  await native('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-filter_complex_threads', '2',
    ...inputOptions, '-noautorotate', '-i', output, ...inputOptions, '-noautorotate', '-i', input,
    '-filter_complex', `[0:v]setpts=PTS-STARTPTS[d];[1:v]${scale}setpts=PTS-STARTPTS[r];[d][r]libvmaf=model=version=${model}:n_threads=2:n_subsample=5:log_fmt=json:log_path=${log}`,
    '-an', '-f', 'null', '-']);
  const metrics = JSON.parse(await fs.readFile(log, 'utf8')) as { frames: Array<{ metrics: { vmaf: number } }> };
  const quality = checkQuality(metrics.frames.map((frame) => frame.metrics.vmaf));
  if (quality.samples !== Math.ceil(sourceFrames.length / 5)) throw new Error('quality-coverage-incomplete');
  return { width, height, frameRate: out.avg_frame_rate, frames: sourceFrames.length,
    originalBytes: Number(source.format.size), outputBytes: Number(encoded.format.size),
    quality: { ...quality, model, everyNthFrame: 5 }, sourceSha256: await fileHash(input) };
}

interface Job { id: string; source_node_id: string; resolution: DriveCompressionResolution; storage_key: string; size_bytes: string }

async function processJob(job: Job): Promise<void> {
  const work = path.join(DRIVE_STORAGE_ROOT, 'transcodes', job.id);
  const output = path.join(work, 'output.mp4');
  let publishedPath: string | undefined;
  let publishedNodeId: string | undefined;
  let committed = false;
  try {
    await fs.mkdir(work, { recursive: true });
    const input = driveStoredPath(job.storage_key), originalHash = await fileHash(input);
    const info = await probe(input), v = sourceVideo(info);
    const [width, height] = videoSize(v.width!, v.height!, job.resolution);
    const args = ['-hide_banner', '-nostdin', '-y', '-xerror', '-filter_threads', '2', ...inputOptions,
      '-copyts', '-noautorotate', '-i', input, '-map', '0:v:0', '-map', '0:a?', '-map_metadata', '0',
      '-c:v', 'libsvtav1', '-preset', '6', '-crf', '24', '-svtav1-params', 'lp=2:film-grain=0', '-threads', '2',
      '-pix_fmt', v.pix_fmt!, '-fps_mode', 'passthrough', '-enc_time_base', 'demux',
      '-video_track_timescale', v.time_base.split('/')[1], '-avoid_negative_ts', 'disabled', '-c:a', 'copy', '-movflags', '+faststart'];
    if (width !== v.width || height !== v.height) args.push('-vf', `scale=${width}:${height}:flags=lanczos,setsar=1`);
    for (const [field, option] of [['color_range', '-color_range'], ['color_space', '-colorspace'],
      ['color_transfer', '-color_trc'], ['color_primaries', '-color_primaries']] as const) {
      if (v[field] && v[field] !== 'unknown') args.push(option, v[field]!);
    }
    args.push('-fs', String(Number(job.size_bytes) - 1), '-progress', 'pipe:1', output);
    let progress = 0;
    let progressWrite = Promise.resolve();
    let lastWrite = 0;
    await native('ffmpeg', args, (text) => {
      const time = /out_time_us=(\d+)/.exec(text);
      if (time) progress = Math.min(99, Math.max(0, Math.floor((Number(time[1]) / 1e6 - Number(v.start_time ?? 0)) / Number(info.format.duration) * 100)));
      if (Date.now() - lastWrite < 5000) return;
      lastWrite = Date.now();
      progressWrite = progressWrite.then(async () => {
        await sql`UPDATE drive_compressions SET progress = ${progress}, updated_at = NOW() WHERE id = ${job.id} AND status = 'encoding'`;
      }).catch(() => { child?.kill('SIGTERM'); });
    });
    await progressWrite;
    await sql`UPDATE drive_compressions SET status = 'validating', progress = ${progress}, updated_at = NOW() WHERE id = ${job.id}`;
    const report = await validateVideo(input, output, job.resolution);
    if (report.sourceSha256 !== originalHash) throw new Error('source-changed');
    const nodeId = randomUUID(), key = driveStorageKey(nodeId);
    publishedNodeId = nodeId;
    publishedPath = driveStoredPath(key);
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(${QUOTA_LOCK})`;
      const [source] = await tx<{ owner_user_id: string; parent_id: string | null; name: string }[]>`
        SELECT owner_user_id, parent_id, name FROM drive_nodes WHERE id = ${job.source_node_id}
        AND status = 'ready' AND trashed_at IS NULL FOR UPDATE`;
      if (!source || !(await tx`SELECT 1 FROM drive_compressions WHERE id = ${job.id} FOR UPDATE`).length) throw new Error('source-unavailable');
      const [quota] = await tx<{ bytes: string }[]>`SELECT
        COALESCE((SELECT SUM(size_bytes) FROM drive_nodes WHERE status = 'ready'), 0)
        + COALESCE((SELECT SUM(expected_bytes) FROM drive_uploads WHERE expires_at > NOW()), 0)
        + COALESCE((SELECT SUM(reserved_bytes) FROM drive_compressions WHERE id <> ${job.id} AND status IN ('queued','encoding','validating')), 0) AS bytes`;
      if (Number(quota.bytes) + report.outputBytes > DRIVE_TOTAL_BYTES) throw new Error('quota-exceeded');
      const suffix = job.resolution === '1080p' ? '1080P AV1' : 'AV1';
      const base = source.name.replace(/\.[^.]+$/, '').slice(0, 190);
      let name = `${base} (${suffix}).mp4`, n = 2;
      while ((await tx`SELECT 1 FROM drive_nodes WHERE owner_user_id = ${source.owner_user_id}
        AND parent_id IS NOT DISTINCT FROM ${source.parent_id} AND LOWER(name) = LOWER(${name}) AND trashed_at IS NULL`).length) name = `${base} (${suffix} ${n++}).mp4`;
      await fs.mkdir(path.dirname(publishedPath!), { recursive: true });
      await fs.link(output, publishedPath!); // exclusive new UUID; the original path is never written.
      await tx`INSERT INTO drive_nodes (id, owner_user_id, parent_id, kind, name, mime_type, size_bytes, storage_key)
        VALUES (${nodeId}, ${source.owner_user_id}, ${source.parent_id}, 'file', ${name}, 'video/mp4', ${report.outputBytes}, ${key})`;
      await tx`UPDATE drive_compressions SET status = 'ready', progress = 100, output_node_id = ${nodeId},
        report = ${tx.json(report)}, error = NULL, updated_at = NOW() WHERE id = ${job.id}`;
    });
    committed = true;
    console.log(`[drive-video] ready ${job.id}: ${report.originalBytes} -> ${report.outputBytes}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'processing-failed';
    console.error(`[drive-video] failed ${job.id}: ${reason}`);
    if (!stopping) await sql`UPDATE drive_compressions SET status = 'failed', error = ${reason.slice(0, 200)}, updated_at = NOW() WHERE id = ${job.id} AND status <> 'ready'`;
  } finally {
    if (publishedPath && publishedNodeId && !committed) {
      // A lost COMMIT response is ambiguous: retain the file unless rollback is confirmed.
      const nodes = await sql`SELECT 1 FROM drive_nodes WHERE id = ${publishedNodeId}`.catch(() => null);
      if (nodes && !nodes.length) await fs.unlink(publishedPath).catch(() => {});
    }
    // Generated working files only; source storage is outside this directory.
    await fs.rm(work, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  if (process.env.DRIVE_COMPRESSION_ENABLED !== '1') throw new Error('Drive compression disabled');
  await native('ffmpeg', ['-version']);
  await native('ffprobe', ['-version']);
  if (process.argv.includes('--check')) {
    if (!(await native('ffmpeg', ['-hide_banner', '-encoders'])).includes('libsvtav1')
        || !(await native('ffmpeg', ['-hide_banner', '-filters'])).includes('libvmaf')) throw new Error('encoder-capability-missing');
    console.log('[drive-video] encoder capabilities verified');
    return;
  }
  const connection = await sql.reserve();
  const [lock] = await connection<{ acquired: boolean }[]>`SELECT pg_try_advisory_lock(${QUEUE_LOCK}) AS acquired`;
  if (!lock.acquired) throw new Error('Drive compression worker already running');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { stopping = true; child?.kill('SIGTERM'); });
  // Interrupted jobs require an explicit retry; malformed media must not cause an OOM/restart loop.
  await sql`UPDATE drive_compressions SET status = 'failed', error = 'worker-interrupted', updated_at = NOW() WHERE status IN ('encoding', 'validating')`;
  console.log('[drive-video] worker ready');
  try {
    while (!stopping) {
      await connection`SELECT 1`;
      const [job] = await sql<Job[]>`
        UPDATE drive_compressions j SET status = 'encoding', progress = 0, error = NULL, updated_at = NOW()
        FROM drive_nodes n WHERE j.id = (SELECT id FROM drive_compressions WHERE status = 'queued' ORDER BY created_at LIMIT 1)
          AND n.id = j.source_node_id RETURNING j.id, j.source_node_id, j.resolution, n.storage_key, n.size_bytes`;
      if (!job) { if (process.argv.includes('--once')) break; await delay(2000); continue; }
      await processJob(job);
      if (process.argv.includes('--once')) break;
    }
  } finally { await connection`SELECT pg_advisory_unlock(${QUEUE_LOCK})`; connection.release(); await sql.end(); }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error('[drive-video]', error.message); process.exitCode = 1; }).finally(() => sql.end());
}
