import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
const script = readFileSync(fileURLToPath(new URL('../public/double-zbll-sw.js', import.meta.url)), 'utf8');

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const saved = new Map<string, Response>();
  const key = (request: string | Request) => typeof request === 'string' ? request : request.url;
  const scope = 'https://example.com/zh/alg/3x3/zbll/';
  runInNewContext(script, {
    URL,
    self: { location: { origin: 'https://example.com' }, registration: { scope }, addEventListener: (type: string, fn: (e: unknown) => void) => listeners.set(type, fn) },
    caches: { open: async () => ({ match: async (r: string | Request) => saved.get(key(r)), put: async (r: string | Request, value: Response) => saved.set(key(r), value) }) },
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
});
