import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-api', () => ({
  authHeaders: () => ({ Authorization: 'Bearer test-session' }),
  handleApi: async (response: Response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  },
}));
vi.mock('@/lib/api-base', () => ({ apiUrl: (url: string) => url, directApiUrl: (url: string) => url }));
import { fetchMusicTrackDownload } from '@/lib/music-api';

afterEach(() => vi.unstubAllGlobals());

describe('authenticated music download client', () => {
  it.each([['static', 'static-tracks'], ['uploaded', 'tracks']] as const)('downloads %s tracks through the authenticated API', async (source, collection) => {
    const fetch = vi.fn().mockResolvedValue(new Response('audio bytes', { headers: { 'Content-Type': 'audio/mpeg' } }));
    vi.stubGlobal('fetch', fetch);
    const blob = await fetchMusicTrackDownload('track/id', source);
    expect(await blob.text()).toBe('audio bytes');
    expect(fetch).toHaveBeenCalledWith(`/v1/music/${collection}/track%2Fid/download`, {
      headers: { Authorization: 'Bearer test-session' }, cache: 'no-store',
    });
  });
  it('reports a rejected membership without treating the error body as audio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Music membership required' }), { status: 403 })));
    await expect(fetchMusicTrackDownload('id', 'static')).rejects.toThrow('Music membership required');
  });
});
