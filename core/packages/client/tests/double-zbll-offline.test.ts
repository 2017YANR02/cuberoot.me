import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { doubleZbllOfflinePages } from '@/lib/double-zbll';
const script = readFileSync(fileURLToPath(new URL('../public/double-zbll-sw.js', import.meta.url)), 'utf8');

describe('Double ZBLL corpus version refresh', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  async function fixture() {
    vi.resetModules();
    const { DOUBLE_ZBLL_MOVES } = await import('@cuberoot/shared/double-zbll');
    const root = '/data/double-zbll/';
    const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
    const cases = JSON.stringify({ cases: Array.from({ length: 472 }, (_, i) => ({ name: `case-${i}`, subgroup: 'U' })) });
    const casesSha256 = digest(cases), casesFile = `cases-${casesSha256.slice(0, 16)}.json`;
    function version(length: number) {
      const data = new Uint8Array(222784 * 21);
      for (let i = 0; i < 222784; i++) data[i * 21] = length;
      const dataSha256 = digest(data), dataFile = `pairs-${dataSha256.slice(0, 16)}.bin`;
      const manifest = { schema: 1, version: dataSha256.slice(0, 16), caseCount: 472, pairCount: 222784, recordBytes: 21, metric: 'HTM', moves: DOUBLE_ZBLL_MOVES, dataBytes: data.length, dataSha256, dataFile, casesFile, casesSha256 };
      return { data, manifest };
    }
    const old = version(2), fresh = version(1);
    const saved = new Map<string, Response>([
      [root + 'manifest.json', new Response(JSON.stringify(old.manifest))],
      [root + old.manifest.dataFile, new Response(old.data)],
      [root + casesFile, new Response(cases)],
    ]);
    vi.stubGlobal('caches', { open: async () => ({ match: async (path: string) => saved.get(path)?.clone(), put: async (path: string, response: Response) => { saved.set(path, response.clone()); } }) });
    return { root, old, fresh, saved };
  }
  it('replaces an old cached corpus only after verifying the new complete corpus', async () => {
    const { root, fresh, saved } = await fixture();
    const fetcher = vi.fn(async (path: string) => path.endsWith('manifest.json?check=1')
      ? new Response(JSON.stringify(fresh.manifest)) : new Response(fresh.data));
    vi.stubGlobal('fetch', fetcher);
    const { loadDoubleZbll } = await import('@/lib/double-zbll');
    expect((await loadDoubleZbll()).manifest.dataSha256).toBe(fresh.manifest.dataSha256);
    expect((await saved.get(root + 'manifest.json')!.json()).dataSha256).toBe(fresh.manifest.dataSha256);
    await loadDoubleZbll();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(['offline', 'corrupt'])('keeps the verified offline corpus when the update is %s', async failure => {
    const { root, old, fresh, saved } = await fixture();
    vi.stubGlobal('fetch', async (path: string) => {
      if (failure === 'offline') throw new TypeError('Offline');
      return path.endsWith('manifest.json?check=1') ? new Response(JSON.stringify(fresh.manifest)) : new Response('corrupt data');
    });
    const { loadDoubleZbll } = await import('@/lib/double-zbll');
    expect((await loadDoubleZbll()).manifest.dataSha256).toBe(old.manifest.dataSha256);
    expect((await saved.get(root + 'manifest.json')!.json()).dataSha256).toBe(old.manifest.dataSha256);
  });
});

function worker(scope = 'https://example.com/zh/alg/3x3/zbll/') {
  const listeners = new Map<string, (event: unknown) => void>();
  const saved = new Map<string, Response>();
  const key = (request: string | Request) => typeof request === 'string' ? request : request.url;
  runInNewContext(script, {
    URL,
    self: { location: { origin: 'https://example.com' }, registration: { scope }, addEventListener: (type: string, fn: (e: unknown) => void) => listeners.set(type, fn) },
    caches: { open: async () => ({ match: async (r: string | Request) => saved.get(key(r))?.clone(), put: async (r: string | Request, value: Response) => saved.set(key(r), value) }) },
    fetch: async () => { throw new TypeError('Offline'); },
  });
  return { saved, request(path: string, mode = 'cors', method = 'GET') {
    let response: Promise<Response> | undefined;
    listeners.get('fetch')!({ request: { url: new URL(path, scope).href, method, mode }, respondWith: (r: Promise<Response>) => { response = r; } });
    return response;
  } };
}

describe('Double ZBLL offline worker', () => {
  it('reloads the downloaded trainer offline with URL preferences', async () => {
    const w = worker(); w.saved.set('https://example.com/zh/alg/3x3/zbll/run', new Response('trainer shell'));
    expect(await (await w.request('run?scope=U', 'navigate'))!.text()).toBe('trainer shell');
  });
  it('does not intercept private requests, other pages or writes', () => {
    const w = worker();
    for (const url of ['/v1/me', '/account', '/zh/alg/3x3/pll/run', 'https://other.test/_next/static/a.js']) expect(w.request(url, 'navigate')).toBeUndefined();
    expect(w.request('/v1/trainer/room', 'cors', 'POST')).toBeUndefined();
  });
  it('fails honestly if no downloaded shell exists', async () => {
    await expect(worker().request('select', 'navigate')).rejects.toThrow('Offline');
  });

  it.each(['', '/zh'])('restores the timer shell for both ZBLL views and route aliases (%s)', async prefix => {
    const { scope, pages, marker } = doubleZbllOfflinePages(prefix + '/timer');
    expect(scope).toBe(prefix + '/timer');
    expect(pages).toEqual([prefix + '/timer']);
    expect(marker).not.toBe(doubleZbllOfflinePages(prefix + '/alg/3x3/zbll/run').marker);
    const w = worker('https://example.com' + scope);
    w.saved.set('https://example.com' + pages[0], new Response('timer training shell'));
    for (const puzzle of ['3x3', '333']) for (const view of ['run', 'select']) {
      const url = prefix + '/timer?training=' + encodeURIComponent(`/alg/${puzzle}/zbll/${view}`) + '&train.scope=U&event=333';
      expect(await (await w.request(url, 'navigate'))!.text()).toBe('timer training shell');
    }
    // A successful legacy download cannot certify a timer download, or vice versa.
    expect(doubleZbllOfflinePages(prefix + '/alg/3x3/zbll/run').pages).toEqual([
      prefix + '/alg/3x3/zbll/run', prefix + '/alg/3x3/zbll/select',
    ]);
  });

  it('keeps ordinary timer, other training, RSC, account and API requests out of the offline shell', () => {
    const w = worker('https://example.com/zh/timer');
    for (const path of [
      '/zh/timer', '/zh/timer?event=333&share=private', '/zh/timer?training=home',
      '/zh/timer?training=/alg/3x3/oll/run', '/zh/timer?training=/alg/3x3/zbll/run/extra',
      '/zh/timer-other?training=/alg/3x3/zbll/run', '/timer?training=/alg/3x3/zbll/run',
      '/zh/alg/3x3/zbll/run', '/v1/me', '/account',
    ]) expect(w.request(path, 'navigate'), path).toBeUndefined();
    expect(w.request('/zh/timer?training=/alg/3x3/zbll/run&_rsc=123')).toBeUndefined();
    expect(w.request('/v1/trainer/room', 'cors', 'POST')).toBeUndefined();
  });
});
