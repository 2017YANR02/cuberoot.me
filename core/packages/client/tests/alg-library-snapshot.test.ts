import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
import { GET, generateStaticParams } from '@/app/api/alg/snapshot/[puzzle]/[set]/route';
import { loadAlg } from '@cuberoot/shared/alg';

afterEach(() => vi.unstubAllGlobals());
describe('public algorithm snapshots', () => {
  it('serves a lossless compressed snapshot and prebuilds large sets', async () => {
    const data = { puzzle: '3x3', set: '1lll', cases: [], source: 'public', scrapedAt: '' };
    const fetcher = vi.fn(async () => Response.json(data));
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(new Request('http://localhost/api/alg/snapshot/3x3/1lll'), { params: Promise.resolve({ puzzle: '3x3', set: '1lll' }) });
    expect(response.headers.get('Content-Encoding')).toBe('gzip');
    expect(JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())).toString())).toEqual(data);
    expect(generateStaticParams()).toContainEqual({ puzzle: '3x3', set: '1lll' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not turn a failed upstream read into a cached empty set', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(GET(new Request('http://localhost/api/alg/snapshot/3x3/oll'), { params: Promise.resolve({ puzzle: '3x3', set: 'oll' }) })).rejects.toThrow('503');
  });
  it('normalizes a snapshot through the existing shared loader', async () => {
    const loader = vi.fn(async () => ({ puzzle: '3x3', set: 'pll', cases: [], source: 'snapshot', scrapedAt: '' }));
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('unexpected network'); }));
    expect((await loadAlg('3x3', 'pll', { loader })).source).toBe('snapshot');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
