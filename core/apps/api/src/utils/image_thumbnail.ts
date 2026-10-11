import { spawn } from 'node:child_process';
import { isAbsolute, join } from 'node:path';

// Fixed variants only. Reuse the already provisioned native binary; no image SaaS,
// native Node dependency, queue, database migration or unbounded disk cache.
export const THUMBNAIL_WIDTHS = new Set([512, 1024]);
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const cache = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer | null>>();
let cacheBytes = 0, active = 0, retryAfter = 0;
const waiters = new Set<() => void>();
function acquireEncoder(): Promise<boolean> {
  if (active < 2) { active++; return Promise.resolve(true); }
  if (waiters.size >= 8) return Promise.resolve(false);
  return new Promise(resolve => {
    const start = () => { clearTimeout(timer); active++; resolve(true); };
    const timer = setTimeout(() => { waiters.delete(start); resolve(false); }, 1000);
    waiters.add(start);
  });
}
function releaseEncoder() {
  active--;
  const next = waiters.values().next().value;
  if (next) { waiters.delete(next); next(); }
}

/** Conservative eligibility: preserve animated, rotated and color-profiled originals. */
export function canThumbnailWebp(input: Buffer, mime: string): boolean {
  if (mime !== 'image/webp' || input.length < 20 || input.length > MAX_INPUT_BYTES || input.toString('ascii', 0, 4) !== 'RIFF' || input.toString('ascii', 8, 12) !== 'WEBP') return false;
  if (input.readUInt32LE(4) + 8 !== input.length) return false;
  const allowed = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH']);
  let image = false;
  for (let offset = 12; offset < input.length;) {
    if (offset + 8 > input.length) return false;
    const type = input.toString('ascii', offset, offset + 4), length = input.readUInt32LE(offset + 4);
    if (!allowed.has(type) || offset + 8 + length + (length % 2) > input.length) return false;
    if (type === 'VP8X' && (length < 10 || (input[offset + 8] & 0x2e) !== 0)) return false; // ICC, EXIF, XMP, animation
    if (type === 'VP8 ' || type === 'VP8L') image = true;
    offset += 8 + length + (length % 2);
  }
  return image;
}

export function encodeThumbnail(input: Buffer, width: number, binaryDirectory: string): Promise<Buffer | null> {
  if (!THUMBNAIL_WIDTHS.has(width) || !isAbsolute(binaryDirectory)) return Promise.resolve(null);
  return new Promise(resolve => {
    const child = spawn(join(binaryDirectory, 'ffmpeg'), [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-max_alloc', '33554432',
      '-protocol_whitelist', 'pipe', '-threads', '1', '-max_pixels', '8388608',
      '-f', 'webp_pipe', '-i', 'pipe:0', '-frames:v', '1', '-filter_threads', '1',
      '-vf', `scale=w='min(iw,${width})':h=-1:flags=lanczos`, '-threads', '1',
      '-c:v', 'libwebp', '-lossless', '0', '-quality', '90', '-compression_level', '3',
      '-f', 'webp', 'pipe:1',
    ], { shell: false, stdio: ['pipe', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];
    let bytes = 0, settled = false, failed = false;
    const finish = (result: Buffer | null) => {
      if (settled) return;
      settled = true; clearTimeout(timer); resolve(result);
    };
    const timer = setTimeout(() => { failed = true; child.kill('SIGKILL'); }, 2500);
    child.on('error', () => {
      failed = true;
      if (!child.pid) finish(null);
      else child.kill('SIGKILL');
    });
    child.stdin.on('error', () => {}); // Early exit/unsupported encoder must not crash the API.
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) { failed = true; child.kill('SIGKILL'); }
      else chunks.push(chunk);
    });
    child.on('close', code => {
      if (failed || code !== 0 || !bytes || bytes > MAX_OUTPUT_BYTES) return finish(null);
      const output = Buffer.concat(chunks);
      finish(canThumbnailWebp(output, 'image/webp') ? output : null);
    });
    child.stdin.end(input);
  });
}

export function imageThumbnail(id: number, source: Buffer, mime: string, width: number): Promise<Buffer | null> {
  const binaryDirectory = process.env.DRIVE_FFMPEG_BIN_DIR ?? '';
  if (!THUMBNAIL_WIDTHS.has(width) || !isAbsolute(binaryDirectory) || !canThumbnailWebp(source, mime)) return Promise.resolve(null);
  const key = `${id}:${width}:thumb1`;
  const cached = cache.get(key);
  if (cached) { cache.delete(key); cache.set(key, cached); return Promise.resolve(cached); }
  const inflight = pending.get(key);
  if (inflight) return inflight;
  if (Date.now() < retryAfter) return Promise.resolve(null);
  let acquired = false;
  const request = acquireEncoder().then(async available => {
    acquired = available;
    if (!available) return null;
    const output = await encodeThumbnail(source, width, binaryDirectory).catch(() => null);
    if (!output) { retryAfter = Date.now() + 30_000; return null; }
    const result = output.length < source.length ? output : source;
    while (cacheBytes + result.length > MAX_CACHE_BYTES && cache.size) {
      const oldest = cache.keys().next().value!;
      cacheBytes -= cache.get(oldest)!.length; cache.delete(oldest);
    }
    cache.set(key, result); cacheBytes += result.length;
    return result;
  }).finally(() => { if (acquired) releaseEncoder(); pending.delete(key); });
  pending.set(key, request);
  return request;
}
