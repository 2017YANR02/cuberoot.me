import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/stats-base', () => ({ statsUrl: (path: string) => path }));
const manifest = { version: 1, months: { '2026-10': 'new' }, countryOptions: ['CN'], yearMonths: { '2026': [10] }, firstCountry: {}, firstEvent: {}, maxRounds: {}, maxDays: 3 };
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('calendar cache recovery', () => {
  it('revalidates directory on a later visit and deduplicates only in-flight requests', async () => {
    let complete!: (r: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { complete = resolve; })).mockResolvedValueOnce(Response.json({ ...manifest, months: { '2026-10': 'next' } }));
    vi.stubGlobal('fetch', fetcher);
    const { loadCalendarManifest } = await import('@/lib/competition-calendar');
    const first = loadCalendarManifest(); expect(loadCalendarManifest()).toBe(first);
    complete(Response.json(manifest)); expect(await first).toEqual(manifest);
    expect((await loadCalendarManifest()).months['2026-10']).toBe('next');
    expect(fetcher.mock.calls[0][1].cache).toBe('no-cache');
  });
  it('rejects mixed deployment and missing shards so the page can use the full catalog', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ contentHash: 'old', past: [], upcoming: [] })).mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(Response.json({ contentHash: 'new', past: [], upcoming: [] }));
    vi.stubGlobal('fetch', fetcher);
    const { loadCalendarMonth } = await import('@/lib/competition-calendar');
    await expect(loadCalendarMonth(manifest as never, '2026-10')).rejects.toThrow('mismatch');
    await expect(loadCalendarMonth(manifest as never, '2026-10')).rejects.toThrow('unavailable');
    await expect(loadCalendarMonth(manifest as never, '2026-10')).resolves.toEqual({ contentHash: 'new', past: [], upcoming: [] });
    await loadCalendarMonth(manifest as never, '2026-10');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
