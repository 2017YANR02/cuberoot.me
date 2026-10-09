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
  it('filters stale registrations by end date, retaining ongoing and future competitions', async () => {
    const { selectPersonUpcomingCompetitions } = await import('@/lib/person-upcoming');
    const dates = [
      ['BeijingAutumn2026', '2026-10-01', '2026-10-03'],
      ['GuangzhouOpen2026', '2026-10-05', '2026-10-06'],
      ['GuilinOpen2026', '2026-10-18', '2026-10-18'],
      ['Ongoing2026', '2026-10-07', '2026-10-08'],
      ['Today2026', '2026-10-08', ''],
      ['Yesterday2026', '2026-10-07', ''],
      ['NotRegistered2026', '2026-10-09', '2026-10-09'],
    ];
    const competitions = dates.map(([id, start_date, end_date]) => ({
      id, name: id, country: 'cn', start_date, end_date,
    }));
    const ids = competitions.map((c) => c.id).filter((id) => id !== 'NotRegistered2026');
    expect(selectPersonUpcomingCompetitions(ids, competitions, '2026-10-08').map((c) => c.id))
      .toEqual(['Ongoing2026', 'Today2026', 'GuilinOpen2026']);
    expect(selectPersonUpcomingCompetitions(ids, competitions, '2026-10-09').map((c) => c.id))
      .toEqual(['GuilinOpen2026']);
  });

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

  it('reports unavailable sources while retaining registrations found in other sources', async () => {
    fetchUserUpcoming.mockRejectedValueOnce(new Error('offline'));
    const { fetchPersonUpcomingCompetitions } = await import('@/lib/person-upcoming');
    await expect(fetchPersonUpcomingCompetitions('2023ROOT01')).resolves.toEqual({ ids: ['ChinaOpen2099'], incomplete: true });
  });

  it('does not call a failed static index an empty registration list', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 503 }));
    const { fetchPersonUpcomingCompetitions } = await import('@/lib/person-upcoming');
    await expect(fetchPersonUpcomingCompetitions('2023ROOT01')).resolves.toEqual({ ids: [], incomplete: true });
  });
});
