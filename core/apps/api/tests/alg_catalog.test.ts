import { beforeEach, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({ query: vi.fn(), invalidate: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({
  query: mocks.query, withTransaction: (run: (q: typeof mocks.query) => unknown) => run(mocks.query),
}));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdminOrApiKey: vi.fn(), checkRateLimit: vi.fn() }));
vi.mock('../src/utils/alg_mirror.js', () => ({ syncMirrorAndLog: vi.fn(), syncMirrorForCase: vi.fn() }));
vi.mock('../src/utils/recon_revalidate.js', () => ({ revalidateContentPages: mocks.invalidate }));
import { algSetsRoutes } from '../src/routes/alg_sets';
import { publicContentCache } from '../src/utils/public_content_cache';

let revision = '1';
let caseName = 'original';
const first = () => ({
  catalog_slug: 'oll', case_count: '57', id: '12', puzzle: '3x3', set_slug: 'oll',
  name: caseName, subgroup: '', setup: "R U R'", standard: null,
  sticker: { kind: 'oll' }, algs: [[{ alg: "R U' R'" }]],
  number: null, ori_names: null, trainer_key: null, meta: null, mirror_case_id: null,
});
beforeEach(() => {
  revision = '1'; caseName = 'original'; vi.clearAllMocks();
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('public_content_revisions')) return [{ revision }];
    if (sql.includes('catalog_slug')) return [first(), { catalog_slug: 'empty', case_count: '0', id: null }];
    if (sql.includes('SELECT item_key')) return [{ item_key: 'cross' }, { item_key: 'oll' }];
    return [];
  });
});
function app() {
  const app = new Hono();
  app.use('/v1/*', publicContentCache());
  app.route('/v1', algSetsRoutes);
  return app;
}
const path = '/v1/alg/sets/3x3/catalog?v=1';
it('returns only a cover per set plus counts and virtual-card ordering', async () => {
  const response = await app().request(path);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.order).toEqual(['cross', 'oll']);
  expect(data.sets).toHaveLength(2);
  expect(data.sets[0]).toMatchObject({ slug: 'oll', count: 57, first: { id: 12, name: 'original' } });
  expect(data.sets[0]).not.toHaveProperty('cases');
  expect(data.sets[1]).toEqual({ slug: 'empty', count: 0, first: null });
  expect(mocks.invalidate).not.toHaveBeenCalled();
});
it('revalidates a cached catalog after a committed revision change', async () => {
  const server = app();
  const firstResponse = await server.request(path);
  const headers = { 'If-None-Match': firstResponse.headers.get('ETag')! };
  expect((await server.request(path, { headers })).status).toBe(304);
  revision = '2'; caseName = 'edited';
  const changed = await server.request(path, { headers });
  expect(changed.status).toBe(200);
  expect((await changed.json()).sets[0].first.name).toBe('edited');
});
it('invalidates page caches only after a successful catalog write', async () => {
  const server = app();
  const write = (slugs: string[]) => server.request('/v1/alg/sets/3x3/order', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slugs }),
  });
  expect((await write([])).status).toBe(400);
  expect(mocks.invalidate).not.toHaveBeenCalled();
  expect((await write(['oll', 'cross'])).status).toBe(200);
  expect(mocks.invalidate).toHaveBeenCalledExactlyOnceWith('alg');
});
