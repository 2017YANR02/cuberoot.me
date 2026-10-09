import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { beforeEach, expect, it, vi } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';

const apiPath = (path: string) => workspaceFixturePath('@cuberoot/server', path);
const query = vi.fn();
vi.doMock(apiPath('src/db/connection.ts'), () => ({ query }));
const { publicContentCache, publicContentDomain } = await import(pathToFileURL(apiPath('src/utils/public_content_cache.ts')).href);
const require = createRequire(apiPath('package.json'));
const { Hono } = await import(pathToFileURL(require.resolve('hono')).href);

let revision = '1';
let value = 'original';
let generated = 0;
type Context = { json: (value: unknown) => Response; req: { query: (key: string) => string }; header: (key: string, value: string) => void };
function instance(path = '/v1/alg/sets/3x3/f2l') {
  const app = new Hono();
  app.use('/v1/*', publicContentCache());
  app.get(path, (c: Context) => {
    generated++;
    return c.json({ value, admin: c.req.query('admin') === '1' });
  });
  return { get: (headers?: Record<string, string>, suffix = ''): Promise<Response> => app.request(path + suffix, { headers }) };
}
beforeEach(() => {
  revision = '1'; value = 'original'; generated = 0;
  query.mockReset().mockImplementation(async () => [{ revision }]);
});

it('reuses the generated body across 100 checks, returning bodyless 304s', async () => {
  const app = instance();
  const first = await app.get();
  const etag = first.headers.get('ETag')!;
  expect(first.headers.get('Cache-Control')).toBe('public, no-cache, must-revalidate');
  for (let i = 0; i < 100; i++) {
    const response = await app.get({ 'If-None-Match': etag });
    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
  }
  expect(generated).toBe(1);
  expect(query).toHaveBeenCalledTimes(101);
});

it('both API workers see a committed change on their next request', async () => {
  const a = instance(); const b = instance();
  const first = await a.get(); await b.get();
  revision = '2'; value = 'edited';
  for (const worker of [a, b]) {
    const result = await worker.get({ 'If-None-Match': first.headers.get('ETag')! });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ value: 'edited', admin: false });
  }
  expect(generated).toBe(4);
});

it('never serves cached data when version lookup fails', async () => {
  const app = instance(); const old = await app.get();
  query.mockRejectedValue(new Error('unavailable'));
  value = 'fresh fallback';
  const response = await app.get({ 'If-None-Match': old.headers.get('ETag')! });
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect((await response.json()).value).toBe(value);
});

it('does not reuse schedule-dependent notices just because the revision is unchanged', async () => {
  const app = instance('/v1/page-notices'); const first = await app.get();
  value = 'scheduled notice now active';
  const response = await app.get({ 'If-None-Match': first.headers.get('ETag')! });
  expect(response.status).toBe(200);
  expect((await response.json()).value).toBe(value);
});

it.each([
  ['/v1/sponsors', 'admin=1'], ['/v1/article', 'mine=1'], ['/v1/article/private-slug', ''],
  ['/v1/recon/2796', ''], ['/v1/teachers/mine', ''], ['/v1/auth/me', ''],
])('excludes viewer-dependent endpoint %s?%s', (path, search) => {
  expect(publicContentDomain(path, new URLSearchParams(search))).toBeNull();
});

it('cannot reuse a public sponsor response for an admin request', async () => {
  const app = instance('/v1/sponsors'); await app.get();
  const admin = await app.get(undefined, '?admin=1');
  expect((await admin.json()).admin).toBe(true);
  expect(generated).toBe(2);
});

it('supports weak and multiple HTTP validators', async () => {
  const app = instance(); const first = await app.get();
  expect((await app.get({ 'If-None-Match': `"other", W/${first.headers.get('ETag')}` })).status).toBe(304);
});

it('bounds cache entries and regenerates evicted data', async () => {
  const app = instance();
  for (let i = 0; i < 257; i++) await app.get(undefined, `?v=${i}`);
  await app.get(undefined, '?v=0');
  expect(generated).toBe(258);
});

it('keeps empty public responses out of all caches', async () => {
  const app = new Hono();
  app.use('/v1/*', publicContentCache());
  app.get('/v1/recon/latest', () => Response.json(null));
  const response = await app.request('/v1/recon/latest');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('ETag')).toBeNull();
});
