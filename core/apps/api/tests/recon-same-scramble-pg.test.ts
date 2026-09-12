import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSameScrambleQuery } from '../src/utils/recon_helpers';

describe.skipIf(process.env.RECON_RELATED_TEST_PORT == null)('same scramble associations (PostgreSQL)', () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(async () => {
    sql = postgres({ host: '127.0.0.1', port: Number(process.env.RECON_RELATED_TEST_PORT), user: 'postgres', database: 'postgres', max: 1 });
    await sql`CREATE TEMP TABLE recons (
      id integer, visibility text, optimal_scramble text, wca_scramble text, scramble text, raw_time real
    )`;
    await sql`INSERT INTO recons VALUES
      (1, 'public', 'F2 U2', 'R U R''', NULL, 10),
      (2, 'public', NULL, E'\n R  U R'' \t', NULL, 11),
      (3, 'public', NULL, NULL, 'F2 U2', 9),
      (4, 'private', 'F2 U2', NULL, NULL, 5),
      (5, 'unlisted', NULL, 'R U R''', NULL, 6),
      (6, 'public', NULL, NULL, 'r U R''', 8),
      (7, 'public', '?', NULL, NULL, NULL),
      (8, 'public', NULL, '?', NULL, NULL),
      (9, 'public', '', E' \n\t', NULL, NULL),
      (10, 'public', 'F2 U2', 'R U R''', NULL, 12)`;
  });
  afterAll(async () => { if (sql) await sql.end(); });

  async function ids(id: number) {
    const query = buildSameScrambleQuery(String(id), 'recons.id');
    let n = 0;
    const rows = await sql.unsafe(query.sql.replace(/\?/g, () => `$${++n}`), query.params as never[]);
    return rows.map(row => row.id);
  }

  it('cross-matches all stored forms, normalizes whitespace and returns each related solve once', async () => {
    expect(await ids(1)).toEqual([3, 2, 10]);
    expect(await ids(2)).toEqual([1, 10]);
    expect(await ids(3)).toEqual([1, 10]);
  });
  it('preserves move case and excludes empty or placeholder scrambles', async () => {
    for (const id of [6, 7, 8, 9, 999]) expect(await ids(id)).toEqual([]);
  });
  it('does not expose relations through private or unlisted targets', async () => {
    expect(await ids(4)).toEqual([]);
    expect(await ids(5)).toEqual([]);
  });
});
