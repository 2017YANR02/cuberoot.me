import { describe, expect, it } from 'vitest';
import { appendReconVideo, reconVideoGroups, splitReconVideoGroups, normalizeReconVideoUrls } from '@/lib/recon-video-url';

describe('reconstruction video URLs', () => {
  it('normalizes the submitted YouTube and Bilibili examples line by line', () => {
    expect(normalizeReconVideoUrls('https://www.youtube.com/watch?v=pKGnGfDK5mM\nhttps://www.bilibili.com/video/BV1wqpw6KEmv/?spm_id_from=333.1387.homepage.video_card.click'))
      .toBe('https://youtu.be/pKGnGfDK5mM\nhttps://www.bilibili.com/video/BV1wqpw6KEmv');
  });
  it.each(['shorts', 'embed', 'live'])('supports YouTube %s links', kind => {
    expect(normalizeReconVideoUrls(`https://www.youtube.com/${kind}/pKGnGfDK5mM?si=tracking`)).toBe('https://youtu.be/pKGnGfDK5mM');
  });
  it('preserves video part and playback offsets while removing tracking', () => {
    expect(normalizeReconVideoUrls('https://youtu.be/pKGnGfDK5mM?si=tracking&t=45')).toBe('https://youtu.be/pKGnGfDK5mM?t=45');
    expect(normalizeReconVideoUrls('https://www.bilibili.com/video/BV1wqpw6KEmv/?p=2&t=12&spm_id_from=abc')).toBe('https://www.bilibili.com/video/BV1wqpw6KEmv?p=2&t=12');
  });
  it.each(['https://b23.tv/abc', 'https://static.cuberoot.me/video.mp4?token=keep', 'https://example.com/watch?v=pKGnGfDK5mM', 'https://www.youtube.com/watch?v=unfinished', 'not a URL', ''])('preserves unresolved and unrelated input: %s', value => {
    expect(normalizeReconVideoUrls(value)).toBe(value);
  });
  it('is idempotent', () => {
    const value = 'https://youtu.be/pKGnGfDK5mM\nhttps://www.bilibili.com/video/BV1wqpw6KEmv';
    expect(normalizeReconVideoUrls(value)).toBe(value);
  });
});

describe('independent videos and alternate sources', () => {
  const yt = 'https://youtu.be/pKGnGfDK5mM';
  const bili = 'https://www.bilibili.com/video/BV1wqpw6KEmv';
  it('keeps legacy sources together without pairing independent videos by platform', () => {
    expect(reconVideoGroups(yt + '\n' + bili)).toEqual([[yt, bili]]);
    expect(reconVideoGroups(yt + '\n\n' + bili)).toEqual([[yt], [bili]]);
    expect(reconVideoGroups(yt + '\n' + bili + '\n\n' + yt + '\n\n' + bili)).toEqual([[yt, bili], [yt], [bili]]);
  });
  it('keeps group boundaries through normalization, CRLF and empty draft inputs', () => {
    const value = yt + '\r\n' + bili + '\r\n \r\n' + bili;
    expect(reconVideoGroups(normalizeReconVideoUrls(value))).toEqual([[yt, bili], [bili]]);
    expect(splitReconVideoGroups(yt + '\n\n')).toEqual([yt, '']);
    expect(reconVideoGroups('\n\n')).toEqual([]);
  });
  it('appends repeated uploads as independent videos without flattening sources', () => {
    const original = yt + '\n' + bili;
    const first = appendReconVideo(original, 'https://example.com/1.mp4');
    const second = appendReconVideo(first, 'https://example.com/2.mp4');
    expect(reconVideoGroups(second)).toEqual([[yt, bili], ['https://example.com/1.mp4'], ['https://example.com/2.mp4']]);
    expect(appendReconVideo(second, yt)).toBe(second);
  });
});
