import { expect, it, vi } from 'vitest';
import { fetchRankForWca, getCachedRankForWca } from '@/lib/rank-client';

it('refreshes a cached ranking after new results arrive instead of keeping it for the session', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ rank: 3, total: 100 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ rank: 4, total: 101 }) });
  vi.stubGlobal('fetch', fetchMock);
  try {
    expect((await fetchRankForWca('333', 427, 'average', 'CN'))?.world.rank).toBe(3);
    expect(getCachedRankForWca('333', 427, 'average', 'CN')?.world.rank).toBe(3);
    now.mockReturnValue(1_800_000_061_000);
    expect(getCachedRankForWca('333', 427, 'average', 'CN')).toBeUndefined();
    expect((await fetchRankForWca('333', 427, 'average', 'CN'))?.world.rank).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally { now.mockRestore(); vi.unstubAllGlobals(); }
});
