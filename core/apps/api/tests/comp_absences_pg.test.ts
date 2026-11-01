import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let sql: ReturnType<typeof postgres>;
const schema = `comp_absences_test_${randomUUID().replaceAll('-', '')}`;
vi.mock('../src/db/connection.js', () => ({
  get sql() { return sql; },
  query: (statement: string, values: never[] = []) => {
    let index = 0;
    return sql.unsafe(statement.replace(/\?/g, () => `$${++index}`), values);
  },
}));

// A dedicated local PG URL opts into real migration/persistence and auth checks.
describe.skipIf(!process.env.COMP_ABSENCES_TEST_PG_URL)('competition absences (PostgreSQL)', () => {
  let app: Hono;
  let admin: Record<string, string>;
  let member: Record<string, string>;
  const path = '/v1/comp/JiangmenOpen2026/absences';
  const read = async (url = path) => (await app.request(url)).json();
  const write = (method: string, id: string, headers = admin, compPath = path) =>
    app.request(`${compPath}/${id}`, { method, headers });

  beforeAll(async () => {
    vi.stubEnv('ADMIN_API_KEY', 'comp-absence-test-key');
    sql = postgres(process.env.COMP_ABSENCES_TEST_PG_URL!, { max: 2, connection: { search_path: schema } });
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(`CREATE TABLE app_users (
      id BIGINT PRIMARY KEY, display_name TEXT, avatar_url TEXT, avatar_source TEXT,
      avatar_preset TEXT, wca_id TEXT, is_admin BOOLEAN, merged_into_user_id BIGINT
    )`);
    await sql`INSERT INTO app_users (id, display_name, is_admin) VALUES (1, 'Admin', TRUE), (2, 'Member', FALSE)`;
    await sql.unsafe(await readFile(new URL('../migrations/0302_comp_absences.sql', import.meta.url), 'utf8'));
    const { JWT_SECRET } = await import('../src/utils/session.js');
    admin = { Authorization: `Bearer ${jwt.sign({ uid: 1 }, JWT_SECRET)}` };
    member = { Authorization: `Bearer ${jwt.sign({ uid: 2 }, JWT_SECRET)}` };
    const { compAbsencesRoutes } = await import('../src/routes/comp_absences.js');
    app = new Hono().route('/v1', compAbsencesRoutes);
    app.onError((error, c) => c.json({ error: error.message },
      error.message === 'Authentication required' ? 401 : error.message === 'Admin access required' ? 403 : 500));
  });
  afterAll(async () => {
    if (sql) {
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await sql.end();
    }
    vi.unstubAllEnvs();
  });

  it('publishes exactly the confirmed initial absences without caching or editor information', async () => {
    const response = await app.request(path);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ wcaIds: ['2019JIAN54', '2023DONG20'] });
    expect(await read('/v1/comp/NingboOpen2026/absences')).toEqual({ wcaIds: [] });
  });

  it('rejects anonymous and non-admin removal and restoration without changing records', async () => {
    for (const method of ['PUT', 'DELETE']) {
      expect((await write(method, '2019JIAN54', {})).status).toBe(401);
      expect((await write(method, '2019JIAN54', member)).status).toBe(403);
      expect((await write(method, '2019JIAN54', { 'X-Admin-Key': 'wrong' })).status).toBe(401);
    }
    expect(await read()).toEqual({ wcaIds: ['2019JIAN54', '2023DONG20'] });
  });

  it('persists idempotent, competition-scoped changes and supports restoration', async () => {
    const other = '/v1/comp/NingboOpen2026/absences';
    expect((await write('PUT', '2019JIAN54', admin, other)).status).toBe(200);
    expect((await write('DELETE', '2019JIAN54')).status).toBe(200);
    expect(await read()).toEqual({ wcaIds: ['2023DONG20'] });
    expect(await read(other)).toEqual({ wcaIds: ['2019JIAN54'] });
    for (let i = 0; i < 2; i++) {
      expect((await write('PUT', '2019jian54', admin, '/v1/comp/jiangmen-open2026/absences')).status).toBe(200);
    }
    expect(await read()).toEqual({ wcaIds: ['2019JIAN54', '2023DONG20'] });
    expect(await sql`SELECT active, updated_by::int, updated_via FROM comp_absences
      WHERE comp_id = 'jiangmenopen2026' AND wca_id = '2019JIAN54'`).toEqual([
      { active: true, updated_by: 1, updated_via: 'admin' },
    ]);
    expect((await write('DELETE', '2019JIAN54', { 'X-Admin-Key': 'comp-absence-test-key' }, other)).status).toBe(200);
    expect(await read(other)).toEqual({ wcaIds: [] });
  });

  it('rejects invalid IDs without changing the public corrections', async () => {
    expect((await app.request('/v1/comp/%20/absences')).status).toBe(400);
    expect((await write('PUT', 'invalid')).status).toBe(400);
    expect((await write('DELETE', '2019JIAN54', admin, '/v1/comp/%20/absences')).status).toBe(400);
    expect(await read()).toEqual({ wcaIds: ['2019JIAN54', '2023DONG20'] });
  });

  it('retains public attendance corrections when the editor account is deleted', async () => {
    await sql`DELETE FROM app_users WHERE id = 1`;
    expect(await read()).toEqual({ wcaIds: ['2019JIAN54', '2023DONG20'] });
    expect(await sql`SELECT updated_by FROM comp_absences WHERE comp_id = 'jiangmenopen2026' AND wca_id = '2019JIAN54'`)
      .toEqual([{ updated_by: null }]);
  });
});
