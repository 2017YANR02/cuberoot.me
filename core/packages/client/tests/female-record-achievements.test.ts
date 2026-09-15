import { afterEach, expect, it, vi } from 'vitest';
import { femaleRecordAchievements, fetchFemalePersonRecords, type FemalePersonRecord } from '@/lib/person-achievements';

const row: FemalePersonRecord = { e: '333', t: 'a', v: 452, l: 'FWR', c: 'Test2026', d: '2026-09-13', currentWorld: true };
afterEach(() => vi.unstubAllGlobals());

it('merges current world records into event history and keeps former records in other events', () => {
  const result = femaleRecordAchievements([row, { ...row, c: 'Earlier', v: 480, currentWorld: false },
    { ...row, e: '444', currentWorld: false }], false, 'CN');
  expect(result.history.filter(h => h.level === 'WR').map(h => [h.event, h.current, h.rows.length]))
    .toEqual([['333', true, 2], ['444', false, 1]]);
  expect(result.history.map(h => h.record)).toEqual(['FWR', 'FWR']);
  expect(femaleRecordAchievements([{ ...row, currentWorld: false }], false, 'CN').history[0].current).toBe(false);
});

it('preserves the recorded continent ahead of the current country and separates continents', () => {
  const result = femaleRecordAchievements([{ ...row, l: 'FER' },
    { ...row, c: 'Asia', l: 'FAsR', currentWorld: false }], false, 'CN');
  expect(result.history.filter(h => h.level === 'CR').map(h => [h.record, h.rows.length]))
    .toEqual([['FER', 1], ['FAsR', 1]]);
  for (const [country, record] of [['CN', 'FAsR'], ['PL', 'FER'], ['US', 'FNAR'], ['BR', 'FSAR'], ['AU', 'FOcR'], ['ZA', 'FAfR']]) {
    expect(femaleRecordAchievements([{ ...row, l: 'FCR' }], false, country).history[0].record).toBe(record);
  }
});

it('deduplicates world/continent/live records and only counts complete national history', () => {
  const rows = [row, { ...row, live: true }, { ...row, l: 'FAsR' },
    { ...row, c: 'Earlier2026', v: 500, l: 'FAsR', currentWorld: false },
    { ...row, c: 'Old2025', v: 600, l: 'FNR', currentWorld: false }];
  const complete = femaleRecordAchievements(rows, true);
  expect(complete.count).toBe(1);
  expect(complete.current).toEqual([row]);
  expect(complete.history.map(h => [h.level, h.rows.length])).toEqual([['WR', 1], ['CR', 1], ['NR', 1]]);
  expect(femaleRecordAchievements(rows).history.map(h => h.level)).toEqual(['WR', 'CR']);
});

it('never creates lower-level badges from a higher record, regardless of feed order', () => {
  for (const rows of [[row], [row, { ...row, l: 'FAsR' }, { ...row, l: 'FNR' }],
    [{ ...row, l: 'FNR' }, { ...row, l: 'FAsR' }, row],
    [{ ...row, live: true }, { ...row, l: 'FAsR' }]]) {
    expect(femaleRecordAchievements(rows, true, 'CN').history.map(h => [h.record, h.rows.length])).toEqual([['FWR', 1]]);
  }
  for (const rows of [[{ ...row, l: 'FNR' }, { ...row, l: 'FAsR' }],
    [{ ...row, l: 'FAsR' }, { ...row, l: 'FNR' }]]) {
    expect(femaleRecordAchievements(rows, true, 'CN').history.map(h => [h.record, h.rows.length])).toEqual([['FAsR', 1]]);
  }
});

it('rejects invalid/unofficial records and excludes retired events from current holders', () => {
  const result = femaleRecordAchievements([row, { ...row, v: -1 }, { ...row, l: 'PR' },
    { ...row, e: '333mbf' }, { ...row, e: 'not-an-event' }, { ...row, e: '333ft', t: 's' }]);
  expect(result.count).toBe(2);
  expect(result.current).toEqual([row]);
});

const person = { wca_id: '2025LIAN01', name: 'Yunzhi Lian (连允之)', country_iso2: 'CN' };
const news = { tag: 'FWR', type: 'average', attemptResult: 452, eventId: '333', personName: person.name, countryIso2: 'CN', competitionId: row.c };

it('uses existing world feeds and verifies live news against exact WCA ID and result', async () => {
  let verifiedId = person.wca_id;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input.includes('/persons.json')) return new Response('', { status: 404 });
    if (input.includes('/recent-records')) return Response.json({ records: [news] });
    if (input.includes('/cubing-live/')) return Response.json({ users: { '4': { wcaid: verifiedId } }, resultsByRound: { '333:f': [{ n: 4, a: 452 }] } });
    return Response.json({ rows: [] });
  }));
  const live = await fetchFemalePersonRecords(person, new AbortController().signal);
  expect(live.nationalComplete).toBe(false);
  expect(live.rows).toEqual([{ ...row, d: '', live: true }]);
  verifiedId = 'OTHER';
  expect((await fetchFemalePersonRecords(person, new AbortController().signal)).rows).toEqual([]);
});

it('loads complete national history and does not promote stale live news over a newer world record', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input.includes('/persons.json')) return Response.json({ persons: { OTHER: [{ ...row, v: 450 }], [person.wca_id]: [{ ...row, l: 'FNR', currentWorld: false }] } });
    if (input.includes('/recent-records')) return Response.json({ records: [news] });
    return Response.json({ users: { '4': { wcaid: person.wca_id } }, resultsByRound: { '333:f': [{ n: 4, a: 452 }] } });
  }));
  const data = await fetchFemalePersonRecords(person, new AbortController().signal);
  expect(data.nationalComplete).toBe(true);
  expect(data.rows.map(r => r.currentWorld)).toEqual([false, false]);
});
