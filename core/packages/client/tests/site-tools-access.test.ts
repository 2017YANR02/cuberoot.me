import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/tools/[...slug]/route';
import { COMPETITION_SERVICE_HEADER, verifyCompetitionProof } from '@cuberoot/shared/competition-access';
vi.mock('node:fs', () => ({ promises: { readFile: vi.fn().mockRejectedValue(new Error('not bundled')) } }));
const secret = 'test-only-secret-with-more-than-32-characters';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function setup(response: Response) {
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('COMPETITION_ACCESS_SECRET', secret);
  const fetcher = vi.fn().mockResolvedValue(response); vi.stubGlobal('fetch', fetcher); return fetcher;
}
function get(slug: string[], suffix = '') { return GET(new Request('https://cuberoot.me/tools/' + slug.join('/') + suffix), { params: Promise.resolve({ slug }) }); }
it('sends an exact short-lived service proof for protected upstream HTML', async () => {
  const fetcher = setup(new Response('<html>tool</html>', { headers: { 'content-type': 'text/html' } }));
  expect((await get(['cstimer', 'index.html'])).status).toBe(200);
  const args = fetcher.mock.calls[0];
  const proof = args[1].headers[COMPETITION_SERVICE_HEADER];
  expect(await verifyCompetitionProof(secret, proof, 'service', '/tools/cstimer/index.html')).toBe(true);
  expect(await verifyCompetitionProof(secret, proof, 'service', '/v1/cubing-live/A')).toBe(false);
  expect(args[1].redirect).toBe('manual');
});
it('keeps canonical tool redirects same-origin and refuses verification redirects as HTML', async () => {
  setup(new Response(null, { status: 301, headers: { location: 'https://static.cuberoot.me/tools/cstimer/' } }));
  const response = await get(['cstimer']);
  expect(response.status).toBe(307); expect(response.headers.get('location')).toBe('/tools/cstimer/');
  setup(new Response(null, { status: 307, headers: { location: 'https://cuberoot.me/competition-verify' } }));
  expect((await get(['cstimer'])).status).toBe(403);
});
it('does not require the signing secret for public worker assets', async () => {
  const fetcher = setup(new Response('worker')); vi.stubEnv('COMPETITION_ACCESS_SECRET', '');
  expect((await get(['cstimer', 'worker.js'])).status).toBe(200);
  expect(fetcher.mock.calls[0][1].headers).toEqual({});
});

it.each(['alg_trainers', 'cstimer', 'blddb', 'solver'])('serves %s directories without losing their slash or query', async (directory) => {
  const fetcher = setup(new Response('<html>tool</html>', { headers: { 'content-type': 'text/html' } }));
  const response = await get([directory], '/?mode=practice&v=2');
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('<html>tool</html>');
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe(`https://static.cuberoot.me/tools/${directory}/?mode=practice&v=2`);
  const proof = options.headers[COMPETITION_SERVICE_HEADER];
  expect(await verifyCompetitionProof(secret, proof, 'service', `/tools/${directory}/?mode=practice&v=2`)).toBe(true);
  expect(await verifyCompetitionProof(secret, proof, 'service', `/tools/${directory}`)).toBe(false);
});
it('follows a directory canonicalization in one browser hop, preserving its query', async () => {
  const fetcher = setup(new Response(null, { status: 301, headers: { location: '/tools/alg_trainers/?v=2' } }));
  const first = await get(['alg_trainers'], '?v=2');
  expect(first.status).toBe(307);
  expect(first.headers.get('location')).toBe('/tools/alg_trainers/?v=2');
  fetcher.mockResolvedValueOnce(new Response('trainer'));
  expect((await get(['alg_trainers'], '/?v=2')).status).toBe(200);
  expect(fetcher.mock.calls[1][0]).toBe('https://static.cuberoot.me/tools/alg_trainers/?v=2');
});
it.each(['/tools/alg_trainers/?v=2', 'https://static.cuberoot.me/tools/alg_trainers/?v=2#top'])('refuses an upstream redirect back to the same request: %s', async (location) => {
  setup(new Response(null, { status: 301, headers: { location } }));
  const response = await get(['alg_trainers'], '/?v=2');
  expect(response.status).toBe(502);
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('cache-control')).toBe('no-store');
});
it.each(['https://evil.example/tools/alg_trainers/', 'https://static.cuberoot.me/competition-verify'])('refuses redirects outside the trusted tools origin/path: %s', async (location) => {
  setup(new Response(null, { status: 302, headers: { location } }));
  expect((await get(['alg_trainers'])).status).toBe(403);
});
it.each(['index.html', 'worker.js', 'style.css'])('preserves file resource paths and query strings: %s', async (file) => {
  const fetcher = setup(new Response('asset'));
  expect((await get(['alg_trainers', file], '?v=2')).status).toBe(200);
  expect(fetcher.mock.calls[0][0]).toBe(`https://static.cuberoot.me/tools/alg_trainers/${file}?v=2`);
  if (file === 'index.html') {
    expect(await verifyCompetitionProof(secret, fetcher.mock.calls[0][1].headers[COMPETITION_SERVICE_HEADER], 'service', '/tools/alg_trainers/index.html?v=2')).toBe(true);
  } else {
    expect(fetcher.mock.calls[0][1].headers).toEqual({});
  }
});
