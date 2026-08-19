import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAlg } from '@cuberoot/shared';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('algorithm data cache versions', () => {
  it.each(['pf', 'tl'])('busts stale FTO %s stage setup responses', async (set) => {
    const fetchMock = vi.fn(async (_input: unknown) => ({
      ok: true,
      json: async () => ({ puzzle: 'fto', set, cases: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await loadAlg('fto', set);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('v=2026-08-19-fto-stages');
  });
});
