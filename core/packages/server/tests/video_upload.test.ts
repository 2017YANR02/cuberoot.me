import { describe, expect, it } from 'vitest';
import { parseVideoByteRange, sniffVideo } from '../src/utils/video_upload.js';

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
