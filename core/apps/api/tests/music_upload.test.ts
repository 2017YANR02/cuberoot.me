import { describe, expect, it } from 'vitest';
import {
  MUSIC_OWNER_QUOTA_BYTES,
  exceedsMusicOwnerQuota,
  sniffMusicAudio,
  sniffMusicCover,
  storedMusicResponse,
} from '../src/utils/music_upload.js';

describe('music upload and streaming contract', () => {
  it('accepts only allowed audio and cover signatures', () => {
    expect(sniffMusicAudio(Buffer.from('ID3\x04\0\0', 'binary'))).toBe('audio/mpeg');
    expect(sniffMusicAudio(Buffer.from('\0\0\0\x18ftypM4A ', 'binary'))).toBe('audio/mp4');
    expect(sniffMusicAudio(Buffer.from('fLaC'))).toBe('audio/flac');
    expect(sniffMusicAudio(Buffer.from('RIFF\0\0\0\0WAVE', 'binary'))).toBe('audio/wav');
    expect(sniffMusicAudio(Buffer.from('not audio'))).toBeNull();
    expect(sniffMusicCover(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffMusicCover(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png');
    expect(sniffMusicCover(Buffer.from('RIFF\0\0\0\0WEBP', 'binary'))).toBe('image/webp');
  });

  it('returns correct HEAD and unsatisfied Range metadata without opening the file', () => {
    const head = storedMusicResponse({
      filePath: 'unused', mime: 'audio/mpeg', size: 1000, rangeHeader: 'bytes=100-199',
      headOnly: true, filename: 'song.mp3', attachment: false,
    });
    expect(head.status).toBe(206);
    expect(head.headers.get('Content-Range')).toBe('bytes 100-199/1000');
    expect(head.headers.get('Content-Length')).toBe('100');
    expect(head.headers.get('Content-Disposition')).toContain('inline');

    const invalid = storedMusicResponse({
      filePath: 'unused', mime: 'audio/mpeg', size: 1000, rangeHeader: 'bytes=1000-',
      headOnly: true, filename: 'song.mp3', attachment: true,
    });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get('Content-Range')).toBe('bytes */1000');
  });

  it('enforces the one-GiB aggregate owner quota at the byte boundary', () => {
    expect(exceedsMusicOwnerQuota(MUSIC_OWNER_QUOTA_BYTES - 1, 1)).toBe(false);
    expect(exceedsMusicOwnerQuota(MUSIC_OWNER_QUOTA_BYTES - 1, 2)).toBe(true);
    expect(exceedsMusicOwnerQuota(-1, 1)).toBe(true);
  });
});
