import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let sql: ReturnType<typeof postgres>;
const schema = `sim_layout_test_${randomUUID().replaceAll('-', '')}`;
vi.mock('../src/db/connection.js', () => ({
  query: (statement: string, values: never[] = []) => {
    let index = 0;
    return sql.unsafe(statement.replace(/\?/g, () => `$${++index}`), values);
  },
}));
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: vi.fn(),
  requireAdminOrApiKey: (c: { req: { header: (name: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer test-admin') throw new HTTPException(403);
  },
}));
let app: Hono;
describe.skipIf(process.env.SIM_LAYOUT_TEST_PG !== '1')('stage layouts (PostgreSQL)', () => {
  beforeAll(async () => {
    sql = postgres({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'dev', database: 'cuberoot_db', max: 2, connection: { search_path: schema } });
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(await readFile(new URL('../migrations/0223_sim_mask_layouts.sql', import.meta.url), 'utf8'));
    const { simMasksRoutes } = await import('../src/routes/sim_masks.js');
    app = new Hono().route('/v1', simMasksRoutes);
  });
  afterAll(async () => {
    if (sql) {
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await sql.end();
    }
  });
  const put = (body: unknown, admin = true) => app.request('/v1/sim-masks/layout', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer test-admin' } : {}) }, body: JSON.stringify(body),
  });
  const groups = [{ group: 'Last Layer', items: ['Cross', 'OLL'] }, { group: 'CFOP', items: [] }];
  it('persists order, cross-group membership and empty groups independently per size', async () => {
    expect((await put({ cubeSize: 3, groups })).status).toBe(200);
    expect((await put({ cubeSize: 4, groups: [...groups].reverse() })).status).toBe(200);
    expect((await put({ cubeSize: 3, groups: [...groups].reverse() })).status).toBe(200);
    const response = await app.request('/v1/sim-masks/layout');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual([3, 4].map((cubeSize) => ({ cubeSize, groups: [...groups].reverse() })));
  });
  it('rejects unauthorized and malformed writes without changing persisted state', async () => {
    expect((await put({ cubeSize: 3, groups }, false)).status).toBe(403);
    for (const body of [null, {}, { cubeSize: 1, groups }, { cubeSize: '3', groups },
      { cubeSize: 3, groups: [] }, { cubeSize: 3, groups: [groups[0], groups[0]] },
      { cubeSize: 3, groups: [{ group: 'CFOP', items: ['OLL', 'OLL'] }] },
      { cubeSize: 3, groups: [{ group: 'CFOP', items: ['bad/key'] }] },
      { cubeSize: 3, groups: [null] }, { cubeSize: 3, groups: [{ group: 'CFOP', items: 'OLL' }] }]) {
      expect((await put(body)).status).toBe(400);
    }
    expect(await (await app.request('/v1/sim-masks/layout')).json()).toEqual([3, 4].map((cubeSize) => ({ cubeSize, groups: [...groups].reverse() })));
  });
});
