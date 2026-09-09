import { afterEach, describe, expect, it, vi } from 'vitest';
import { deletePageNotice, fetchPageNotices, matchNotices, type PageNotice } from '@/lib/page-notices-api';

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
      notice({ id: 1, placement: 'home_featured', href: '/regulation/news#4-pad-2027' }),
      notice({ id: 2, placement: 'page_top', path: '/*' }),
    ];

    expect(matchNotices(rows, '/').map((row) => row.id)).toEqual([2]);
  });

  it('treats responses from the pre-placement API as page-top notices', () => {
    expect(matchNotices([notice({ placement: undefined })], '/').map((row) => row.id)).toEqual([1]);
  });
});
