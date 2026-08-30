import { randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { parseByteRange, type ByteRange } from './byte_range.js';

export const VIDEO_EXT: Readonly<Record<string, string>> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** Trust the container signature, never the client-provided Content-Type. */
export function sniffVideo(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video/webm';
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = Buffer.from(bytes.subarray(8, 12)).toString('ascii');
    return brand.startsWith('qt') ? 'video/quicktime' : 'video/mp4';
  }
  return null;
}

export type VideoByteRange = ByteRange;
export const parseVideoByteRange = parseByteRange;

export class VideoUploadError extends Error {
  constructor(message: string, readonly status: 400 | 413 = 400) {
    super(message);
  }
}

export interface ReceivedVideoUpload {
  stem: string;
  tempPath: string;
  mime: string;
  sizeBytes: number;
}

/** Stream an untrusted raw request body to a temporary file while enforcing size and signature. */
export async function receiveVideoUpload(
  requestBody: ReadableStream<Uint8Array> | null,
  directory: string,
  maxBytes: number,
): Promise<ReceivedVideoUpload> {
  if (!requestBody) throw new VideoUploadError('video file is required');
  await fs.mkdir(directory, { recursive: true });
  const stem = randomUUID();
  const tempPath = path.join(directory, `${stem}.part`);
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
        throw new VideoUploadError('video too large', 413);
      }
      if (signature.length < 32) {
        signature = Buffer.concat([signature, Buffer.from(value.subarray(0, 32 - signature.length))]);
      }
      let offset = 0;
      while (offset < value.byteLength) {
        const { bytesWritten } = await file.write(value, offset, value.byteLength - offset);
        if (bytesWritten <= 0) throw new Error('video write made no progress');
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
    throw new VideoUploadError('video file is required');
  }
  const mime = sniffVideo(signature);
  if (!mime) {
    await fs.unlink(tempPath).catch(() => {});
    throw new VideoUploadError('file must be an MP4, WebM, or MOV video');
  }
  return { stem, tempPath, mime, sizeBytes: total };
}

/** Build a byte-range aware response for a validated video file. */
export function storedVideoResponse(input: {
  filePath: string;
  mime: string;
  size: number;
  rangeHeader?: string;
  headOnly: boolean;
}): Response {
  const { filePath, mime, size, rangeHeader, headOnly } = input;
  const range = parseVideoByteRange(rangeHeader, size);
  if (rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=300, s-maxage=31536000, immutable',
    'Content-Length': String(end - start + 1),
    'Content-Type': mime,
  });
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  if (headOnly) return new Response(null, { status: range ? 206 : 200, headers });

  const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, { status: range ? 206 : 200, headers });
}

interface Mp4Atom {
  type: string;
  dataOffset: number;
  end: number;
}

async function readAt(file: FileHandle, position: number, length: number): Promise<Buffer | null> {
  if (!Number.isSafeInteger(position) || position < 0 || length <= 0) return null;
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await file.read(buffer, 0, length, position);
  return bytesRead === length ? buffer : null;
}

async function mp4AtomAt(file: FileHandle, offset: number, parentEnd: number): Promise<Mp4Atom | null> {
  const base = await readAt(file, offset, 8);
  if (!base) return null;
  const type = base.toString('ascii', 4, 8);
  let headerSize = 8;
  let size = Number(base.readUInt32BE(0));
  if (size === 1) {
    const extended = await readAt(file, offset + 8, 8);
    if (!extended) return null;
    const value = extended.readBigUInt64BE(0);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(value);
    headerSize = 16;
  } else if (size === 0) {
    size = parentEnd - offset;
  }
  const end = offset + size;
  if (size < headerSize || end > parentEnd || end <= offset) return null;
  return { type, dataOffset: offset + headerSize, end };
}

async function readMp4DurationMs(file: FileHandle, fileSize: number): Promise<number | null> {
  let offset = 0;
  while (offset < fileSize) {
    const atom = await mp4AtomAt(file, offset, fileSize);
    if (!atom) return null;
    if (atom.type === 'moov') {
      let childOffset = atom.dataOffset;
      while (childOffset < atom.end) {
        const child = await mp4AtomAt(file, childOffset, atom.end);
        if (!child) return null;
        if (child.type === 'mvhd') {
          const version = await readAt(file, child.dataOffset, 1);
          if (!version) return null;
          if (version[0] === 0) {
            const body = await readAt(file, child.dataOffset, 20);
            if (!body) return null;
            const timescale = body.readUInt32BE(12);
            const duration = body.readUInt32BE(16);
            return timescale > 0 ? duration / timescale * 1000 : null;
          }
          if (version[0] === 1) {
            const body = await readAt(file, child.dataOffset, 32);
            if (!body) return null;
            const timescale = body.readUInt32BE(20);
            const duration = body.readBigUInt64BE(24);
            if (timescale <= 0 || duration > BigInt(Number.MAX_SAFE_INTEGER)) return null;
            return Number(duration) / timescale * 1000;
          }
          return null;
        }
        childOffset = child.end;
      }
      return null;
    }
    offset = atom.end;
  }
  return null;
}

