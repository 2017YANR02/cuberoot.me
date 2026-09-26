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
function get(slug: string[]) { return GET(new Request('https://cuberoot.me/tools/' + slug.join('/')), { params: Promise.resolve({ slug }) }); }
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
