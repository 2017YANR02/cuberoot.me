import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchUserUpcoming } = vi.hoisted(() => ({
  fetchUserUpcoming: vi.fn<() => Promise<string[]>>(),
}));

vi.mock('@/lib/stats-base', () => ({
  statsUrl: (path: string) => path,
}));

vi.mock('@/lib/wca-api', () => ({
  fetchUserUpcoming,
  WCA_ID_REGEX: /^\d{4}[A-Z]{4}\d{2}$/,
}));

describe('person upcoming competitions', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchUserUpcoming.mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.endsWith('/stats/cn_upcoming_registrations.json')
        ? { ChinaOpen2099: ['2023ROOT01'] }
        : { competitions: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }));
  });

  it('uses the China registration index when the WCA upcoming API is empty', async () => {
    const { fetchPersonUpcomingCompetitionIds } = await import('@/lib/person-upcoming');

    await expect(fetchPersonUpcomingCompetitionIds('2023root01')).resolves.toEqual([
      'ChinaOpen2099',
    ]);
    expect(fetch).toHaveBeenCalledWith(
      '/stats/upcoming_comps.json',
      { cache: 'no-cache' },
    );
    expect(fetch).toHaveBeenCalledWith(
      '/stats/cn_upcoming_registrations.json',
      { cache: 'no-cache' },
    );
  });

  it('does not pin the first registration index for the browser lifetime', async () => {
    let competitionId = 'OldOpen2099';
    vi.mocked(fetch).mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.endsWith('/stats/cn_upcoming_registrations.json')
        ? { [competitionId]: ['2023ROOT01'] }
        : { competitions: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const { fetchPersonUpcomingCompetitionIds } = await import('@/lib/person-upcoming');

    await expect(fetchPersonUpcomingCompetitionIds('2023ROOT01')).resolves.toEqual([
      'OldOpen2099',
    ]);
    competitionId = 'FreshOpen2099';
    await expect(fetchPersonUpcomingCompetitionIds('2023ROOT01')).resolves.toEqual([
      'FreshOpen2099',
    ]);
  });
});