interface EbmlElement {
  id: number;
  dataOffset: number;
  end: number;
  unknownSize: boolean;
}

async function readEbmlVint(
  file: FileHandle,
  offset: number,
  keepMarker: boolean,
): Promise<{ value: bigint; length: number; unknown: boolean } | null> {
  const firstBuffer = await readAt(file, offset, 1);
  if (!firstBuffer) return null;
  const first = firstBuffer[0];
  let mask = 0x80;
  let length = 1;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8 || (keepMarker && length > 4)) return null;
  const bytes = await readAt(file, offset, length);
  if (!bytes) return null;
  let value = BigInt(keepMarker ? first : first & (mask - 1));
  for (let i = 1; i < bytes.length; i += 1) value = (value << 8n) | BigInt(bytes[i]);
  const unknown = !keepMarker && value === (1n << BigInt(7 * length)) - 1n;
  return { value, length, unknown };
}

async function ebmlElementAt(file: FileHandle, offset: number, parentEnd: number): Promise<EbmlElement | null> {
  const id = await readEbmlVint(file, offset, true);
  if (!id || id.value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const size = await readEbmlVint(file, offset + id.length, false);
  if (!size || size.value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const dataOffset = offset + id.length + size.length;
  const end = size.unknown ? parentEnd : dataOffset + Number(size.value);
  if (dataOffset > parentEnd || end > parentEnd || end < dataOffset) return null;
  return { id: Number(id.value), dataOffset, end, unknownSize: size.unknown };
}

async function readUnsigned(file: FileHandle, offset: number, length: number): Promise<number | null> {
  if (length < 1 || length > 8) return null;
  const bytes = await readAt(file, offset, length);
  if (!bytes) return null;
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

async function readWebmInfoDurationMs(file: FileHandle, start: number, end: number): Promise<number | null> {
  let offset = start;
  let timecodeScale = 1_000_000;
  let duration: number | null = null;
  while (offset < end) {
    const element = await ebmlElementAt(file, offset, end);
    if (!element || element.unknownSize) return null;
    const length = element.end - element.dataOffset;
    if (element.id === 0x2ad7b1) {
      const value = await readUnsigned(file, element.dataOffset, length);
      if (value == null || value <= 0) return null;
      timecodeScale = value;
    } else if (element.id === 0x4489) {
      const bytes = await readAt(file, element.dataOffset, length);
      if (!bytes || (length !== 4 && length !== 8)) return null;
      duration = length === 4 ? bytes.readFloatBE(0) : bytes.readDoubleBE(0);
    }
    offset = element.end;
  }
  if (duration == null || !Number.isFinite(duration) || duration <= 0) return null;
  return duration * timecodeScale / 1_000_000;
}

async function readWebmDurationMs(file: FileHandle, fileSize: number): Promise<number | null> {
  let offset = 0;
  let segment: EbmlElement | null = null;
  while (offset < fileSize) {
    const element = await ebmlElementAt(file, offset, fileSize);
    if (!element) return null;
    if (element.id === 0x18538067) {
      segment = element;
      break;
    }
    if (element.unknownSize) return null;
    offset = element.end;
  }
  if (!segment) return null;

  offset = segment.dataOffset;
  while (offset < segment.end) {
    const element = await ebmlElementAt(file, offset, segment.end);
    if (!element) return null;
    if (element.id === 0x1549a966) {
      return readWebmInfoDurationMs(file, element.dataOffset, element.end);
    }
    if (element.unknownSize) return null;
    offset = element.end;
  }
  return null;
}

/** Read the authoritative container duration without loading the whole upload into memory. */
export async function readVideoDurationMs(filePath: string, mime: string): Promise<number | null> {
  const file = await fs.open(filePath, 'r');
  try {
    const stat = await file.stat();
    const duration = mime === 'video/webm'
      ? await readWebmDurationMs(file, stat.size)
      : await readMp4DurationMs(file, stat.size);
    return duration != null && Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;
  } finally {
    await file.close();
  }
}
