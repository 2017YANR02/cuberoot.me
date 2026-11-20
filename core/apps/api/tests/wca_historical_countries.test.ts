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
      INSERT INTO wca_persons VALUES ('a','Alpha','China'), ('b','Bravo','China'), ('c','Charlie','USA'), ('d','Delta','China');
      INSERT INTO wca_fs_medals VALUES ('a','China','333',9,1,0), ('b','China','333',1,7,2),
        ('c','USA','333',2,7,9), ('d','China','333',0,0,1),
        ('p','China','333',3,1,2), ('p','Hong Kong','333',1,0,3), ('p','USA','333',1,0,1);
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
  it.each([
    ['gold', ['a', 'p', 'c', 'b'], [9, 5, 2, 1], [1, 2, 3, 4]],
    ['silver', ['b', 'c', 'a', 'p'], [7, 7, 1, 1], [1, 1, 3, 3]],
    ['bronze', ['c', 'p', 'b', 'd'], [9, 6, 2, 1], [1, 2, 3, 4]],
  ] as const)('ranks %s independently, aggregates country buckets, and excludes zero counts', async (medal, ids, counts, ranks) => {
    const response = await wcaFunStatsRoutes.request(`/wca/fun/medals?type=event&event=333&medal=${medal}&v=2`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.medal).toBe(medal);
    expect(body.total).toBe(4);
    expect(body.rows.map((r: { wcaId: string }) => r.wcaId)).toEqual(ids);
    expect(body.rows.map((r: Record<string, number>) => r[medal])).toEqual(counts);
    expect(body.rows.map((r: { rank: number }) => r.rank)).toEqual(ranks);
  });
  it('retains tied medal ranks across page boundaries', async () => {
    for (const [page, id, rank] of [[1, 'b', 1], [2, 'c', 1], [3, 'a', 3], [4, 'p', 3]] as const) {
      const response = await wcaFunStatsRoutes.request(`/wca/fun/medals?type=event&event=333&medal=silver&size=1&page=${page}`);
      const body = await response.json();
      expect(body.rows).toHaveLength(1);
      expect(body.rows[0]).toMatchObject({ wcaId: id, rank });
      expect(body.total).toBe(4);
    }
  });
  it('filters historical representation before ranking selected medals', async () => {
    for (const [region, bronze, iso2] of [['CN', 2, 'CN'], ['asia', 5, 'CN'], ['US', 1, 'US']] as const) {
      const response = await wcaFunStatsRoutes.request(`/wca/fun/medals?type=event&event=333&medal=bronze&region=${region}`);
      const body = await response.json();
      expect(body.rows.find((r: { wcaId: string }) => r.wcaId === 'p')).toMatchObject({ bronze, iso2 });
      if (region === 'CN') expect(body.rows.map((r: { rank: number }) => r.rank)).toEqual([1, 1, 3]);
    }
  });
  it('applies the GAN roster union before ranking medals and counting pages', async () => {
    await state.db!.unsafe(`CREATE TABLE wca_teams(id integer PRIMARY KEY, name text);
      CREATE TABLE wca_person_teams(wca_id text, team_id integer);
      INSERT INTO wca_teams VALUES (33, 'GAN GURUS'), (90, '宇宙爆速社-领航队'), (251, 'SpeedAce');
      INSERT INTO wca_person_teams VALUES ('a', 33), ('a', 90), ('b', 90), ('c', 251);`);
    const response = await wcaFunStatsRoutes.request('/wca/fun/medals?type=event&event=333&medal=gold&team=gan&size=1');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body.team).toBe('gan');
    expect(body.total).toBe(2);
    expect(body.rows[0]).toMatchObject({ wcaId: 'a', gold: 9, rank: 1 });
  });
  it('rejects unknown medal columns before querying', async () => {
    const response = await wcaFunStatsRoutes.request('/wca/fun/medals?medal=gold%20DESC');
    expect(response.status).toBe(400);
  });
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
