import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAlg } from '@cuberoot/shared';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('algorithm data cache versions', () => {
  it('busts stale FTO pair-formation setup responses', async () => {
    const fetchMock = vi.fn(async (_input: unknown) => ({
      ok: true,
      json: async () => ({ puzzle: 'fto', set: 'pf', cases: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await loadAlg('fto', 'pf');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('v=2026-08-19-pf-stage');
  });
});
