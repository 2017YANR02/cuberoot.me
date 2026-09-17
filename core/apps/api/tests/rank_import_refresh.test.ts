import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ version: 'before', values: [351, 367], query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: state.query }));
vi.mock('../src/routes/cubing_live.js', () => ({ inferredOverlayEntries: vi.fn(async () => []) }));
vi.mock('../src/utils/wca_live_overlay.js', async importOriginal => ({
  ...await importOriginal<object>(), getOverlayEntries: vi.fn(async () => []),
}));

beforeEach(() => {
  vi.resetModules();
  state.version = 'before';
  state.values = [351, 367];
  state.query.mockImplementation(async (sql: string) => {
    if (sql.includes('meta_historical')) return [{ value: state.version }];
    if (sql.includes('MIN(value)') || sql.includes('MIN(t.value)')) return state.values.map(m => ({ m }));
    if (sql.includes('wca_countries')) return [{ id: 'China', iso2: 'CN', continent_id: '_Asia' }];
    return [];
  });
});

it('invalidates world, country and continent together when results are imported', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
  try {
    const { wcaStatsExtraRoutes } = await import('../src/routes/wca_stats_extra');
    const url = '/wca/rank-for?event=333&type=average&centis=427&country=CN';
    const before = await wcaStatsExtraRoutes.request(url);
    expect((await before.json()).rank).toBe(3);
    state.version = 'after';
    state.values = [351, 367, 424];
    now.mockReturnValue(1_800_000_061_000);
    const after = await wcaStatsExtraRoutes.request(url);
    const body = await after.json();
    expect(body.rank).toBe(4);
    expect(body.national.rank).toBe(4);
    expect(body.continental.rank).toBe(4);
    expect(after.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=60');
  } finally { now.mockRestore(); }
});
