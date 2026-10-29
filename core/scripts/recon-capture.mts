import { constants, createReadStream, existsSync, readFileSync } from 'node:fs';
import { link, lstat, mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import type { ReconCapture } from '@cuberoot/shared/recon-capture';
import { resolveWorkspacePath } from './resolve-workspace-path.mjs';

const core = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Root tooling is not an app dependency. Resolve the package's public exports
// from its workspace identity instead of relying on a hoisted node_modules link.
const sharedRequire = createRequire(resolve(core, resolveWorkspacePath('@cuberoot/shared', core), 'package.json'));
const [{ RECON_CAPTURE_MAX_VIDEO_BYTES: MAX_VIDEO_BYTES, validateReconCaptureInput }, { reconCanonicalJson }] = await Promise.all([
  import(pathToFileURL(sharedRequire.resolve('@cuberoot/shared/recon-capture')).href) as Promise<typeof import('@cuberoot/shared/recon-capture')>,
  import(pathToFileURL(sharedRequire.resolve('@cuberoot/shared/recon-ground-truth')).href) as Promise<typeof import('@cuberoot/shared/recon-ground-truth')>,
]);
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_LIST_JSON_BYTES = 24 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const EXTENSIONS: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const jsonText = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

interface DownloadState {
  schemaVersion: 1;
  captureId: string;
  revision: number;
  contentHash: string;
  recordingHash: string;
  videoSha256: string;
  expectedBytes: number;
  videoFile: string;
  etag: string;
  status: 'partial' | 'complete';
}

function help() {
  console.log('recon:capture list [--status uploading|needs-review]');
  console.log('recon:capture show ID');
  console.log('recon:capture pull ID --out /absolute/path/to/sample-directory');
  console.log('Read-only. Reuse the same directory to resume the same sample revision. No decoding, label approval or training is performed.');
  console.log('See docs/recon-capture-workflow.md.');
}

interface CliOptions { command: 'help' | 'list' | 'show' | 'pull'; id?: string; out?: string; status?: string }

function options(args: string[]): CliOptions {
  const [command = 'help', ...rest] = args;
  if (command === 'help' || command === '--help' || command === '-h') return { command: 'help' } as const;
  if (!['list', 'show', 'pull'].includes(command)) throw new Error('Unknown command; use recon:capture help');
  let id: string | undefined;
  let out: string | undefined;
  let status: string | undefined;
  if (command !== 'list') {
    id = rest.shift();
    if (!id || !UUID.test(id)) throw new Error('A capture UUID is required');
    id = id.toLowerCase();
  }
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i], value = rest[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--out' && command === 'pull' && out === undefined) out = resolve(value);
    else if (flag === '--status' && command === 'list' && status === undefined
      && ['uploading', 'needs-review'].includes(value)) status = value;
    else throw new Error('Unsupported or repeated option; use recon:capture help');
  }
  if (command === 'pull' && !out) throw new Error('pull requires --out pointing to a new sample directory');
  return { command: command as CliOptions['command'], id, out, status };
}

function api() {
  const envFile = resolve(core, '.env.recon-intake.local');
  const local = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
  // Never infer production from other commands' configuration or a browser URL.
  const origin = new URL(process.env.RECON_CAPTURE_API_URL ?? local.RECON_CAPTURE_API_URL ?? 'http://127.0.0.1:3011');
  const key = process.env.ADMIN_API_KEY ?? local.ADMIN_API_KEY;
  if (!key) throw new Error('Set ADMIN_API_KEY in the environment or core/.env.recon-intake.local');
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/')
    throw new Error('RECON_CAPTURE_API_URL must be an origin without credentials, path, query or fragment');
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)))
    throw new Error('Remote capture API requires HTTPS');
  return {
    async get(path: string, headers: Record<string, string> = {}, signal = AbortSignal.timeout(30_000)) {
      return fetch(new URL('/v1/recon-captures' + path, origin), {
        method: 'GET', redirect: 'error', signal,
        headers: { ...headers, 'X-Admin-Key': key, 'Accept-Encoding': 'identity' },
      });
    },
  };
}

type CaptureApi = ReturnType<typeof api>;

