import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool, closePool } from '../src/core/database.js';
import { CompetitionStreaks } from '../src/statistics/competition_streaks.js';

// Opt-in SQL integration: temporary tables shadow the dump only on this connection.
// WCA_STATS_SQL_TEST=1 pnpm --filter @cuberoot/stats-build exec vitest run tests/competition_streaks.test.ts
describe.skipIf(process.env.WCA_STATS_SQL_TEST !== '1').each([false, true])('competition streak SQL (cross-city only: %s)', (crossCityOnly) => {
  let connection: PoolConnection;
  let resultId = 0;
  const people = new Set<string>();
  const stat = new CompetitionStreaks();

  beforeAll(async () => {
    connection = await getPool().getConnection();
    await connection.query('CREATE TEMPORARY TABLE results (id INT, person_id VARCHAR(32), competition_id VARCHAR(32))');
    await connection.query('CREATE TEMPORARY TABLE result_attempts (result_id INT, value INT)');
    await connection.query('CREATE TEMPORARY TABLE competitions (id VARCHAR(32), cell_name VARCHAR(80), country_id VARCHAR(50), city_name VARCHAR(80), start_date DATE, end_date DATE)');
    await connection.query('CREATE TEMPORARY TABLE persons (wca_id VARCHAR(32), name VARCHAR(80), sub_id INT)');
  });

  afterAll(async () => {
    if (connection) {
      for (const table of ['results', 'result_attempts', 'competitions', 'persons']) {
        await connection.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);
      }
      connection.release();
    }
    await closePool();
  });

  async function visit(person: string, id: string, city: string, start: number, end = start, attempts = [1000], country = 'China') {
    if (!people.has(person)) {
      await connection.execute('INSERT INTO persons VALUES (?, ?, 1)', [person, person]);
      people.add(person);
    }
    await connection.execute('INSERT INTO competitions VALUES (?, ?, ?, ?, ?, ?)', [id, id, country, city, `2026-05-${String(start).padStart(2, '0')}`, `2026-05-${String(end).padStart(2, '0')}`]);
    const idOfResult = ++resultId;
    await connection.execute('INSERT INTO results VALUES (?, ?, ?)', [idOfResult, person, id]);
    for (const value of attempts) await connection.execute('INSERT INTO result_attempts VALUES (?, ?)', [idOfResult, value]);
  }

  async function streaks(person: string) {
    const [rows] = await connection.query<RowDataPacket[]>(stat.query(crossCityOnly));
    return stat.transform(rows.filter(row => row.person_id === person));
  }

  it('includes DNF and deduplicates attempts and rounds into one complete three-competition streak', async () => {
    await visit('dnf', 'a', 'A', 1, 1, [-1, -2]);
    await visit('dnf', 'b', 'B', 2, 2, [1000, 1100]);
    await visit('dnf', 'c', 'C', 3);
    await connection.query("INSERT INTO results VALUES (900, 'dnf', 'b')");
    await connection.query('INSERT INTO result_attempts VALUES (900, -1)');
    const rows = await streaks('dnf');
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe(3);
  });

  it('does not bridge a day covered only by DNS, zero or no attempts', async () => {
    await visit('dns', 'd', 'A', 1);
    await visit('dns', 'e', 'B', 2, 2, [-2, 0]);
    await visit('dns', 'f', 'C', 2, 2, []);
    await visit('dns', 'g', 'D', 3);
    expect(await streaks('dns')).toEqual([]);
  });

  it('uses full multi-day ranges across month boundaries and marks overlap', async () => {
    await visit('overlap', 'h', 'A', 1, 3);
    await visit('overlap', 'i', 'B', 3, 4);
    await visit('overlap', 'j', 'C', 5);
    await connection.query("UPDATE competitions SET start_date = '2026-04-29' WHERE id = 'h'");
    const rows = await streaks('overlap');
    expect(rows[0][0]).toBe(3);
    expect(rows[0].slice(3, 5)).toEqual(['2026-04-29', '2026-05-05']);
    expect(rows[0][5]).toMatchObject({ _type: 'competition-itinerary', competitions: [
      { id: 'h', startDate: '2026-04-29', endDate: '2026-05-03' },
      { id: 'i', startDate: '2026-05-03', endDate: '2026-05-04' },
      { id: 'j', startDate: '2026-05-05', endDate: '2026-05-05' },
    ] });
    expect(rows[0][6]).toBe('Overlapping schedules');
  });

  it('joins same-city visits only when the cross-city requirement is off', async () => {
    await visit('same', 'k', ' A  Town ', 1);
    await visit('same', 'l', 'a town', 2);
    await visit('same', 'm', 'B', 3);
    const rows = await streaks('same');
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe(crossCityOnly ? 2 : 3);
    expect(rows[0][3]).toBe(crossCityOnly ? '2026-05-02' : '2026-05-01');
    expect(rows[0][6]).toBe('Non-overlapping schedules');
  });

  it('includes a wholly same-city streak only without the cross-city requirement', async () => {
    await visit('local', 'local-a', 'A', 1);
    await visit('local', 'local-b', 'A', 2);
    const rows = await streaks('local');
    if (crossCityOnly) expect(rows).toEqual([]);
    else expect(rows[0][0]).toBe(2);
  });

  it('does not use an earlier long event to bridge a gap after the immediately previous event', async () => {
    await visit('nested', 'n', 'A', 1, 10);
    await visit('nested', 'o', 'B', 2);
    await visit('nested', 'p', 'C', 4);
    const rows = await streaks('nested');
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe(2);
    expect(rows[0][4]).toBe('2026-05-10');
  });

  it('breaks unknown cities and distinguishes same-named cities in different countries', async () => {
    await visit('unknown', 'q', 'A', 1);
    await visit('unknown', 'r', '', 2);
    await visit('unknown', 's', 'B', 3);
    const unknown = await streaks('unknown');
    if (crossCityOnly) expect(unknown).toEqual([]);
    else expect(unknown[0][0]).toBe(3);
    await visit('country', 't', 'Victoria', 1, 1, [100], 'Canada');
    await visit('country', 'u', 'Victoria', 2, 2, [100], 'Seychelles');
    expect((await streaks('country'))[0][0]).toBe(2);
  });
});
