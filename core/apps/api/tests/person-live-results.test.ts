import { beforeEach, expect, it, vi } from 'vitest';
import { hasPersonLiveResult } from '../src/utils/person_live_result';

const query = vi.hoisted(() => vi.fn());
vi.mock('../src/db/connection.js', () => ({ query }));
vi.mock('../src/routes/cubing_live.js', () => ({ inferredOverlayEntries: vi.fn(async () => []) }));
vi.mock('../src/utils/wca_live_overlay.js', () => ({ getOverlayEntries: vi.fn(), overlayDeltaPure: vi.fn() }));
import { wcaStatsExtraRoutes } from '../src/routes/wca_stats_extra';

beforeEach(() => query.mockReset());

it.each([[], [0, 0, 0], null])('excludes unattempted roster rows (%j)', attempts => {
  expect(hasPersonLiveResult(0, 0, attempts)).toBe(false);
});

it.each([501, -1, -2])('keeps a recorded attempt %s before aggregate fields update', value => {
  expect(hasPersonLiveResult(0, 0, [value, 0, 0])).toBe(true);
  expect(hasPersonLiveResult(value, 0, [])).toBe(true);
});

it('does not expose the Ningbo pre-event roster as live results or a competed event', async () => {
  query.mockResolvedValue([{ comp_id: 'NingboOpen2026', comp_name: 'Ningbo Open 2026',
    comp_date: '2026-10-31', event_id: '333', round_type_id: '1', format_id: 'a',
    pos: 1, best: 0, average: 0, attempts: [], source: 'cubing' }]);
  const response = await wcaStatsExtraRoutes.request('/wca/person-live-results?wcaId=2023GENG02');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ wcaId: '2023GENG02', comps: [], results: [] });
});

it('retains partial, DNF and DNS rounds while filtering empty rounds from the same competition', async () => {
  const row = { comp_id: 'NingboOpen2026', comp_name: 'Ningbo Open 2026', comp_date: '2026-10-31',
    event_id: '333', format_id: 'a', pos: 1, best: 0, average: 0, source: 'cubing' };
  query.mockResolvedValue([[], [501, 0], [-1, 0], [-2, 0]].map((attempts, i) => ({
    ...row, round_type_id: String(i), attempts,
  })));
  const response = await wcaStatsExtraRoutes.request('/wca/person-live-results?wcaId=2023GENG02');
  const body = await response.json();
  expect(body.results.map((row: { attempts: number[] }) => row.attempts)).toEqual([[501, 0], [-1, 0], [-2, 0]]);
  expect(body.comps.map((comp: { id: string }) => comp.id)).toEqual(['NingboOpen2026']);
});
