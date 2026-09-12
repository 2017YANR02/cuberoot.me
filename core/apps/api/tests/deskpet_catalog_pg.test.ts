import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let sql: ReturnType<typeof postgres>;
const schema = `deskpet_test_${randomUUID().replaceAll('-', '')}`;
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
describe.skipIf(process.env.DESKPET_TEST_PG !== '1')('pet catalog (PostgreSQL)', () => {
beforeAll(async () => {
  sql = postgres({ host: '127.0.0.1', port: Number(process.env.DESKPET_TEST_PORT ?? 5433), user: 'postgres', password: 'dev', database: process.env.DESKPET_TEST_DB ?? 'cuberoot_db', max: 2, connection: { search_path: schema } });
  await sql.unsafe(`CREATE SCHEMA "${schema}"`);
  await sql.unsafe(await readFile(new URL('../migrations/0235_deskpet_catalog.sql', import.meta.url), 'utf8'));
  const { navSitesRoutes } = await import('../src/routes/nav_sites.js');
  app = new Hono().route('/v1', navSitesRoutes);
});
afterAll(async () => {
  if (sql) {
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  }
});
const put = (body: unknown, admin = true) => app.request('/v1/nav/deskpet-catalog', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer test-admin' } : {}) }, body: JSON.stringify(body),
});
it('persists edits, reorder, removal and restore; rejects stale concurrent writes', async () => {
  const entries = [{ id: 'future-pet', locked: true, removed: false }, { id: 'calico', locked: false, removed: false, label: { en: 'Kitty', zh: '猫猫' } }];
  const initial = await app.request('/v1/nav/deskpet-catalog');
  expect(initial.headers.get('Cache-Control')).toBe('no-store');
  expect(await initial.json()).toEqual({ revision: 0, entries: [] });
  const created = await put({ revision: 0, entries });
  expect(created.status).toBe(200);
  expect(await created.json()).toEqual({ revision: 1, entries });
  expect((await put({ revision: 0, entries: [] })).status).toBe(409);
  entries.reverse();
  entries[0].removed = true;
  entries[0].locked = true;
  expect((await put({ revision: 1, entries })).status).toBe(200);
  expect(await (await app.request('/v1/nav/deskpet-catalog')).json()).toEqual({ revision: 2, entries });
  entries[0].removed = false;
  expect((await put({ revision: 2, entries })).status).toBe(200);
});
it('rejects unauthorized writes and invalid catalogs without modifying saved state', async () => {
  expect((await put({ revision: 3, entries: [] }, false)).status).toBe(403);
  for (const body of [null, {}, { revision: 3, entries: [{ id: 'bad', locked: 'false', removed: false }] }]) {
    expect((await put(body)).status).toBe(400);
  }
  expect((await (await app.request('/v1/nav/deskpet-catalog')).json()).revision).toBe(3);
});
});
