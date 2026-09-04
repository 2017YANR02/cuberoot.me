import { randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { parseByteRange } from './byte_range.js';

export const MUSIC_MAX_BYTES = 100 * 1024 * 1024;
export const MUSIC_OWNER_QUOTA_BYTES = 1024 * 1024 * 1024;
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

export function exceedsMusicOwnerQuota(storedBytes: number, incomingBytes: number): boolean {
  return !Number.isSafeInteger(storedBytes) || storedBytes < 0
    || !Number.isSafeInteger(incomingBytes) || incomingBytes < 0
    || storedBytes + incomingBytes > MUSIC_OWNER_QUOTA_BYTES;
}

export const MUSIC_EXT: Readonly<Record<string, string>> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/flac': 'flac',
  'audio/wav': 'wav',
};

export const COVER_EXT: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function sniffMusicAudio(bytes: Uint8Array): keyof typeof MUSIC_EXT | null {
  if (bytes.length >= 4 && Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'fLaC') return 'audio/flac';
  if (bytes.length >= 12
    && Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'RIFF'
    && Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WAVE') return 'audio/wav';
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(4, 8)).toString('ascii') === 'ftyp') return 'audio/mp4';
  if (bytes.length >= 3 && Buffer.from(bytes.subarray(0, 3)).toString('ascii') === 'ID3') return 'audio/mpeg';
  if (bytes.length >= 4 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    const version = (bytes[1] >> 3) & 0x03;
    const layer = (bytes[1] >> 1) & 0x03;
    const bitrate = (bytes[2] >> 4) & 0x0f;
    if (version !== 1 && layer !== 0 && bitrate !== 0 && bitrate !== 15) return 'audio/mpeg';
  }
  return null;
}

export function sniffMusicCover(bytes: Uint8Array): keyof typeof COVER_EXT | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 12
    && Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'RIFF'
    && Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export class MusicUploadError extends Error {
  constructor(message: string, readonly status: 400 | 413 = 400) {
    super(message);
  }
}

export interface ReceivedMusicFile {
  tempPath: string;
  mime: string;
  sizeBytes: number;
}

export async function receiveMusicFile(
  requestBody: ReadableStream<Uint8Array> | null,
  tempDirectory: string,
  maxBytes: number,
  sniff: (bytes: Uint8Array) => string | null,
  label: 'audio' | 'cover',
): Promise<ReceivedMusicFile> {
  if (!requestBody) throw new MusicUploadError(`${label} file is required`);
  await fs.mkdir(tempDirectory, { recursive: true });
  const tempPath = path.join(tempDirectory, `${randomUUID()}.part`);
  const file = await fs.open(tempPath, 'wx');
  const reader = requestBody.getReader();
  let total = 0;
  let signature = Buffer.alloc(0);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new MusicUploadError(`${label} file too large`, 413);
      }
      if (signature.length < 64) {
        signature = Buffer.concat([signature, Buffer.from(value.subarray(0, 64 - signature.length))]);
      }
      let offset = 0;
      while (offset < value.byteLength) {
        const { bytesWritten } = await file.write(value, offset, value.byteLength - offset);
        if (bytesWritten <= 0) throw new Error(`${label} write made no progress`);
        offset += bytesWritten;
      }
    }
  } catch (error) {
    await file.close().catch(() => {});
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
  await file.close();
  if (total <= 0) {
    await fs.unlink(tempPath).catch(() => {});
    throw new MusicUploadError(`${label} file is required`);
  }
  const mime = sniff(signature);
  if (!mime) {
    await fs.unlink(tempPath).catch(() => {});
    throw new MusicUploadError(label === 'audio'
      ? 'file must be MP3, M4A, FLAC, or WAV audio'
      : 'cover must be JPEG, PNG, or WebP');
  }
  return { tempPath, mime, sizeBytes: total };
}

function contentDisposition(kind: 'inline' | 'attachment', filename: string): string {
  const wellFormed = filename.replace(/[\uD800-\uDFFF]/g, '_');
  const safe = wellFormed.replace(/[^\x20-\x7e]|[\r\n"\\]/g, '_').slice(0, 180) || 'track';
  return `${kind}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(wellFormed)}`;
}

export function storedMusicResponse(input: {
  filePath: string;
  mime: string;
  size: number;
  rangeHeader?: string;
  headOnly: boolean;
  filename: string;
  attachment: boolean;
}): Response {
  const range = parseByteRange(input.rangeHeader, input.size);
  if (input.rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${input.size}`, 'Accept-Ranges': 'bytes' },
    });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? input.size - 1;
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=300, s-maxage=300',
    'Content-Disposition': contentDisposition(input.attachment ? 'attachment' : 'inline', input.filename),
    'Content-Length': String(end - start + 1),
    'Content-Type': input.mime,
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
  });
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${input.size}`);
  if (input.headOnly) return new Response(null, { status: range ? 206 : 200, headers });
  const body = Readable.toWeb(createReadStream(input.filePath, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, { status: range ? 206 : 200, headers });
}
