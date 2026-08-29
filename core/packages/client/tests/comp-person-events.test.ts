import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCompPersonEventIds } from '@/lib/comp-wcif';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('competition person event ids', () => {
  it('reuses and normalizes the competition psych-sheet roster', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
      ok: true,
      json: async () => ({
        users: {
          '74': {
            wcaid: '2023GENG02',
            eventIds: ['333', 'oh', '333', '', null],
          },
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCompPersonEventIds('WuhanCrimsonAutumn2026', '2023geng02'))
      .resolves.toEqual(['333', '333oh']);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/comp/WuhanCrimsonAutumn2026');
  });

  it('treats an empty psych-sheet registration as authoritative', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
      ok: true,
      json: async () => ({ users: { '1': { wcaid: '2026TEST01', eventIds: [] } } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCompPersonEventIds('EmptyEvents2026', '2026TEST01'))
      .resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('falls back to public WCIF when psych-sheet data is unavailable', async () => {
    const responses = [
      { ok: false },
      {
        ok: true,
        json: async () => ({
          persons: [{
            wcaId: '2026TEST02',
            registration: { eventIds: ['3', 'py'], isCompeting: true, status: 'accepted' },
          }],
        }),
      },
    ];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => responses.shift()!);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCompPersonEventIds('WcifFallback2026', '2026TEST02'))
      .resolves.toEqual(['333', 'pyram']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://www.worldcubeassociation.org/api/v0/competitions/WcifFallback2026/wcif/public',
    );
  });
});
