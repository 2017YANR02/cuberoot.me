import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const state = vi.hoisted(() => ({ db: null as ReturnType<typeof postgres> | null }));
vi.mock('../src/db/connection.js', () => ({
  query: (sql: string, params: unknown[] = []) => {
    let n = 0;
    return state.db!.unsafe(sql.replace(/\?/g, () => `$${++n}`), params as never[]);
  },
}));
vi.mock('../src/routes/wca_stats_extra.js', () => ({
  VALID_EVENTS: new Set(['333', 'skewb']), ACTIVE_EVENTS: ['333', 'skewb'],
  MAX_SIZE: 100, DEFAULT_SIZE: 20, CACHE_HEADER: 'no-store',
  resolveCountryFull: async (s: string) => ({ id: ({ CN: 'China', HK: 'Hong Kong', US: 'USA' } as Record<string, string>)[s] ?? s }),
}));
import { wcaFunStatsRoutes } from '../src/routes/wca_fun_stats.js';

const url = process.env.WCA_COUNTRY_TEST_DATABASE_URL;
describe.skipIf(!url)('historical country buckets (PostgreSQL)', () => {
  const schema = `wca_country_${process.pid}_${Date.now()}`;
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    state.db = postgres(url!, { max: 1, connection: { search_path: schema }, onnotice: () => {} });
    await state.db.unsafe(readFileSync(new URL('../migrations/0028_wca_fun_stats.sql', import.meta.url), 'utf8'));
    await state.db.unsafe(readFileSync(new URL('../migrations/0304_wca_historical_countries.sql', import.meta.url), 'utf8'));
    await state.db.unsafe(`
      CREATE TABLE wca_persons (wca_id text PRIMARY KEY, name text, country_id text);
      CREATE TABLE wca_countries (id text PRIMARY KEY, iso2 text, name text, continent_id text);
      CREATE TABLE wca_competitions (id text PRIMARY KEY, name text, start_date date, end_date date);
      INSERT INTO wca_persons VALUES ('p', 'Transferred person', 'USA'), ('q', 'Hong Kong person', 'Hong Kong');
      INSERT INTO wca_countries VALUES ('China', 'CN', 'China', '_Asia'), ('Hong Kong', 'HK', 'Hong Kong', '_Asia'), ('USA', 'US', 'USA', '_North America');
      INSERT INTO wca_fs_medals VALUES ('p','China','__all__',10,2,1), ('p','Hong Kong','__all__',3,1,0), ('p','USA','__all__',1,0,0), ('q','Hong Kong','__all__',4,0,0);
      INSERT INTO wca_fs_person_comps VALUES ('p','China',10), ('p','Hong Kong',3), ('p','USA',1), ('q','Hong Kong',4);
      INSERT INTO wca_fs_person_solves VALUES ('p','China',100,120), ('p','Hong Kong',30,40), ('p','USA',10,15), ('q','Hong Kong',40,50);
      INSERT INTO wca_fs_person_year_solves VALUES ('p','China',2024,100,120), ('p','Hong Kong',2024,30,40), ('p','USA',2024,10,15), ('q','Hong Kong',2024,40,50);
      INSERT INTO wca_fs_placements VALUES ('p','China','__all__',2,10), ('p','Hong Kong','__all__',2,3), ('p','USA','__all__',2,1);
      INSERT INTO wca_fs_records_person VALUES ('p','China',1,0,0,10), ('p','Hong Kong',0,0,3,3), ('p','USA',0,0,1,1);
      INSERT INTO wca_competitions VALUES ('old','Old comp','2024-01-01','2024-01-01'), ('new','New comp','2025-01-01','2025-01-01');
      INSERT INTO wca_fs_person_comp_solves VALUES ('p','China','old',100,120), ('p','Hong Kong','new',30,40);
    `);
  });
  afterAll(async () => {
    await state.db?.end();
    if (admin) { await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });

  const get = async (route: string, scope: string) => {
    const response = await wcaFunStatsRoutes.request(`/wca/fun/${route}?scope=${scope}&year=2024`);
    expect(response.status).toBe(200);
    return response.json();
  };
  for (const [route, field, cn, hk, world] of [
    ['medals', 'gold', 10, 3, 14], ['most-comps-person', 'count', 10, 3, 14],
    ['most-solves-person', 'solve', 100, 30, 140], ['most-solves-person-year', 'solve', 100, 30, 140],
  ] as const) {
    it(`${route}: filters before aggregating and deduplicates persons across countries`, async () => {
      for (const [scope, value, total] of [['CN', cn, 1], ['HK', hk, 2], ['asia', cn + hk, 2], ['world', world, 2]] as const) {
        const result = await get(route, scope);
        expect(result.total).toBe(total);
        const p = result.rows.find((r: { wcaId: string }) => r.wcaId === 'p');
        expect(p[field]).toBe(value);
        if (scope === 'HK') expect(p.iso2).toBe('HK');
        if (scope === 'asia') expect(p.iso2).toBe('CN');
      }
    });
  }
  it('retains the historical flag on placements and continental record totals', async () => {
    const placements = await get('placements', 'HK');
    expect(placements.rows[0].count).toBe(3);
    expect(placements.rows[0].iso2).toBe('HK');
    const records = await get('records-person', 'asia');
    expect(records.rows[0].score).toBe(13);
    expect(records.rows[0].iso2).toBe('CN');
  });
  it('chooses the best single competition after filtering representation', async () => {
    const result = await get('most-solves-person-comp', 'HK');
    expect(result.total).toBe(1);
    expect(result.rows[0].solve).toBe(30);
    expect(result.rows[0].compId).toBe('new');
    expect(result.rows[0].iso2).toBe('HK');
  });
});
