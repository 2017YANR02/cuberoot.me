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
  VALID_EVENTS: new Set(['333', 'clock', 'magic']), ACTIVE_EVENTS: ['333', 'clock'],
  MAX_SIZE: 100, DEFAULT_SIZE: 20, CACHE_HEADER: 'public, max-age=3600',
  resolveCountryFull: async (s: string) => {
    const id = ({ CN: 'China', US: 'USA' } as Record<string, string>)[s];
    return id ? { id } : null;
  },
}));
import { wcaFunStatsRoutes } from '../src/routes/wca_fun_stats.js';

const url = process.env.WCA_COUNTRY_TEST_DATABASE_URL;
describe.skipIf(!url)('annual event ranking (PostgreSQL)', () => {
  const schema = `wca_annual_${process.pid}_${Date.now()}`;
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    state.db = postgres(url!, { max: 1, connection: { search_path: schema }, onnotice: () => {} });
    const migration = readFileSync(new URL('../migrations/0324_wca_annual_participation.sql', import.meta.url), 'utf8');
    await state.db.unsafe(migration);
    await state.db.unsafe(migration); // Safe when the builder already created the table.
    await state.db.unsafe(`
      CREATE TABLE wca_persons (wca_id text PRIMARY KEY, name text, country_id text);
      CREATE TABLE wca_countries (id text PRIMARY KEY, iso2 text, continent_id text);
      CREATE TABLE meta_historical (key text PRIMARY KEY, value text);
      INSERT INTO meta_historical VALUES ('wca_annual_participation_imported_at','2026-11-12T00:00:00Z');
      INSERT INTO wca_persons VALUES ('p','Transferred','USA'), ('q','More rounds','China'), ('r','Tied rounds','China'), ('d','Only DNF','China');
      INSERT INTO wca_countries VALUES ('China','CN','_Asia'), ('USA','US','_North America');
      INSERT INTO wca_fs_person_event_year_solves VALUES
        ('p','China','clock',2026,9,10,2), ('p','USA','clock',2026,5,5,1),
        ('p','China','333',2026,25,25,5), ('p','China','clock',2025,50,50,10),
        ('q','China','clock',2026,6,12,3), ('r','China','clock',2026,4,4,3),
        ('d','China','clock',2026,0,1,1), ('p','China','magic',2012,2,2,1);
    `);
  });
  afterAll(async () => {
    await state.db?.end();
    if (admin) { await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });
  const get = async (params = '', path = '') => {
    const response = await wcaFunStatsRoutes.request(`/wca/fun/most-solves-person-year${path}?v=3&${params}`);
    expect(response.status).toBe(200);
    return response.json();
  };
  it('filters event, start year and historical country before ranking', async () => {
    const data = await get('scope=CN&event=clock&year=2026');
    expect(data.total).toBe(4);
    expect(data.rows[0]).toMatchObject({ wcaId: 'p', iso2: 'CN', solve: 9, attempt: 10, rounds: 2 });
    expect(data.rows[3]).toMatchObject({ wcaId: 'd', solve: 0, attempt: 1, rounds: 1 });
    expect((await get('scope=US&event=clock&year=2026')).rows[0].solve).toBe(5);
    expect((await get('scope=asia&event=clock&year=2026')).rows[0].solve).toBe(9);
    expect((await get('event=clock&year=2026')).rows[0].solve).toBe(14);
    expect((await get('scope=CN&event=clock&year=2025')).rows[0].solve).toBe(50);
  });
  it('ranks ties before pagination and switches all three metrics', async () => {
    const rounds = await get('scope=CN&event=clock&year=2026&sort=rounds&size=1&page=2');
    expect(rounds.total).toBe(4);
    expect(rounds.rows[0]).toMatchObject({ wcaId: 'r', rank: 1 });
    const next = await get('scope=CN&event=clock&year=2026&sort=rounds&size=1&page=3');
    expect(next.rows[0]).toMatchObject({ wcaId: 'p', rank: 3 });
    expect((await get('scope=CN&event=clock&year=2026&sort=attempt')).rows[0].wcaId).toBe('q');
    expect((await get('scope=CN&event=clock&year=2026&sort=solve')).rows[0].wcaId).toBe('p');
  });
  it('supports all events, retired events, latest year and empty results', async () => {
    expect((await get('scope=CN&year=2026')).rows[0]).toMatchObject({ solve: 34, attempt: 35, rounds: 7 });
    expect((await get('scope=CN&event=magic')).year).toBe(2012);
    expect((await get('scope=US&event=magic')).rows).toEqual([]);
    expect((await get('scope=CN&event=clock&year=2024')).rows).toEqual([]);
    const metadata = await get('scope=CN', '/years');
    expect(metadata.years).toEqual([2026, 2025, 2012]);
    expect(metadata.events).toContain('magic');
    expect((await get('scope=US', '/years')).years).toEqual([2026]);
  });
  it('rejects invalid inputs without interpolating arbitrary sort SQL', async () => {
    for (const params of ['sort=other', 'event=other', 'year=2026oops', 'scope=other']) {
      expect((await wcaFunStatsRoutes.request(`/wca/fun/most-solves-person-year?v=3&${params}`)).status).toBe(400);
    }
  });
  it('distinguishes a missing import from a legitimate empty selection', async () => {
    await state.db!.unsafe('DELETE FROM meta_historical');
    for (const suffix of ['', '/years']) {
      const response = await wcaFunStatsRoutes.request(`/wca/fun/most-solves-person-year${suffix}?v=3`);
      expect(response.status).toBe(503);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toMatchObject({ code: 'STATS_NOT_READY' });
    }
  });
});
