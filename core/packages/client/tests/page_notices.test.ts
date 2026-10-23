import { afterEach, describe, expect, it, vi } from 'vitest';
import { deletePageNotice, featureHomepagePost, fetchPageNotices, homepagePostNotice, matchNotices, type PageNotice } from '@/lib/page-notices-api';

function notice(overrides: Partial<PageNotice>): PageNotice {
  return {
    id: 1,
    path: '/',
    level: 'info',
    bodyEn: 'Notice',
    bodyZh: '通知',
    enabled: true,
    dismissible: false,
    updatedAt: '2026-08-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('public notice request sharing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('updates stored announcement destinations without changing unrelated links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([
      notice({ id: 1, href: '/regulation/news#4-pad-2027' }),
      notice({ id: 2, href: '/zh/regulation/news/wic-investigation-2026' }),
      notice({ id: 3, href: '/regulation/newsroom' }),
      notice({ id: 4, href: 'https://example.org/regulation/news' }),
    ])));
    expect((await fetchPageNotices()).map(row => row.href)).toEqual([
      '/regulation/post#4-pad-2027', '/zh/regulation/post/wic-investigation-2026',
      '/regulation/newsroom', 'https://example.org/regulation/news',
    ]);
  });

  it('shares concurrent reads but fetches again after an empty response', async () => {
    let respond!: (response: Response) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { respond = resolve; }))
      .mockResolvedValueOnce(Response.json([notice({ id: 2 })]));
    vi.stubGlobal('fetch', fetchMock);
    const reads = [fetchPageNotices(), fetchPageNotices()];
    expect(fetchMock).toHaveBeenCalledTimes(1);
    respond(Response.json([]));
    expect(await Promise.all(reads)).toEqual([[], []]);
    expect((await fetchPageNotices()).map((row) => row.id)).toEqual([2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['network', 'http', 'json'])('allows retry after a %s failure', async (failure) => {
    const fetchMock = vi.fn();
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new Error('offline'));
    else if (failure === 'http') fetchMock.mockResolvedValueOnce(Response.json({ error: 'unavailable' }, { status: 503 }));
    else fetchMock.mockResolvedValueOnce(new Response('invalid json'));
    fetchMock.mockResolvedValueOnce(Response.json([]));
    vi.stubGlobal('fetch', fetchMock);
    const results = await Promise.allSettled([fetchPageNotices(), fetchPageNotices()]);
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await fetchPageNotices()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('invalidates a read after an admin write without an old read clearing a newer one', async () => {
    let respondOld!: (response: Response) => void;
    let respondNew!: (response: Response) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { respondOld = resolve; }))
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { respondNew = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const oldRead = fetchPageNotices();
    await deletePageNotice(1);
    const newRead = fetchPageNotices();
    respondOld(Response.json([notice({})]));
    await oldRead;
    const sharedRead = fetchPageNotices();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    respondNew(Response.json([]));
    expect(await Promise.all([newRead, sharedRead])).toEqual([[], []]);
  });
});

describe('page notice placement matching', () => {
  it('does not render homepage featured news in the global page-top bar', () => {
    const rows = [
      notice({ id: 1, placement: 'home_featured', href: '/regulation/post#4-pad-2027' }),
      notice({ id: 2, placement: 'page_top', path: '/*' }),
    ];

    expect(matchNotices(rows, '/').map((row) => row.id)).toEqual([2]);
  });

  it('treats responses from the pre-placement API as page-top notices', () => {
    expect(matchNotices([notice({ placement: undefined })], '/').map((row) => row.id)).toEqual([1]);
  });
});


describe('homepage article feature', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('creates an independent homepage feature without overwriting another article', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json([
      notice({ id: 7, placement: 'home_featured', href: '/regulation/post/other', icon: 'megaphone', color: 'blue', endsAt: '2020-01-01T00:00:00Z' }),
      notice({ id: 8, placement: 'page_top', path: '/' }),
    ])).mockResolvedValueOnce(Response.json(notice({ placement: 'home_featured' })));
    vi.stubGlobal('fetch', fetch);
    await featureHomepagePost({ id: 'wic-investigation-2026', title: {zh: '声明', en: 'Statement'} });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('/v1/page-notices/home-feature');
    const request = fetch.mock.calls[1][1];
    expect(request.method).toBe('PUT');
    expect(JSON.parse(request.body)).toEqual({
      path: '/', placement: 'home_featured', level: 'info', icon: 'megaphone', color: 'terracotta',
      bodyZh: '声明', bodyEn: 'Statement', href: '/regulation/post/wic-investigation-2026',
      enabled: true, dismissible: false, startsAt: null, endsAt: null,
    });
  });
  it('reactivates only the matching article, keeping its ID and appearance', async () => {
    const rows = [
      notice({ id: 7, placement: 'home_featured', href: '/regulation/post/other' }),
      notice({ id: 9, placement: 'home_featured', href: '/zh/regulation/post/example', enabled: false, color: 'blue' }),
    ];
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(rows)).mockResolvedValueOnce(Response.json(rows[1]));
    vi.stubGlobal('fetch', fetch);
    await featureHomepagePost({ id: 'example', title: { zh: '公告', en: 'Post' } });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ id: 9, enabled: true, color: 'blue', href: '/regulation/post/example', startsAt: null, endsAt: null });
    expect(homepagePostNotice(rows, 'other')?.id).toBe(7);
    expect(homepagePostNotice(rows, 'missing')).toBeUndefined();
  });
  it('does not fall back to the old singleton write endpoint', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json({ error: 'Not found' }, { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    await expect(featureHomepagePost({ id: 'example', title: { zh: '公告', en: 'Post' } })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('/v1/page-notices/home-feature');
  });
  it('does not attempt a write when the administrator read is denied', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({error: 'Forbidden'}, {status: 403}));
    vi.stubGlobal('fetch', fetch);
    await expect(featureHomepagePost({id:'example',title:{zh:'公告',en:'Post'}})).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
