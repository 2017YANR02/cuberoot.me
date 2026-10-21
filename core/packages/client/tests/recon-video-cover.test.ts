import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBiliCover, getDouyinCover } from '@/lib/recon-api';
import { loadBiliCover, loadDouyinCover, reconCoverCandidates } from '@/lib/recon-video-cover';

vi.mock('@/lib/recon-api', () => ({ getBiliCover: vi.fn(), getDouyinCover: vi.fn() }));

describe('video cover recovery', () => {
  beforeEach(() => vi.resetAllMocks());

  it('keeps alternate videos in language order without retrying duplicate links', () => {
    const urls = 'https://youtu.be/pKGnGfDK5mM\nhttps://www.bilibili.com/video/BV1qppd65EY1\nhttps://www.bilibili.com/video/BV1wqpw6KEmv\nhttps://www.bilibili.com/video/BV1qppd65EY1';
    expect(reconCoverCandidates(urls, true)).toEqual([
      { kind: 'bili', id: 'BV1qppd65EY1' },
      { kind: 'bili', id: 'BV1wqpw6KEmv' },
      { kind: 'yt', id: 'pKGnGfDK5mM' },
    ]);
    expect(reconCoverCandidates(urls, false)[0]).toEqual({ kind: 'yt', id: 'pKGnGfDK5mM' });
  });

  it.each([
    { load: loadBiliCover, api: getBiliCover, id: 'BV-recovery' },
    { load: loadDouyinCover, api: getDouyinCover, id: 'https://v.douyin.com/recovery' },
  ])('deduplicates pending calls and retries a failed $id request on later use', async ({ load, api, id }) => {
    vi.mocked(api).mockRejectedValueOnce(new Error('502')).mockResolvedValueOnce({ pic: 'https://example.org/cover.jpg' });
    const pending = load(id);
    const duplicate = load(id);
    expect(api).toHaveBeenCalledTimes(1);
    expect(await pending).toBeNull();
    expect(await duplicate).toBeNull();
    expect(await load(id)).toBe('https://example.org/cover.jpg');
    expect(await load(id)).toBe('https://example.org/cover.jpg');
    expect(api).toHaveBeenCalledTimes(2);
  });
});
