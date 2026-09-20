import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCubingCompetitions, fetchCubingCompetitors, type CubingCompetition } from '@cuberoot/shared/cubing-live';
import { fetchCubingAttempts } from '../src/utils/cubing_proxy';
import { scanComp, isChinaInWindow, suppressAdjudicatedRecordPrs } from '../src/monitors/cubing_record';
import { formatCompMessage } from '../src/monitors/cubing_comp';
import fixture from './fixtures/cubing-live-xian.json';

vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));
vi.mock('../src/monitors/bark.js', () => ({ sendBark: vi.fn(() => { throw new Error('No notifications in tests'); }) }));
const comp: CubingCompetition = {
  ...fixture.competition, alias: 'Xian-One-More-Clock-2026', nameZh: '西安加时赛',
  wcaCompetitionId: 'XianOneMoreClock2026', startDate: '2026-09-13', endDate: null,
  live: true, status: 'announced', competitorLimit: 60, acceptedCount: 24,
  registrationStartTime: null, registrationEndTime: null,
  locations: [{ regionIso2: 'CN', venue: 'Venue', venueZh: '赛场', competitorLimit: 60 }],
};
function mockResults(records = false) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = new URL(url).pathname.replace('/competitions/' + comp.alias, '');
    if (!path) return Response.json(fixture.competition);
    if (path === '/live/rounds') return Response.json(fixture.rounds);
    if (path === '/competitors') return Response.json(fixture.roster);
    const match = path.match(/^\/live\/results\/(\w+)\/(\d+)$/);
    const key = `${match?.[1]}:${match?.[2]}` as keyof typeof fixture.results;
    const payload = structuredClone(fixture.results[key]);
    if (!payload) throw new Error(url);
    if (records && key === 'clock:3') Object.assign(payload.results[0], {
      regionalSingleRecord: 'NR', regionalAverageRecord: '', personalAverageRecord: 'PR',
    });
    return Response.json(payload);
  }));
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('cubing.com migration consumers', () => {
  it('requests a complete page to avoid unstable equal-date ordering and rejects partial data', async () => {
    const fetcher = vi.fn(async (url: string) => Response.json({
      data: new URL(url).searchParams.get('take') === '2000' ? [{ ...comp, id: 1 }] : [{ ...comp, id: 1 }, { ...comp, id: 2 }], total: 2,
      skip: 0, take: Number(new URL(url).searchParams.get('take')),
    }));
    vi.stubGlobal('fetch', fetcher);
    expect((await fetchCubingCompetitions()).map(row => row.id)).toEqual([1, 2]);
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      'https://api.cubing.com/competitions?skip=0&take=2000', 'https://api.cubing.com/competitions?skip=0&take=2',
    ]);
    fetcher.mockImplementation(async (url: string) => Response.json({ data: [comp], total: 2, skip: Number(new URL(url).searchParams.get('skip')), take: 100 }));
    await expect(fetchCubingCompetitions()).rejects.toThrow('pagination changed');
    fetcher.mockImplementation(async () => Response.json({ data: [], total: 2, skip: 0, take: 100 }));
    await expect(fetchCubingCompetitions()).rejects.toThrow('Invalid');
  });
  it('keeps the full public roster, events, genders and newcomers', async () => {
    mockResults();
    const users = await fetchCubingCompetitors(comp.alias);
    expect(Object.keys(users)).toHaveLength(fixture.roster.length);
    for (const entry of fixture.roster) {
      expect(users[String(entry.number)].wcaid).toBe(entry.user.wcaId || '');
      expect(users[String(entry.number)].eventIds).toEqual(entry.registrationEvents.map(row => row.eventId));
    }
  });
  it('imports the actual final attempts and expires cached completed results', async () => {
    vi.useFakeTimers();
    mockResults();
    expect(await fetchCubingAttempts(comp.alias, 'clock', 'f', '2023LIUY04')).toEqual([2.81, -1, 4, 3.58, 3.48]);
    const calls = vi.mocked(fetch).mock.calls.length;
    expect(await fetchCubingAttempts(comp.alias, 'clock', 'f', 'MISSING')).toBeNull();
    expect(vi.mocked(fetch).mock.calls).toHaveLength(calls);
    vi.advanceTimersByTime(15_001);
    await fetchCubingAttempts(comp.alias, 'clock', 'f', '2023LIUY04');
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls * 2);
    expect(await fetchCubingAttempts(comp.alias, 'clock', 'c', '2023LIUY04')).toEqual([2.81, -1, 4, 3.58, 3.48]);
  });
  it('preserves record deduplication IDs and independent watched-person PRs', async () => {
    mockResults(true);
    const events = await scanComp(comp, new Set(['刘烨宁']));
    const id = fixture.results['clock:3'].results[0].id;
    expect(events.find(event => event.uid === `cubing-${id}-sr`)).toMatchObject({ tag: 'NR', roundNumber: 3, personRegion: 'CN', attemptResult: 281 });
    expect(events.find(event => event.uid === `cubing-${id}-na`)).toMatchObject({ tag: 'PR', attemptResult: 369 });
    expect((await scanComp(comp, new Set())).some(event => event.tag === 'PR')).toBe(false);
  });
  it('does not downgrade an adjudicated FWR to an upstream personal record', () => {
    const prs = [{
      i: 427, n: 4, e: '333', r: '3', b: 354, a: 427, nb: false, na: true,
      _wcaid: '2023LIAN05', _name: 'Yunzhi Lian (连允之)', _region: 'CN',
    }];
    suppressAdjudicatedRecordPrs(prs, [{ i: 427, n: 4, e: '333', r: '3', b: 354, a: 427, ar: 'FWR' }]);
    expect(prs[0].na).toBe(false);
  });
  it('uses real WCA IDs in notices and the new date/location/live fields', async () => {
    expect((await formatCompMessage({ ...comp, alias: 'Different-Alias' })).url).toContain('/XianOneMoreClock2026');
    expect((await formatCompMessage({ ...comp, type: 'other' })).url).toBe('https://cubing.com/competition/' + comp.alias);
    const now = Date.parse('2026-09-19T00:00:00Z') / 1000;
    expect(isChinaInWindow(comp, now, 30 * 86400)).toBe(true);
    expect(isChinaInWindow({ ...comp, live: false }, now, 30 * 86400)).toBe(false);
    expect(isChinaInWindow({ ...comp, startDate: '2026-01-01' }, now, 30 * 86400)).toBe(false);
  });
});
