import { describe, expect, it } from 'vitest';
import { normalizeReconVideoUrls } from '@/lib/recon-video-url';

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
