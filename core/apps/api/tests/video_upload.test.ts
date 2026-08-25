import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseVideoByteRange, readVideoDurationMs, sniffVideo } from '../src/utils/video_upload.js';

function mp4Atom(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, 4, 'ascii');
  return Buffer.concat([header, payload]);
}

function ebmlElement(id: number[], payload: Buffer): Buffer {
  if (payload.length >= 127) throw new Error('test EBML payload is too large');
  return Buffer.concat([Buffer.from(id), Buffer.from([0x80 | payload.length]), payload]);
}

describe('video upload container sniffing', () => {
  it('recognizes the allowed video containers from bytes', () => {
    expect(sniffVideo(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]))).toBe('video/webm');
    expect(sniffVideo(Buffer.from('\0\0\0\x18ftypisom', 'binary'))).toBe('video/mp4');
    expect(sniffVideo(Buffer.from('\0\0\0\x14ftypqt  ', 'binary'))).toBe('video/quicktime');
  });

  it('rejects extensions and MIME claims without a matching container signature', () => {
    expect(sniffVideo(Buffer.from('not a video'))).toBeNull();
    expect(sniffVideo(Uint8Array.from([0x1a, 0x45, 0xdf]))).toBeNull();
  });
});

describe('video container duration', () => {
  it('reads MP4/MOV mvhd duration without decoding the media', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cuberoot-video-'));
    try {
      const mvhd = Buffer.alloc(20);
      mvhd.writeUInt32BE(1_000, 12);
      mvhd.writeUInt32BE(20_000, 16);
      const file = path.join(dir, 'clip.mp4');
      await writeFile(file, Buffer.concat([
        mp4Atom('ftyp', Buffer.from('isom0000')),
        mp4Atom('moov', mp4Atom('mvhd', mvhd)),
      ]));
      await expect(readVideoDurationMs(file, 'video/mp4')).resolves.toBe(20_000);
      await expect(readVideoDurationMs(file, 'video/quicktime')).resolves.toBe(20_000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reads WebM Info duration using its timecode scale', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cuberoot-video-'));
    try {
      const duration = Buffer.alloc(8);
      duration.writeDoubleBE(20_000);
      const info = ebmlElement([0x15, 0x49, 0xa9, 0x66], Buffer.concat([
        ebmlElement([0x2a, 0xd7, 0xb1], Buffer.from([0x0f, 0x42, 0x40])),
        ebmlElement([0x44, 0x89], duration),
      ]));
      const file = path.join(dir, 'clip.webm');
      await writeFile(file, Buffer.concat([
        ebmlElement([0x1a, 0x45, 0xdf, 0xa3], Buffer.alloc(0)),
        ebmlElement([0x18, 0x53, 0x80, 0x67], info),
      ]));
      await expect(readVideoDurationMs(file, 'video/webm')).resolves.toBe(20_000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('video byte ranges', () => {
  it('parses bounded, open-ended, and suffix ranges', () => {
    expect(parseVideoByteRange('bytes=0-99', 1_000)).toEqual({ start: 0, end: 99 });
    expect(parseVideoByteRange('bytes=100-', 1_000)).toEqual({ start: 100, end: 999 });
    expect(parseVideoByteRange('bytes=-100', 1_000)).toEqual({ start: 900, end: 999 });
    expect(parseVideoByteRange('bytes=900-2000', 1_000)).toEqual({ start: 900, end: 999 });
    expect(parseVideoByteRange('bytes=-2000', 1_000)).toEqual({ start: 0, end: 999 });
  });

  it('rejects malformed, multiple, reversed, and out-of-bounds ranges', () => {
    expect(parseVideoByteRange(undefined, 1_000)).toBeNull();
    expect(parseVideoByteRange('items=0-9', 1_000)).toBeNull();
    expect(parseVideoByteRange('bytes=0-9,20-29', 1_000)).toBeNull();
    expect(parseVideoByteRange('bytes=100-99', 1_000)).toBeNull();
    expect(parseVideoByteRange('bytes=1000-', 1_000)).toBeNull();
    expect(parseVideoByteRange('bytes=-0', 1_000)).toBeNull();
  });
});
