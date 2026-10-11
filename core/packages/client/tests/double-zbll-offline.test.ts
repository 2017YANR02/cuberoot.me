import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { doubleZbllOfflinePages } from '@/lib/double-zbll';
const script = readFileSync(fileURLToPath(new URL('../public/double-zbll-sw.js', import.meta.url)), 'utf8');

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
