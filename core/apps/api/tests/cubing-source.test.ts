import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/cubing-live-xian.json';
import { cubingHttp, fetchCubingJson, fetchCubingLiveRound, fetchCubingCompetitions, findCubingCompetition, cubingRecordInterval } from '../src/utils/cubing_source';
import { fetchCubingMeta } from '../src/utils/cubing_live';
import { openCubingStream } from '../src/utils/cubing_stream';
import { competitionGroupAwardsRoutes } from '../src/routes/competition_group_awards';

vi.mock('../src/db/connection.js', () => ({ query: vi.fn(async () => []) }));
const slug = 'Xian-One-More-Clock-2026';
const roundPath = '/live/results/clock/3';
const round = () => fetchCubingLiveRound(slug, 'clock', 3, 'f');
beforeEach(() => {
  cubingHttp.clear();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected network request'); }));
});
afterEach(() => { cubingHttp.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('shared cubing source request budget', () => {
  it('coalesces browser/monitor/prewarm requests and isolates mutable snapshots', async () => {
    const upstream = vi.fn(async () => Response.json(fixture.results['clock:3']));
    vi.stubGlobal('fetch', upstream);
    const snapshots = await Promise.all(Array.from({ length: 20 }, () => round()));
    const raw = await fetchCubingJson<typeof fixture.results['clock:3']>(slug, roundPath);
    snapshots[0].results[0].v[0] = 999;
    expect(snapshots[1].results[0].v[0]).toBe(281);
    expect(raw.results[0].attempts[0]).toBe(281);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('serves deletions immediately after an event, including completed rounds', async () => {
    const upstream = vi.fn(async () => Response.json(fixture.results['clock:3']));
    vi.stubGlobal('fetch', upstream);
    expect((await round()).results).toHaveLength(12);
    upstream.mockImplementation(async () => Response.json({ ...fixture.results['clock:3'], results: [] }));
    cubingHttp.invalidate(slug, 'clock', 3);
    expect((await round()).results).toEqual([]);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('does not let an invalidated in-flight response replace corrected data', async () => {
    let finish!: (response: Response) => void;
    const upstream = vi.fn(async () => Response.json({ value: 'corrected' }));
    upstream.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', upstream);
    const old = fetchCubingJson(slug, roundPath);
    cubingHttp.invalidate(slug, 'clock', 3);
    expect(await fetchCubingJson(slug, roundPath)).toEqual({ value: 'corrected' });
    finish(Response.json({ value: 'old' }));
    await old;
    expect(await fetchCubingJson(slug, roundPath)).toEqual({ value: 'corrected' });
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('caches nonexistent competitions and avoids their dependent round requests', async () => {
    const upstream = vi.fn(async () => Response.json({}, { status: 404 }));
    vi.stubGlobal('fetch', upstream);
    for (let i = 0; i < 4; i++) await expect(fetchCubingMeta('Not-On-Cubing')).rejects.toMatchObject({ status: 404 });
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls[0][0]).toBe('https://api.cubing.com/competitions/Not-On-Cubing');
  });

  it('shares the directory and never probes unlisted award competitions', async () => {
    const upstream = vi.fn(async () => Response.json({ data: [], total: 0, skip: 0, take: 2000 }));
    vi.stubGlobal('fetch', upstream);
    await Promise.all([fetchCubingCompetitions(), findCubingCompetition('Foreign2026')]);
    for (let i = 0; i < 3; i++) {
      expect((await competitionGroupAwardsRoutes.request('/group-awards/competitions/Foreign2026')).status).toBe(404);
    }
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls[0][0]).toContain('/competitions?skip=0&take=2000');
  });

  it('honors Retry-After across different competitions without retry storms', async () => {
    vi.useFakeTimers();
    const upstream = vi.fn(async () => Response.json({}, { status: 429, headers: { 'Retry-After': '120' } }));
    vi.stubGlobal('fetch', upstream);
    await expect(fetchCubingJson('A')).rejects.toMatchObject({ status: 429 });
    await expect(fetchCubingJson('B')).rejects.toMatchObject({ status: 429 });
    expect(upstream).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_001);
    upstream.mockImplementation(async () => Response.json({ id: 1 }));
    expect(await fetchCubingJson('B')).toEqual({ id: 1 });
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('retains minute monitoring across all competition days and reduces ended scans', () => {
    const comp = { startDate: '2026-11-13', endDate: '2026-11-15' };
    expect(cubingRecordInterval(comp, Date.parse('2026-11-15T15:59:59Z'))).toBe(60_000);
    expect(cubingRecordInterval(comp, Date.parse('2026-11-15T16:00:00Z'))).toBe(15 * 60_000);
    expect(cubingRecordInterval(comp, Date.parse('2026-11-18T00:00:00Z'))).toBe(6 * 3600_000);
  });

  it('keeps interactive polling fresh during an SSE outage even for old completed rounds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));
    const upstream = vi.fn(async (url: string) => Response.json(url.endsWith(roundPath)
      ? fixture.results['clock:3'] : { startDate: '2026-09-13', endDate: null }));
    vi.stubGlobal('fetch', upstream);
    await fetchCubingJson(slug);
    await round();
    await vi.advanceTimersByTimeAsync(15_000);
    await round(); // background reader still reuses its six-hour snapshot
    expect(upstream).toHaveBeenCalledTimes(2);
    await fetchCubingLiveRound(slug, 'clock', 3, 'f', undefined, true);
    expect(upstream).toHaveBeenCalledTimes(3);
  });

  it('clears an old missing-competition response as soon as the directory publishes it', async () => {
    const competition = { ...fixture.competition, alias: slug, startDate: '2026-11-14', endDate: null, locations: [], wcaCompetitionId: 'Xian2026' };
    let published = false;
    const upstream = vi.fn(async (url: string) => url.includes('?')
      ? Response.json({ data: [competition], total: 1, skip: 0, take: 2000 })
      : Response.json(published ? competition : {}, { status: published ? 200 : 404 }));
    vi.stubGlobal('fetch', upstream);
    await expect(fetchCubingJson(slug)).rejects.toMatchObject({ status: 404 });
    published = true;
    await fetchCubingCompetitions();
    expect(await fetchCubingJson(slug)).toMatchObject({ alias: slug });
    expect(upstream).toHaveBeenCalledTimes(3);
  });

  it('bounds all different upstream requests to three at a time', async () => {
    let active = 0, peak = 0;
    const upstream = vi.fn(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return Response.json({});
    });
    vi.stubGlobal('fetch', upstream);
    await Promise.all(Array.from({ length: 12 }, (_, i) => fetchCubingJson('Comp' + i)));
    expect(peak).toBe(3);
    expect(upstream).toHaveBeenCalledTimes(12);
  });
});

describe('shared cubing live stream', () => {
  it('honors stream Retry-After for JSON requests and other stream reconnects too', async () => {
    const upstream = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    vi.stubGlobal('fetch', upstream);
    await expect(openCubingStream('Throttled-Stream', new AbortController().signal)).rejects.toThrow();
    await expect(openCubingStream('Another-Stream', new AbortController().signal)).rejects.toThrow('cooling down');
    await expect(fetchCubingJson('Another-Competition')).rejects.toMatchObject({ status: 429 });
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('does not abort another viewer when the first leaves while connecting', async () => {
    let finish!: (response: Response) => void;
    let signal!: AbortSignal;
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      signal = init!.signal!;
      return new Promise(resolve => { finish = resolve; });
    }));
    const a = new AbortController(), b = new AbortController();
    const first = openCubingStream('Connecting-Stream', a.signal);
    const rejection = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const second = openCubingStream('Connecting-Stream', b.signal);
    a.abort();
    finish(new Response(new ReadableStream(), { headers: { 'Content-Type': 'text/event-stream' } }));
    await rejection;
    const response = await second;
    expect(signal.aborted).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    await response.body!.cancel();
    expect(signal.aborted).toBe(true);
  });

  it('fans out one stream, invalidates before delivery, and closes only after the last viewer leaves', async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    let upstreamSignal!: AbortSignal;
    let corrected = false;
    const streamSlug = 'Shared-Stream';
    const upstream = vi.fn(async (url: string, init?: RequestInit) => {
      if (!url.endsWith('/live/stream')) return Response.json({ ...fixture.results['clock:3'], results: corrected ? [] : fixture.results['clock:3'].results });
      upstreamSignal = init!.signal!;
      return new Response(new ReadableStream<Uint8Array>({ start(c) { source = c; } }), { headers: { 'Content-Type': 'text/event-stream' } });
    });
    vi.stubGlobal('fetch', upstream);
    const a = new AbortController(), b = new AbortController();
    const [first, second] = await Promise.all([openCubingStream(streamSlug, a.signal), openCubingStream(streamSlug, b.signal)]);
    const readA = first.body!.getReader(), readB = second.body!.getReader();
    expect(upstream).toHaveBeenCalledTimes(1);
    expect((await fetchCubingLiveRound(streamSlug, 'clock', 3, 'f')).results).toHaveLength(12);
    corrected = true;
    const frame = 'event: result.updated\r\ndata: {"payload":{"round":{"eventId":"clock","roundNumber":3}}}\r\n\r\n';
    source.enqueue(new TextEncoder().encode(frame.slice(0, -1)));
    source.enqueue(new TextEncoder().encode(frame.slice(-1)));
    expect(new TextDecoder().decode((await readA.read()).value)).toContain('result.updated');
    expect(new TextDecoder().decode((await readB.read()).value)).toContain('result.updated');
    expect((await fetchCubingLiveRound(streamSlug, 'clock', 3, 'f')).results).toEqual([]);
    expect(upstream).toHaveBeenCalledTimes(3); // one stream plus initial and corrected snapshots
    a.abort();
    expect(upstreamSignal.aborted).toBe(false);
    source.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
    expect(new TextDecoder().decode((await readB.read()).value)).toBe(': heartbeat\n\n');
    b.abort();
    expect(upstreamSignal.aborted).toBe(true);
    expect((await readB.read()).done).toBe(true);
  });
});
