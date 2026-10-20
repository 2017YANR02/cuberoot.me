import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { doubleZbllOfflinePages } from '@/lib/double-zbll';
const script = readFileSync(fileURLToPath(new URL('../public/double-zbll-sw.js', import.meta.url)), 'utf8');

describe('Double ZBLL corpus version refresh', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  async function fixture(caseCount = 472) {
    vi.resetModules();
    const { DOUBLE_ZBLL_MOVES } = await import('@cuberoot/shared/double-zbll');
    const root = '/data/double-zbll/';
    const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
    const cases = JSON.stringify({ cases: Array.from({ length: caseCount }, (_, i) => ({ name: `case-${i}`, subgroup: i >= 472 ? 'PLL/PLL' : 'U' })) });
    const casesSha256 = digest(cases), casesFile = `cases-${casesSha256.slice(0, 16)}.json`;
    function version(length: number) {
      const data = new Uint8Array(caseCount ** 2 * 21);
      for (let i = 0; i < caseCount ** 2; i++) data[i * 21] = length;
      const dataSha256 = digest(data), dataFile = `pairs-${dataSha256.slice(0, 16)}.bin`;
      const manifest = { schema: 1, version: dataSha256.slice(0, 16), caseCount, pairCount: caseCount ** 2, recordBytes: 21, metric: 'HTM', moves: DOUBLE_ZBLL_MOVES, dataBytes: data.length, dataSha256, dataFile, casesFile, casesSha256 };
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
  it('loads all 493 cases while keeping ordinary offline ZBLL limited to 472', async () => {
    const { fresh } = await fixture(493);
    vi.stubGlobal('fetch', async (path: string) => path.endsWith('manifest.json?check=1')
      ? new Response(JSON.stringify(fresh.manifest)) : new Response(fresh.data));
    const { loadDoubleZbll, cachedDoubleZbllCases, doubleZbllPllCases, doubleZbllScramble } = await import('@/lib/double-zbll');
    expect((await loadDoubleZbll()).file.cases).toHaveLength(493);
    expect((await cachedDoubleZbllCases())!.cases).toHaveLength(472);
    expect(doubleZbllPllCases()).toHaveLength(21);
    expect(doubleZbllScramble('U|case-0', 'PLL/PLL|case-492')).toBe('U');
    expect(doubleZbllScramble('PLL/PLL|case-492', 'U|case-0')).toBe('U');
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
  it('requires saving the new corpus version before reporting offline readiness', async () => {
    const { old, fresh, saved } = await fixture(493);
    const location = new URL('https://example.com/zh/alg/3x3/zbll/run');
    const { scope, pages, marker } = doubleZbllOfflinePages(location.pathname);
    vi.stubGlobal('location', location);
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => ({
      scope: new URL(scope, location.href).href, active: { scriptURL: 'https://example.com/double-zbll-sw.js' },
    }) } });
    for (const page of pages) saved.set(page, new Response('shell'));
    saved.set(marker, new Response(JSON.stringify({ version: old.manifest.version, resources: pages })));
    vi.stubGlobal('fetch', async (path: string) => path.endsWith('manifest.json?check=1')
      ? new Response(JSON.stringify(fresh.manifest)) : new Response(fresh.data));
    const { doubleZbllOfflineReady } = await import('@/lib/double-zbll');
    expect(await doubleZbllOfflineReady()).toBe(false);
    saved.set(marker, new Response(JSON.stringify({ version: fresh.manifest.version, resources: pages })));
    expect(await doubleZbllOfflineReady()).toBe(true);
  });
  it.each([false, true])('automatically caches once, shares concurrent installs and can retry a failure (%s)', async failFirst => {
    const { old, saved } = await fixture();
    const location = new URL('https://example.com/zh/alg/3x3/zbll/run');
    const { scope, pages, marker } = doubleZbllOfflinePages(location.pathname);
    const registration = { scope: new URL(scope, location.href).href, active: { scriptURL: 'https://example.com/double-zbll-sw.js' } };
    const register = vi.fn(async () => registration);
    vi.stubGlobal('location', location);
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: { register, getRegistration: async () => registration } });
    vi.stubGlobal('document', { querySelectorAll: () => [] });
    vi.stubGlobal('performance', { getEntriesByType: () => [] });
    vi.stubGlobal('PerformanceObserver', undefined);
    let fail = failFirst;
    const fetcher = vi.fn(async (path: string) => {
      if (path.endsWith('manifest.json?check=1')) return new Response(JSON.stringify(old.manifest));
      if (fail) throw new TypeError('Disconnected');
      return new Response('public shell', { headers: { 'content-type': 'text/html' } });
    });
    vi.stubGlobal('fetch', fetcher);
    const { ensureDoubleZbllOffline, doubleZbllOfflineReady } = await import('@/lib/double-zbll');
    const first = ensureDoubleZbllOffline();
    expect(ensureDoubleZbllOffline()).toBe(first);
    if (failFirst) {
      await expect(first).rejects.toThrow('Disconnected');
      expect(saved.has(marker)).toBe(false);
      expect(register).toHaveBeenCalledTimes(1);
      fail = false;
      await ensureDoubleZbllOffline();
    } else await first;
    expect(register).toHaveBeenCalledTimes(failFirst ? 2 : 1);
    for (const page of pages) expect(saved.has(page)).toBe(true);
    expect(await doubleZbllOfflineReady()).toBe(true);
    const fetchCount = fetcher.mock.calls.length;
    await ensureDoubleZbllOffline();
    expect(fetcher).toHaveBeenCalledTimes(fetchCount);
    expect(register).toHaveBeenCalledTimes(failFirst ? 2 : 1);
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
    for (const suffix of ['', '&view=select']) {
      const url = prefix + '/timer?content=zbll&source=cases&group=u' + suffix;
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
      '/zh/timer?content=zbll', '/zh/timer?content=oll&source=cases',
      '/zh/timer?content=zbll&source=cases&method=recognition',
    ]) expect(w.request(path, 'navigate'), path).toBeUndefined();
    expect(w.request('/zh/timer?training=/alg/3x3/zbll/run&_rsc=123')).toBeUndefined();
    expect(w.request('/v1/trainer/room', 'cors', 'POST')).toBeUndefined();
  });
});
