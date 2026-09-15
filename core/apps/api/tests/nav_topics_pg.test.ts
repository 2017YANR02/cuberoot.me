import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let sql: ReturnType<typeof postgres>;
const schema = `nav_topics_test_${randomUUID().replaceAll('-', '')}`;
const placeholders = (statement: string) => { let index = 0; return statement.replace(/\?/g, () => `$${++index}`); };
vi.mock('../src/db/connection.js', () => ({
  query: (statement: string, values: never[] = []) => sql.unsafe(placeholders(statement), values),
  withTransaction: (work: (query: (statement: string, values?: never[]) => unknown) => Promise<unknown>) =>
    sql.begin(tx => work((statement, values = []) => tx.unsafe(placeholders(statement), values))),
}));
vi.mock('../src/utils/recon_helpers.js', () => ({ checkRateLimit: vi.fn(), requireAdminOrApiKey: vi.fn() }));
let app: Hono;
describe.skipIf(process.env.NAV_TOPICS_TEST_PG !== '1')('directory topics (PostgreSQL)', () => {
  beforeAll(async () => {
    sql = postgres({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'dev', database: 'cuberoot_db', max: 2, connection: { search_path: schema } });
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe('CREATE TABLE nav_sites (id INTEGER PRIMARY KEY, tags JSONB)');
    await sql.unsafe(await readFile(new URL('../migrations/0237_nav_topics.sql', import.meta.url), 'utf8'));
    const { navSitesRoutes } = await import('../src/routes/nav_sites.js');
    app = new Hono().route('/v1', navSitesRoutes);
  });
  afterAll(async () => {
    if (sql) {
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await sql.end();
    }
  });
  const mutate = (method: string, body: unknown) => app.request('/v1/nav/topics', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  it('persists unused topics, edits legacy tags on all sites, and deletes only the chosen association', async () => {
    await sql`INSERT INTO nav_sites VALUES (1, ${sql.json(['Timer 计时器', 'Tutorial 教程'])}), (2, ${sql.json(['Tutorial 教程'])}), (3, NULL)`;
    expect((await mutate('POST', { tag: 'Unused 未使用' })).status).toBe(200);
    expect(await (await app.request('/v1/nav/topics')).json()).toEqual(['Timer 计时器', 'Tutorial 教程', 'Unused 未使用']);
    expect((await mutate('PUT', { tag: 'Tutorial 教程', replacement: 'Guide 指南' })).status).toBe(200);
    expect(await sql`SELECT tags FROM nav_sites ORDER BY id`).toEqual([
      { tags: ['Timer 计时器', 'Guide 指南'] }, { tags: ['Guide 指南'] }, { tags: null },
    ]);
    expect((await mutate('DELETE', { tag: 'Guide 指南' })).status).toBe(200);
    expect(await sql`SELECT tags FROM nav_sites ORDER BY id`).toEqual([
      { tags: ['Timer 计时器'] }, { tags: null }, { tags: null },
    ]);
    expect(await (await app.request('/v1/nav/topics')).json()).toEqual(['Timer 计时器', 'Unused 未使用']);
  });
  it('rolls back associations when a catalog write fails', async () => {
    await sql.unsafe("ALTER TABLE nav_topics ADD CHECK (tag <> 'Rejected 拒绝')");
    expect((await mutate('PUT', { tag: 'Timer 计时器', replacement: 'Rejected 拒绝' })).status).toBe(500);
    expect(await sql`SELECT tags FROM nav_sites WHERE id = 1`).toEqual([{ tags: ['Timer 计时器'] }]);
  });
});
