// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { statsUrl, usesLocalStats } from '@cuberoot/shared/stats-base';

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, promises: { ...actual.promises, readFile } };
});
import { GET } from '@/app/stats/[...slug]/route';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('NEXT_PUBLIC_STATS_SOURCE', '');
  vi.stubEnv('NEXT_PUBLIC_STATIC_ORIGIN', '');
  vi.stubEnv('VERCEL', '');
  readFile.mockReset().mockResolvedValue(Buffer.from('{"local":true}'));
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

it('shares the published source between Web and shared loaders, independent of other assets', async () => {
  vi.stubGlobal('window', {});
  vi.stubEnv('NEXT_PUBLIC_STATIC_ORIGIN', 'https://assets.example');
  const web = await import('@/lib/stats-base');
  expect(web.statsUrl).toBe(statsUrl);
  expect(statsUrl('/stats/cn_upcoming_registrations.json')).toBe('https://static.cuberoot.me/stats/cn_upcoming_registrations.json');
  expect(web.staticUrl('/sim/model.bin')).toBe('https://assets.example/sim/model.bin');
});

it('uses local snapshots only when explicitly selected in development, including SSR', () => {
  vi.stubEnv('NEXT_PUBLIC_STATS_SOURCE', 'local');
  vi.stubEnv('PORT', '3100');
  expect(usesLocalStats()).toBe(true);
  expect(statsUrl('/stats/index.json')).toBe('http://127.0.0.1:3100/stats/index.json');
  vi.stubGlobal('window', {});
  expect(statsUrl('/stats/index.json')).toBe('/stats/index.json');
  vi.stubEnv('NODE_ENV', 'production');
  expect(usesLocalStats()).toBe(false);
  expect(statsUrl('/stats/index.json')).toBe('https://static.cuberoot.me/stats/index.json');
});

const request = (path: string) => GET(new Request(`http://localhost:3000/stats/${path}?v=42`), {
  params: Promise.resolve({ slug: path.split('/') }),
});

it('ignores old local files for direct stats requests and preserves the query string', async () => {
  const result = await request('cn_upcoming_registrations.json');
  expect(result.status).toBe(307);
  expect(result.headers.get('location')).toBe('https://static.cuberoot.me/stats/cn_upcoming_registrations.json?v=42');
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(readFile).not.toHaveBeenCalled();
});

it('serves local files without caching when local mode is selected', async () => {
  vi.stubEnv('NEXT_PUBLIC_STATS_SOURCE', 'local');
  const result = await request('index.json');
  expect(await result.json()).toEqual({ local: true });
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['index.json', 'scramble/downloads/sample.txt', 'scramble/bundles/all.csv.gz'])('does not fall back remotely for missing local %s', async path => {
  vi.stubEnv('NEXT_PUBLIC_STATS_SOURCE', 'local');
  readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = await request(path);
  expect(result.status).toBe(404);
  expect(await result.json()).toEqual({ error: 'LOCAL_STATS_NOT_FOUND', path: `/stats/${path}`, source: 'local' });
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(fetch).not.toHaveBeenCalled();
});

it('preserves attachment downloads in published development mode', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('sample'));
  const result = await request('scramble/downloads/sample.txt');
  expect(await result.text()).toBe('sample');
  expect(result.headers.get('content-disposition')).toBe('attachment; filename="sample.txt"');
  expect(readFile).not.toHaveBeenCalled();
});

it('retains Vercel fallback even if a local-only setting leaked into production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_STATS_SOURCE', 'local');
  vi.stubEnv('VERCEL', '1');
  readFile.mockRejectedValue(new Error('not bundled'));
  const result = await request('index.json');
  expect(result.status).toBe(307);
  expect(result.headers.get('location')).toBe('https://static.cuberoot.me/stats/index.json?v=42');
});
