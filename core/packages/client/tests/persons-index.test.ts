// @vitest-environment node
import { gzipSync } from 'node:zlib';
import { afterEach, expect, it, vi } from 'vitest';

const person = ['2023GENG02', 'Xuanyi Geng (耿暄一)', 'CN'];
const response = () => new Response(gzipSync(JSON.stringify([person])));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

it.each(['development', 'production'])('loads the published index in %s and shares concurrent requests', async env => {
  vi.stubEnv('NODE_ENV', env);
  const fetcher = vi.fn(async () => response());
  vi.stubGlobal('fetch', fetcher);
  const index = await import('@cuberoot/shared/persons-index');
  const first = index.loadPersonsIndex();
  expect(index.loadPersonsIndex()).toBe(first);
  await first;
  expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://static.cuberoot.me/stats/persons_search.json.gz');
  expect(index.searchLocalPersons('耿暄一')).toEqual([{ wcaId: person[0], name: person[1], iso2: 'CN', avatarUrl: '' }]);
  await index.loadPersonsIndex();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('retries after a failed request instead of permanently caching the rejection', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 404 })).mockImplementationOnce(async () => response());
  vi.stubGlobal('fetch', fetcher);
  const index = await import('@cuberoot/shared/persons-index');
  await expect(index.loadPersonsIndex()).rejects.toThrow('404');
  expect(index.isPersonsIndexReady()).toBe(false);
  await index.loadPersonsIndex();
  expect(index.searchLocalPersons('2023geng02')?.[0].name).toBe(person[1]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('honors the same explicit local mode as other statistics', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('NEXT_PUBLIC_STATS_SOURCE', 'local');
  vi.stubGlobal('window', {});
  const fetcher = vi.fn(async () => response());
  vi.stubGlobal('fetch', fetcher);
  const index = await import('@cuberoot/shared/persons-index');
  await index.loadPersonsIndex();
  expect(fetcher).toHaveBeenCalledExactlyOnceWith('/stats/persons_search.json.gz');
});