async function readJson(client: CaptureApi, path: string, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const response = await client.get(path, { Accept: 'application/json' });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Capture API returned HTTP ${response.status}`); }
  if (!response.body) throw new Error('Capture API returned an empty response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) throw new Error('Capture metadata exceeds the size limit');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks, length).toString('utf8')) as unknown;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function capture(value: unknown, expectedId?: string): ReconCapture {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid capture metadata');
  const item = value as ReconCapture;
  if (typeof item.id !== 'string' || !UUID.test(item.id) || (expectedId && item.id !== expectedId)
    || !Number.isSafeInteger(item.revision) || item.revision < 1
    || typeof item.recordingHash !== 'string' || !SHA256.test(item.recordingHash)
    || typeof item.contentHash !== 'string' || !SHA256.test(item.contentHash)
    || !['uploading', 'needs-review'].includes(item.status)
    || !item.upload || typeof item.upload.available !== 'boolean' || typeof item.upload.ready !== 'boolean')
    throw new Error('Invalid capture identity or payload');
  const errors = validateReconCaptureInput(item.input);
  if (errors.length) throw new Error('Invalid capture input: ' + errors.join('; '));
  if (sha(reconCanonicalJson(item.input.recording)) !== item.recordingHash)
    throw new Error('Capture recording does not match its stored fingerprint');
  return item;
}

async function regularFile(path: string) {
  const stat = await lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error(`Expected a regular file: ${basename(path)}`);
  return stat;
}

async function readLocalJson(path: string): Promise<unknown> {
  const stat = await regularFile(path);
  if (!stat || stat.size > MAX_JSON_BYTES) throw new Error(`Missing or oversized ${basename(path)}`);
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return JSON.parse(await file.readFile('utf8')) as unknown; } finally { await file.close(); }
}

async function atomicJson(path: string, value: unknown) {
  await regularFile(path);
  const temporary = path + '.' + randomUUID() + '.tmp';
  const file = await open(temporary, 'wx', 0o600);
  try {
    try { await file.writeFile(jsonText(value)); await file.sync(); } finally { await file.close(); }
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(() => {}); }
}

async function preserveJson(path: string, value: unknown) {
  if (await regularFile(path)) {
    if (reconCanonicalJson(await readLocalJson(path)) !== reconCanonicalJson(value))
      throw new Error(`${basename(path)} differs from this sample revision; use a new --out directory`);
    return;
  }
  const temporary = path + '.' + randomUUID() + '.tmp';
  const file = await open(temporary, 'wx', 0o600);
  try {
    try { await file.writeFile(jsonText(value)); await file.sync(); } finally { await file.close(); }
    await link(temporary, path);
  } finally { await unlink(temporary).catch(() => {}); }
}

async function fileHash(path: string): Promise<string> {
  const stat = await regularFile(path);
  if (!stat || stat.size > MAX_VIDEO_BYTES) throw new Error('Missing or oversized local video');
  const digest = createHash('sha256');
  const stream = createReadStream(path, { flags: constants.O_RDONLY | constants.O_NOFOLLOW, highWaterMark: 1024 * 1024 });
  for await (const part of stream) digest.update(part as Buffer);
  return digest.digest('hex');
}

function binding(item: ReconCapture): DownloadState {
  if (item.status !== 'needs-review' || !item.upload.available || !item.upload.ready
    || !item.videoSha256 || !SHA256.test(item.videoSha256) || !item.videoMimeType || !EXTENSIONS[item.videoMimeType])
    throw new Error('Video is not finalized and available; finish its upload before pulling');
  return { schemaVersion: 1, captureId: item.id, revision: item.revision, contentHash: item.contentHash,
    recordingHash: item.recordingHash, videoSha256: item.videoSha256, expectedBytes: item.input.video.sizeBytes,
    videoFile: 'video.' + EXTENSIONS[item.videoMimeType], etag: `"${item.videoSha256}"`, status: 'partial' };
}

function sameBinding(a: unknown, b: DownloadState): a is DownloadState {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
  const saved = a as DownloadState;
  return ['partial', 'complete'].includes(saved.status)
    && reconCanonicalJson({ ...saved, status: 'partial' }) === reconCanonicalJson(b);
}

function checkDownloadHeaders(response: Response, state: DownloadState, offset: number) {
  if (response.status !== 200 && response.status !== 206)
    throw new Error(`Video API returned HTTP ${response.status}; partial bytes have been preserved`);
  if (response.headers.get('etag') !== state.etag) throw new Error('Video ETag changed or is missing; refusing to mix versions');
  const encoding = response.headers.get('content-encoding');
  if (encoding && encoding !== 'identity') throw new Error('Encoded video transfer cannot be resumed safely');
  const length = response.headers.get('content-length');
  if (!length || !/^\d+$/.test(length) || Number(length) !== state.expectedBytes - offset)
    throw new Error('Video response length does not match the remaining bytes');
  if (response.status === 206) {
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
    if (!match || Number(match[1]) !== offset || Number(match[2]) !== state.expectedBytes - 1 || Number(match[3]) !== state.expectedBytes)
      throw new Error('Video response has an unexpected Content-Range');
  } else if (response.status !== 200 || offset !== 0 || response.headers.has('content-range')) {
    throw new Error(`Video server did not honor the download range (HTTP ${response.status})`);
  }
}

async function download(client: CaptureApi, item: ReconCapture, state: DownloadState, partial: string) {
  const stat = await regularFile(partial);
  const offset = stat?.size ?? 0;
  if (offset > state.expectedBytes) throw new Error('Local partial video exceeds the expected length');
  if (offset === state.expectedBytes) return;
  const controller = new AbortController();
  const interrupt = () => controller.abort(new Error('Download interrupted; partial bytes retained'));
  const timer = setTimeout(() => controller.abort(new Error('Download timed out; partial bytes retained')), 10 * 60_000);
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  let response: Response | undefined;
  try {
    response = await client.get(`/${item.id}/video`, {
      ...(offset ? { Range: `bytes=${offset}-`, 'If-Range': state.etag } : {}),
      'If-Match': state.etag,
    }, controller.signal);
    checkDownloadHeaders(response, state, offset);
    if (!response.body) throw new Error('Video response has no body');
    const file = await open(partial, constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW, 0o600);
    const reader = response.body.getReader();
    let written = offset;
    let checkpoint = offset;
    try {
      if ((await file.stat()).size !== offset) throw new Error('Partial file changed while starting the download');
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (written + value.byteLength > state.expectedBytes) throw new Error('Video body exceeds the declared size');
        let consumed = 0;
        while (consumed < value.byteLength) {
          const { bytesWritten } = await file.write(value, consumed, value.byteLength - consumed);
          if (!bytesWritten) throw new Error('Unable to write the video');
          consumed += bytesWritten;
        }
        written += value.byteLength;
        if (written - checkpoint >= 16 * 1024 * 1024) {
          await file.sync(); checkpoint = written;
          process.stderr.write(`Downloaded ${written}/${state.expectedBytes} bytes\n`);
        }
      }
      if (written !== state.expectedBytes) throw new Error('Incomplete video body; rerun pull to resume');
    } finally {
      await reader.cancel().catch(() => {}); reader.releaseLock();
      try { await file.sync(); } finally { await file.close(); }
    }
  } finally {
    controller.abort(); clearTimeout(timer);
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    await response?.body?.cancel().catch(() => {});
  }
}

async function pull(client: CaptureApi, item: ReconCapture, out: string) {
  const state = binding(item);
  await mkdir(out, { recursive: true, mode: 0o700 });
  const directory = await lstat(out);
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('--out must be a real directory, not a symbolic link');
  const lockPath = resolve(out, '.download.lock');
  const lock = await open(lockPath, 'wx', 0o600).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') throw new Error('A pull lock exists. Confirm no pull is running before removing .download.lock');
    throw error;
  });
  try {
    await lock.writeFile(jsonText({ pid: process.pid, captureId: item.id }));
    const statePath = resolve(out, 'download.json');
    const videoPath = resolve(out, state.videoFile);
    const partial = videoPath + '.part';
    const allowed = new Set(['.download.lock', 'download.json', 'sample.json', 'raw-recording.json', 'sync.json', state.videoFile, state.videoFile + '.part']);
    const entries = await readdir(out);
    if (entries.some(name => !allowed.has(name))) throw new Error('--out contains unrelated files; choose a new sample directory');
    for (const name of entries) await regularFile(resolve(out, name));
    if (await regularFile(statePath)) {
      if (!sameBinding(await readLocalJson(statePath), state)) throw new Error('Saved download belongs to a different sample revision or video; use a new --out directory');
    } else {
      if (entries.some(name => name !== '.download.lock')) throw new Error('Existing files have no download identity; choose a new --out directory');
      await atomicJson(statePath, state);
    }
    await preserveJson(resolve(out, 'sample.json'), item);
    await preserveJson(resolve(out, 'raw-recording.json'), {
      schemaVersion: 1, captureId: item.id, revision: item.revision, recordingHash: item.recordingHash,
      labelStatus: 'unreviewed-smart-cube-recording', qualityVerified: false, recording: item.input.recording,
    });
    await preserveJson(resolve(out, 'sync.json'), {
      schemaVersion: 1, captureId: item.id, revision: item.revision, qualityVerified: false,
      status: item.sync ? 'manual-anchors' : 'unaligned', sync: item.sync,
    });
    const finished = await regularFile(videoPath);
    if (finished) {
      if (finished.size !== state.expectedBytes || await fileHash(videoPath) !== state.videoSha256)
        throw new Error('Existing video does not match this sample; it has been preserved');
    } else {
      await download(client, item, state, partial);
      if (await fileHash(partial) !== state.videoSha256)
        throw new Error('Video SHA-256 mismatch. Partial file retained for inspection; use a new directory to redownload');
      // link fails atomically if another writer created the destination.
      await link(partial, videoPath);
      await unlink(partial);
    }
    await atomicJson(statePath, { ...state, status: 'complete' });
    console.log(`Saved capture ${item.id}, revision ${item.revision}: ${out}`);
    console.log('Video SHA-256 verified. Actions and timing remain unreviewed training candidates.');
  } finally { await lock.close(); await unlink(lockPath); }
}

async function main() {
  const args = options(process.argv.slice(2));
  if (args.command === 'help') { help(); return; }
  const client = api();
  if (args.command === 'list') {
    const items: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    let offset = 0;
    for (let page = 0; page < 100; page++) {
      const query = new URLSearchParams({ offset: String(offset), limit: '10' });
      if (args.status) query.set('status', args.status);
      // Each capture can contain a large gyro track; one page is still bounded.
      const response = await readJson(client, '?' + query.toString(), MAX_LIST_JSON_BYTES);
      if (!response || typeof response !== 'object' || !('items' in response) || !Array.isArray(response.items)
        || !('hasMore' in response) || typeof response.hasMore !== 'boolean' || response.items.length > 10)
        throw new Error('Invalid capture list response');
      for (const value of response.items) {
        const item = capture(value);
        if (seen.has(item.id)) throw new Error('Capture list changed during pagination; retry the read');
        seen.add(item.id);
        items.push({ id: item.id, revision: item.revision, status: item.status, sourceSolveId: item.input.sourceSolveId,
          filename: item.input.video.filename, sizeBytes: item.input.video.sizeBytes, moves: item.input.recording.moves.length,
          videoAvailable: item.upload.available, aligned: item.sync !== null, qualityVerified: false });
      }
      if (!response.hasMore) { console.log(jsonText({ items })); return; }
      if (!response.items.length) throw new Error('Capture API returned an empty page with hasMore');
      offset += response.items.length;
    }
    throw new Error('Capture list exceeds the 1,000-item read limit; use a status filter');
  }
  const item = capture(await readJson(client, '/' + args.id), args.id);
  if (args.command === 'show') { console.log(jsonText(item)); return; }
  await pull(client, item, args.out!);
}

main().catch(error => {
  // Do not print request objects, environment values or response bodies containing credentials.
  console.error(error instanceof Error ? error.message : 'Capture command failed');
  process.exitCode = 1;
});
