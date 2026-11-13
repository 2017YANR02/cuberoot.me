import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof postgres> }));
vi.mock('../src/db/connection.js', () => {
  const runner = (db: { unsafe: Function }) => (text: string, params: unknown[] = []) => {
    let n = 0;
    return db.unsafe(text.replace(/\?/g, () => `$${++n}`), params);
  };
  return {
    query: (text: string, params?: unknown[]) => runner(mocks.db)(text, params),
    withTransaction: (run: Function) => mocks.db.begin(tx => run(runner(tx))),
  };
});
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdminOrApiKey: async () => {} }));
import { wcaTeamRoutes } from '../src/routes/wca_teams.js';

// Opt-in, isolated local schema. Never use the app's runtime DB settings.
const databaseUrl = process.env.WCA_TEAMS_PG_TEST_URL;
const schema = 'test_wca_teams_' + randomUUID().replaceAll('-', '');
const migration = (name: string) => readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8');
const call = (path: string, names?: string[]) => wcaTeamRoutes.request('/wca/teams' + path, names === undefined ? undefined : {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names }),
});

describe.skipIf(!databaseUrl)('multiple WCA teams against PostgreSQL', () => {
  beforeAll(async () => {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(databaseUrl!).hostname)) throw new Error('Local PostgreSQL required');
    mocks.db = postgres(databaseUrl!, { max: 4, onnotice: () => {}, connection: { search_path: schema } });
    await mocks.db.unsafe(`CREATE SCHEMA ${schema}`);
    await mocks.db.unsafe(`CREATE TABLE wca_persons(wca_id VARCHAR(10) PRIMARY KEY, name TEXT, country_id TEXT);
      CREATE TABLE wca_countries(id TEXT PRIMARY KEY, iso2 TEXT);
      CREATE TABLE wca_person_ranks(wca_id TEXT, is_avg BOOLEAN, ranks_world INTEGER[]);
      CREATE TABLE wca_person_results(wca_id TEXT, event_id TEXT, average INTEGER, best INTEGER, comp_id TEXT, round_type_id TEXT, pos INTEGER);
      INSERT INTO wca_persons VALUES ('2019WANY36', 'Yiheng Wang', 'China'), ('2023GENG02', 'Xuanyi Geng', 'China');
      INSERT INTO wca_countries VALUES ('China', 'CN');
      INSERT INTO wca_person_results VALUES ('2019WANY36', '333', 351, 277, 'A', 'f', 1), ('2023GENG02', '333', 367, 251, 'A', 'f', 2);`);
    await mocks.db.unsafe(await migration('0268_wca_teams'));
    await mocks.db.unsafe(await migration('0305_wca_team_members_without_wca'));
    await mocks.db.unsafe(`INSERT INTO wca_person_teams(wca_id, team_id) VALUES ('2019WANY36', 2), ('2023GENG02', 1);
      INSERT INTO wca_person_teams(name, team_id) VALUES ('Same Name', 1), ('Same Name', 1);`);
    const before = await mocks.db`SELECT * FROM wca_person_teams ORDER BY member_id`;
    await mocks.db.unsafe(await migration('0328_wca_multiple_teams'));
    expect(await mocks.db`SELECT * FROM wca_person_teams ORDER BY member_id`).toEqual(before);
  });
  afterAll(async () => {
    if (mocks.db) {
      await mocks.db.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await mocks.db.end();
    }
  });

  it('adds a retailer while retaining the old member ID and makes repeated saves idempotent', async () => {
    const [before] = await mocks.db`SELECT * FROM wca_person_teams WHERE wca_id = '2019WANY36'`;
    const response = await call('/2019WANY36', ['魔域', 'Cubicle']);
    expect(response.status).toBe(200);
    const first = await response.json();
    expect(first.teams.map((team: { name: string }) => team.name)).toEqual(['魔域', 'Cubicle']);
    const memberships = await mocks.db`SELECT * FROM wca_person_teams WHERE wca_id = '2019WANY36' ORDER BY team_id`;
    expect(memberships).toHaveLength(2);
    expect(memberships[0]).toEqual(before);
    expect((await call('/2019WANY36', ['  Cubicle ', '魔域', 'Cubicle'])).status).toBe(200);
    expect(await mocks.db`SELECT * FROM wca_person_teams WHERE wca_id = '2019WANY36' ORDER BY team_id`).toEqual(memberships);
  });

  it('deduplicates directory people before pagination and counts, with every affiliation visible in either filter', async () => {
    const [cubicle] = await mocks.db`SELECT id FROM wca_teams WHERE name = 'Cubicle'`;
    const all = await (await call('?directory=1&size=1')).json();
    expect(all.total).toBe(4); // Two WCA people plus two distinct non-WCA members with the same name.
    expect(all.members).toHaveLength(1);
    expect(all.members[0].wcaId).toBe('2019WANY36');
    expect(all.members[0].teams.map((team: { name: string }) => team.name)).toEqual(['魔域', 'Cubicle']);
    const second = await (await call('?directory=1&size=1&page=2')).json();
    expect(second.members[0].wcaId).toBe('2023GENG02');
    for (const filter of ['2', String(cubicle.id), 'moyu']) {
      const data = await (await call('?directory=1&team=' + filter)).json();
      expect(data.total).toBe(1);
      expect(data.members[0].teams).toEqual(all.members[0].teams);
    }
    const search = await (await call('?directory=1&q=Same')).json();
    expect(search.total).toBe(2);
    expect(new Set(search.members.map((member: { memberId: number }) => member.memberId)).size).toBe(2);
    const lookup = await (await call('?persons=2019WANY36')).json();
    expect(lookup.assignments).toHaveLength(2);
    expect(all.teams.find((team: { name: string }) => team.name === 'Cubicle').count).toBe(1);
  });

  it('removes only the deselected team and leaves other people untouched', async () => {
    const before = await mocks.db`SELECT * FROM wca_person_teams WHERE wca_id IS DISTINCT FROM '2019WANY36' ORDER BY member_id`;
    expect((await call('/2019WANY36', ['魔域'])).status).toBe(200);
    const person = await (await call('?persons=2019WANY36')).json();
    expect(person.assignments).toEqual([{ wcaId: '2019WANY36', teamId: 2 }]);
    expect((await call('/2019WANY36', [])).status).toBe(200);
    expect((await (await call('?persons=2019WANY36')).json()).assignments).toEqual([]);
    expect(await mocks.db`SELECT * FROM wca_person_teams WHERE wca_id IS DISTINCT FROM '2019WANY36' ORDER BY member_id`).toEqual(before);
  });

  it('serializes concurrent saves without leaving a mix of two edits', async () => {
    const results = await Promise.all([call('/2019WANY36', ['GAN', 'Cubicle']), call('/2019WANY36', ['魔域'])]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    const rows = await mocks.db`SELECT t.name FROM wca_person_teams a JOIN wca_teams t ON t.id = a.team_id WHERE a.wca_id = '2019WANY36' ORDER BY t.name`;
    expect([['魔域'], ['Cubicle', 'GAN']]).toContainEqual(rows.map(row => row.name));
  });

  it('imports the verified Cubicle roster additively and can be replayed without changing member IDs', async () => {
    await mocks.db`INSERT INTO wca_persons VALUES ('2023GUOK01', 'Kaixi Guo', 'China')`;
    const [gan] = await mocks.db`INSERT INTO wca_teams(name) VALUES ('GAN GURUS') RETURNING id`;
    await mocks.db`INSERT INTO wca_person_teams(wca_id, team_id) VALUES ('2023GUOK01', ${gan.id})`;
    const before = await mocks.db`SELECT * FROM wca_person_teams ORDER BY member_id`;
    await mocks.db.unsafe(await migration('0329_cubicle_roster'));
    const first = await mocks.db`SELECT * FROM wca_person_teams ORDER BY member_id`;
    for (const member of before) expect(first.find(row => row.member_id === member.member_id)).toEqual(member);
    const directory = await (await call('?directory=1')).json();
    const cubicle = directory.teams.find((team: { name: string }) => team.name === 'Cubicle');
    expect(cubicle.count).toBe(14);
    expect((await (await call('?directory=1&team=' + cubicle.id)).json()).total).toBe(14);
    const guo = await (await call('?directory=1&q=2023GUOK01')).json();
    expect(guo.total).toBe(1);
    expect(guo.members[0].teams.map((team: { name: string }) => team.name).sort()).toEqual(['Cubicle', 'GAN GURUS']);
    await mocks.db.unsafe(await migration('0329_cubicle_roster'));
    expect(await mocks.db`SELECT * FROM wca_person_teams ORDER BY member_id`).toEqual(first);
  });
});
