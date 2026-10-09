import { afterEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/v1/competition-access/verify/route';
import { COMPETITION_ACCESS_COOKIE } from '@cuberoot/shared/competition-access';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const cookie = `${COMPETITION_ACCESS_COOKIE}=proof; Domain=cuberoot.me; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`;
function request(origin: string, site = 'http://localhost:3000') {
  return new Request(site + '/v1/competition-access/verify', {
    method: 'POST', headers: { origin, 'user-agent': 'browser', 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'challenge', answer: 'abc234' }),
  });
}
it('adapts local verification and preserves the signed proof in a host-only cookie', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const fetcher = vi.fn().mockResolvedValue(Response.json({ expiresIn: 604800 }, { headers: { 'set-cookie': cookie } }));
  vi.stubGlobal('fetch', fetcher);
  const result = await POST(request('http://localhost:3000'));
  expect(result.status).toBe(200);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe('https://api.cuberoot.me/v1/competition-access/verify');
  expect(options.headers.get('origin')).toBe('https://dev.cuberoot.me');
  expect(options.headers.get('user-agent')).toBe('browser');
  expect(JSON.parse(options.body).answer).toBe('abc234');
  expect(result.headers.get('set-cookie')).toBe(`${COMPETITION_ACCESS_COOKIE}=proof; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`);
  expect(result.headers.get('cache-control')).toBe('private, no-store');
});
it('rejects foreign and missing origins before contacting the API', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  for (const origin of ['https://evil.example', '', 'http://localhost:4000']) {
    expect((await POST(request(origin))).status).toBe(403);
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it('accepts the actual loopback origin when Next normalizes its internal URL to localhost', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const fetcher = vi.fn().mockResolvedValue(Response.json({}, { headers: { 'set-cookie': cookie } }));
  vi.stubGlobal('fetch', fetcher);
  const local = request('http://127.0.0.1:3000');
  local.headers.set('host', '127.0.0.1:3000');
  expect((await POST(local)).status).toBe(200);
  expect(fetcher.mock.calls[0][1].headers.get('origin')).toBe('https://dev.cuberoot.me');
  fetcher.mockClear();
  local.headers.set('origin', 'http://localhost:3000');
  expect((await POST(local)).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
it('preserves the public preview origin and cookie domain behind the localhost tunnel', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const fetcher = vi.fn().mockResolvedValue(Response.json({}, { headers: { 'set-cookie': cookie } }));
  vi.stubGlobal('fetch', fetcher);
  const tunneled = request('https://dev.cuberoot.me');
  tunneled.headers.set('host', 'dev.cuberoot.me');
  const result = await POST(tunneled);
  expect(result.status).toBe(200);
  expect(fetcher.mock.calls[0][1].headers.get('origin')).toBe('https://dev.cuberoot.me');
  expect(result.headers.get('set-cookie')).toBe(cookie);
});
it('leaves production origin and cookie restrictions intact', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const fetcher = vi.fn().mockResolvedValue(Response.json({}, { headers: { 'set-cookie': cookie } }));
  vi.stubGlobal('fetch', fetcher);
  const result = await POST(request('https://cuberoot.me', 'https://cuberoot.me'));
  expect(fetcher.mock.calls[0][1].headers.get('origin')).toBe('https://cuberoot.me');
  expect(result.headers.get('set-cookie')).toBe(cookie);
});
it('preserves failed answers and rate limits instead of granting access', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  for (const status of [400, 429, 503]) {
    fetcher.mockResolvedValueOnce(Response.json({ code: 'failure' }, { status, headers: { 'retry-after': '60' } }));
    const result = await POST(request('http://localhost:3000'));
    expect(result.status).toBe(status);
    expect(await result.json()).toEqual({ code: 'failure' });
    expect(result.headers.get('retry-after')).toBe('60');
    expect(result.headers.has('set-cookie')).toBe(false);
  }
});
