import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let sql: ReturnType<typeof postgres>;
const schema = `home_locks_test_${randomUUID().replaceAll('-', '')}`;
vi.mock('../src/db/connection.js', () => ({
  query: (statement: string, values: never[] = []) => {
    let index = 0;
    return sql.unsafe(statement.replace(/\?/g, () => `$${++index}`), values);
  },
  withTransaction: vi.fn(),
}));
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: vi.fn(),
  requireAdminOrApiKey: (c: { req: { header: (name: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer test-admin') throw new HTTPException(403);
  },
}));
let app: Hono;
describe.skipIf(process.env.HOME_LOCKS_TEST_PG !== '1')('homepage locks (PostgreSQL)', () => {
beforeAll(async () => {
  sql = postgres({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'dev', database: 'cuberoot_db', max: 2, connection: { search_path: schema } });
  await sql.unsafe(`CREATE SCHEMA "${schema}"`);
  await sql.unsafe(await readFile(new URL('../migrations/0221_home_card_locks.sql', import.meta.url), 'utf8'));
  const { navSitesRoutes } = await import('../src/routes/nav_sites.js');
  app = new Hono().route('/v1', navSitesRoutes);
});
afterAll(async () => {
  if (sql) {
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  }
});
const put = (body: unknown, admin = true) => app.request('/v1/nav/home-locks', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer test-admin' } : {}) }, body: JSON.stringify(body),
});
it('persists lock and explicit unlock and exposes uncached public state', async () => {
  expect((await put({ id: 'platform', locked: true })).status).toBe(200);
  let response = await app.request('/v1/nav/home-locks');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ locks: { platform: true } });
  expect((await put({ id: 'platform', locked: false })).status).toBe(200);
  response = await app.request('/v1/nav/home-locks');
  expect(await response.json()).toEqual({ locks: { platform: false } });
});
it('rejects non-admin writes and malformed or unknown inputs without changing state', async () => {
  expect((await put({ id: 'platform', locked: true }, false)).status).toBe(403);
  for (const body of [null, {}, { id: 'unknown', locked: true }, { id: 'platform', locked: 'false' }, { id: 'platform', locked: 1 }]) {
    expect((await put(body)).status).toBe(400);
  }
  expect(await (await app.request('/v1/nav/home-locks')).json()).toEqual({ locks: { platform: false } });
});
});
