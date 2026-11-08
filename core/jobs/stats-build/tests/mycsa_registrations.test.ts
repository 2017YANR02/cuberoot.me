import { describe, expect, it, vi } from 'vitest';
import { fetchMycsaRegistrations, parseMycsaRoster } from '../src/mycsa_registrations';
import { buildUpcomingCompsFromWcif } from '../src/bin/fetch_upcoming_comps';

const id = 'MalaysiaCubeChampionship2026';
const sourceId = 'mycsa-local-id';
const geng = '2023GENG02';
const details = { competition_ID: sourceId, wcaURL: `worldcubeassociation.org/competitions/${id}` };
const row = { competition_ID: sourceId, WCAID: geng, approved: true, deleted: false, events: '3x3x3,4x4x4,3x3x3 One-Handed' };
const catalog = {
  id, name: 'Malaysia Cube Championship 2026', country: 'MY', city: 'Selangor',
  start_date: '2026-12-04', end_date: '2026-12-06', events: ['3', '4', 'oh'], competitor_limit: 300,
  registration_open: null, registration_close: null, latitude_degrees: 0, longitude_degrees: 0, url: '',
};

describe('MYCSA public registrations', () => {
  it('uses approved registrations only, counts newcomers and normalizes event totals', () => {
    const body = { CompDetails: details, list: [row,
      { ...row, approved: false }, { ...row, deleted: true }, { ...row, waitingList: true },
      { ...row, WCAID: '', events: '3x3x3' },
    ] };
    expect(parseMycsaRoster(body, sourceId, id)).toEqual({
      competitors: [geng], registered: 2, eventRegs: { '3': 2, '4': 1, oh: 1 },
    });
  });

  it('rejects malformed or mismatched responses instead of publishing an empty roster', () => {
    for (const body of [{}, { CompDetails: details, list: [null] },
      { CompDetails: { ...details, competition_ID: 'wrong' }, list: [] },
      { CompDetails: details, list: [{ ...row, approved: 'true' }] },
      { CompDetails: details, list: [{ ...row, events: 'unrecognized event' }] },
    ]) expect(() => parseMycsaRoster(body, sourceId, id)).toThrow();
    expect(parseMycsaRoster({ CompDetails: details, list: [] }, sourceId, id).competitors).toEqual([]);
  });

  it('discovers competitions by their WCA link and fetches only current catalog entries', async () => {
    const request = vi.fn().mockResolvedValueOnce([
      details, { competition_ID: 'past', wcaURL: 'https://www.worldcubeassociation.org/competitions/Past2026' },
    ]).mockResolvedValueOnce({ CompDetails: details, list: [row] });
    const result = await fetchMycsaRegistrations([catalog], '2026-11-08', request);
    expect(result[id].competitors).toEqual([geng]);
    expect(request.mock.calls).toEqual([
      ['GetCompetitionList', { ActiveStatus: 'Active' }], ['GetParticipantList', { CompetitionID: sourceId }],
    ]);
    await expect(fetchMycsaRegistrations([catalog], '2026-11-08', async () => { throw new Error('offline'); }))
      .rejects.toThrow('offline');
    await expect(fetchMycsaRegistrations([catalog], '2026-11-08', async () => ({ error: 'unavailable' })))
      .rejects.toThrow('Invalid MYCSA competition list');
  });

  it('adds Geng without a WCA registration and removes withdrawn registrations even if WCIF is stale', async () => {
    const cubers = { [geng]: { name: 'Xuanyi Geng (耿暄一)', events: { '333': { ranking: true, wr: true, current_wr: true } } } };
    const roster = parseMycsaRoster({ CompDetails: details, list: [row] }, sourceId, id);
    const result = await buildUpcomingCompsFromWcif(cubers, [catalog], {}, [], {}, { [id]: roster });
    expect(result.map(c => [c.id, c.top_cubers.map(p => p.id)])).toEqual([[id, [geng]]]);
    const wcif = { [id]: { competitors: [geng], rounds: {}, eventRegs: {}, roundMeta: {}, h2hEvents: [] } };
    expect(await buildUpcomingCompsFromWcif(cubers, [catalog], wcif, [], {}, {
      [id]: { competitors: [], registered: 0, eventRegs: {} },
    })).toEqual([]);
  });
});
