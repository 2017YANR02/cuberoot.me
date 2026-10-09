import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/cubing-live-xian.json';
import { cubingRoundMeta, normalizeCubingRound } from '@cuberoot/shared/cubing-live';
import { collectCubingResults, fetchCubingMeta } from '../src/utils/cubing_live';
import { cubingLiveRoutes } from '../src/routes/cubing_live';

vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

describe('new cubing.com live API', () => {
  it('passes SSE events and heartbeats through without buffering or caching', async () => {
    const body = ': heartbeat\n\nevent: result.updated\ndata: {"type":"result.updated"}\n\n';
    const upstream = vi.fn(async (_url: string) => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    vi.stubGlobal('fetch', upstream);
    const response = await cubingLiveRoutes.request('/cubing-live/Xian-One-More-Clock-2026/stream');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(await response.text()).toBe(body);
    expect(upstream.mock.calls[0][0]).toBe('https://api.cubing.com/competitions/Xian-One-More-Clock-2026/live/stream');
    upstream.mockImplementation(async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
    expect((await cubingLiveRoutes.request('/cubing-live/Xian/stream')).status).toBe(502);
  });
  it('serves the browser round proxy with bounded cache and validates input', async () => {
    const upstream = vi.fn(async () => Response.json(fixture.results['clock:3']));
    vi.stubGlobal('fetch', upstream);
    const path = '/cubing-live/Xian-One-More-Clock-2026/round/clock/3?roundTypeId=f';
    const response = await cubingLiveRoutes.request(path);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).results).toHaveLength(12);
    const invalid = await cubingLiveRoutes.request(path.replace('/clock/3', '/clock/0'));
    expect(invalid.status).toBe(400);
    expect(upstream).toHaveBeenCalledTimes(1);
    upstream.mockImplementation(async () => Response.json({ ...fixture.results['clock:3'], results: [] }));
    expect((await cubingLiveRoutes.request(path)).headers.get('cache-control')).toBe('no-store');
    upstream.mockImplementation(async () => new Response('', { status: 503 }));
    const failed = await cubingLiveRoutes.request(path);
    expect(failed.status).toBe(502);
    expect(failed.headers.get('cache-control')).toBe('no-store');
  });

  it('preserves every published attempt, record, and competitor in all six Xian rounds', () => {
    expect(Object.keys(fixture.results)).toHaveLength(6);
    for (const payload of Object.values(fixture.results)) {
      const snapshot = normalizeCubingRound(payload);
      expect(snapshot.results).toHaveLength(payload.results.length);
      payload.results.forEach((source, index) => {
        expect(snapshot.results[index]).toEqual({
          i: source.id, c: source.competitionId, n: source.competitor.number,
          e: source.eventId, r: String(source.roundNumber), f: payload.round.round.format,
          b: source.best, a: source.average, v: source.attempts,
          sr: source.regionalSingleRecord, ar: source.regionalAverageRecord,
        });
        expect(snapshot.users[String(source.competitor.number)].wcaid).toBe(source.competitor.wcaId ?? '');
      });
    }
    const final = normalizeCubingRound(fixture.results['clock:3'], 'f');
    expect(final.results).toHaveLength(12);
    expect(final.results[0]).toMatchObject({ n: 3, b: 281, a: 369, v: [281, -1, 400, 358, 348], r: 'f' });
    expect(final.users['3'].name).toBe('Yening Liu (刘烨宁)');
    expect(final.round).toMatchObject({ name: 'Final', liveId: '3', tl: 30, co: 0, s: 1, rn: 12 });
  });

  it('loads the real API paths, dual rounds, non-WCA events, and complete roster', async () => {
    const fetched = vi.fn(async (url: string) => {
      const path = new URL(url).pathname.replace('/competitions/Xian-One-More-Clock-2026', '');
      if (!path) return Response.json(fixture.competition);
      if (path === '/live/rounds') return Response.json(fixture.rounds);
      if (path === '/competitors') return Response.json(fixture.roster);
      const match = path.match(/^\/live\/results\/(\w+)\/(\d+)$/);
      const key = `${match?.[1]}:${match?.[2]}` as keyof typeof fixture.results;
      if (!fixture.results[key]) throw new Error(`Unexpected upstream request: ${url}`);
      return Response.json(fixture.results[key]);
    });
    vi.stubGlobal('fetch', fetched);
    const meta = await fetchCubingMeta('Xian-One-More-Clock-2026');
    const progress = vi.fn();
    const snapshot = await collectCubingResults(meta.slug, meta.events, progress);
    expect(meta.compId).toBe(1598);
    expect(meta.events.map(event => [event.i, event.dual, event.rs.map(round => round.i)]))
      .toEqual([['clock', true, ['1', '2', 'f']], ['fto', false, ['1', 'f']], ['funny', false, ['f']]]);
    expect(Object.fromEntries(Object.entries(snapshot.resultsByRound).map(([key, rows]) => [key, rows.length])))
      .toEqual({ 'clock:1': 20, 'clock:2': 20, 'clock:f': 12, 'fto:1': 11, 'fto:f': 8, 'funny:f': 2 });
    for (const entry of fixture.roster) {
      const user = snapshot.users[String(entry.number)];
      expect(user.eventIds).toEqual(entry.registrationEvents.map(event => event.eventId));
      expect(snapshot.membersByFilter.females.includes(entry.number)).toBe(entry.user.gender === 'female');
    }
    expect(progress).toHaveBeenLastCalledWith({ step: 'cubing.results', done: 6, total: 6 });
    expect(fetched).toHaveBeenCalledTimes(9);
  });

  it('supports empty, unfinished rounds and preserves zero, DNF and DNS encodings', () => {
    const original = fixture.results['clock:3'];
    const empty = normalizeCubingRound({ round: { ...original.round, status: 'open' }, results: [] });
    expect(empty).toMatchObject({ results: [], users: {}, round: { rn: 0, tt: 0, s: 0 } });
    const row = { ...original.results[0], best: -1, average: -1, attempts: [0, -1, -2] };
    expect(normalizeCubingRound({ ...original, results: [row] }).results[0].v).toEqual([0, -1, -2]);
    expect(cubingRoundMeta(fixture.rounds[0])).toMatchObject({ co: 40, tl: 60 });
  });

  it('rejects malformed or mismatched upstream data instead of caching empty success', () => {
    const payload = fixture.results['clock:3'];
    expect(() => normalizeCubingRound({ ...payload, results: [{ ...payload.results[0], eventId: '333' }] })).toThrow();
    expect(() => normalizeCubingRound({ ...payload, results: [{ ...payload.results[0], attempts: [NaN] }] })).toThrow();
    expect(() => normalizeCubingRound({ ...payload, results: [{ ...payload.results[0], competitor: { ...payload.results[0].competitor, number: 0 } }] })).toThrow();
  });

  it('keeps upcoming competition metadata when live results are not enabled', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/live/rounds')
      ? Response.json({ message: 'Live results are not enabled' }, { status: 404 })
      : Response.json(fixture.competition)));
    const meta = await fetchCubingMeta('Beijing-Autumn-Rivalry-2026');
    expect(meta.events.map(event => event.i)).toEqual(['clock', 'fto', 'funny']);
    expect(meta.events.every(event => event.rs.length === 0)).toBe(true);
  });
});
