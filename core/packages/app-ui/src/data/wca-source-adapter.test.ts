import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadMobileWcaCompetitionScrambles,
  loadMobileWcaCompetitions,
} from './wca-source-adapter';

const row = {
  event_id: '333',
  round_type_id: '1',
  group_id: 'A',
  is_extra: false,
  scramble_num: 1,
  scramble: "R U R'",
  optimal_scramble: null,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('mobile WCA competition-scramble adapter', () => {
  it('does not fall through to the direct endpoint after cancellation', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(
          Object.assign(new Error('cancelled'), { name: 'AbortError' }),
        ), { once: true });
      })
    )) as unknown as typeof fetch;

    const request = loadMobileWcaCompetitionScrambles(
      'AbortFixture2026',
      fetcher,
      controller.signal,
    );
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('evicts a failed default-fetch promise so a later retry can recover', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('proxy unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('direct unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([row]), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await expect(loadMobileWcaCompetitionScrambles('RetryFixture2026')).resolves.toBeNull();
    await expect(loadMobileWcaCompetitionScrambles('RetryFixture2026')).resolves.toMatchObject([{
      eventId: '333',
      roundTypeId: '1',
      groupId: 'A',
      scramble: "R U R'",
    }]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('treats a malformed non-empty payload as transient and retries via the direct source', async () => {
    const fetcher = (vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{}]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([row]), { status: 200 }))) as unknown as typeof fetch;

    await expect(loadMobileWcaCompetitionScrambles(
      'MalformedFixture2026',
      fetcher,
    )).resolves.toMatchObject([{ eventId: '333', scramble: "R U R'" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the canonical competition index usable when translations are unavailable', async () => {
    vi.resetModules();
    let translationAttempt = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/comp_names_zh.json')) {
        translationAttempt += 1;
        return translationAttempt === 1
          ? new Response('unavailable', { status: 503 })
          : new Response(JSON.stringify({
            'English Still Works 2026': '2026WCA中文恢复赛',
          }), { status: 200 });
      }
      if (url.endsWith('/all_past_comps.json')) {
        return new Response(JSON.stringify([{
          id: 'EnglishStillWorks2026',
          name: 'English Still Works 2026',
          city: 'Los Angeles, California',
          country: 'United States',
          start_date: '2026-08-30',
          end_date: '2026-08-31',
        }]), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    });
    vi.stubGlobal('fetch', fetcher);
    const fresh = await import('./wca-source-adapter');

    await expect(fresh.loadMobileWcaCompetitions('en')).resolves.toMatchObject([{
      id: 'EnglishStillWorks2026',
      displayName: 'English Still Works',
      displayCity: 'Los Angeles',
      country: 'US',
      selectedDisplayName: 'English Still Works 2026',
    }]);
    await expect(fresh.loadMobileWcaCompetitions('zh')).resolves.toMatchObject([{
      id: 'EnglishStillWorks2026',
      displayName: '中文恢复赛',
      displayCity: '洛杉矶, 加利福尼亚州',
      country: 'US',
      selectedDisplayName: '中文恢复赛2026',
    }]);
    expect(fresh.displayMobileWcaCompetitionName(
      'EnglishStillWorks2026',
      'English Still Works 2026',
      'zh',
    )).toBe('中文恢复赛2026');
    // Canonical indexes remain cached; only the optional failed translation is retried.
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('evicts an all-source competition-index failure so the next focus can recover', async () => {
    const attempts = new Map<string, number>();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/comp_names_zh.json')) {
        return new Response('{}', { status: 200 });
      }
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      if (attempt === 1) return new Response('unavailable', { status: 503 });
      if (url.endsWith('/all_past_comps.json')) {
        return new Response(JSON.stringify([{
          id: 'RetryComp2026',
          name: 'Retry Comp 2026',
          city: 'Retry City',
          country: 'US',
          start_date: '2026-08-30',
          end_date: '2026-08-31',
        }]), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    });
    vi.stubGlobal('fetch', fetcher);

    await expect(loadMobileWcaCompetitions('en')).rejects.toThrow(
      'competition indexes unavailable',
    );
    await expect(loadMobileWcaCompetitions('en')).resolves.toMatchObject([{
      id: 'RetryComp2026',
      displayName: 'Retry Comp',
      selectedDisplayName: 'Retry Comp 2026',
    }]);
    // The successful optional translation asset is cached independently while
    // only the two failed canonical indexes are retried.
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('uses one localization rule while omitting a date-duplicated year only in candidates', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/comp_names_zh.json')) {
        return new Response(JSON.stringify({
          'Jiajiang Open 2026': '2026WCA夹江魔方公开赛',
        }), { status: 200 });
      }
      if (url.endsWith('/all_past_comps.json')) {
        return new Response(JSON.stringify([{
          id: 'JiajiangOpen2026',
          name: 'Jiajiang Open 2026',
          city: 'Jiajiang, Sichuan',
          country: 'CN',
          start_date: '2026-09-05',
          end_date: '2026-09-06',
        }]), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    }));
    const fresh = await import('./wca-source-adapter');

    await expect(fresh.loadMobileWcaCompetitions('zh')).resolves.toMatchObject([{
      displayName: '夹江公开赛',
      selectedDisplayName: '夹江公开赛2026',
    }]);
  });

  it('rejects duplicate ids inside one generated competition index', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/comp_names_zh.json')) return new Response('{}', { status: 200 });
      if (url.endsWith('/all_past_comps.json')) {
        const duplicate = {
          id: 'DuplicateFixture2026',
          name: 'Duplicate Fixture 2026',
          country: 'US',
          start_date: '2026-08-30',
        };
        return new Response(JSON.stringify([duplicate, duplicate]), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    }));
    const fresh = await import('./wca-source-adapter');

    await expect(fresh.loadMobileWcaCompetitions('en')).rejects.toThrow(
      'all_past_comps.json contains duplicate competition id: DuplicateFixture2026',
    );
  });

  it('allows cross-source overlap and lets the upcoming row win', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/comp_names_zh.json')) return new Response('{}', { status: 200 });
      const shared = {
        id: 'OverlapFixture2026',
        city: 'Seattle',
        country: 'US',
        start_date: '2026-08-30',
      };
      if (url.endsWith('/all_past_comps.json')) {
        return new Response(JSON.stringify([{
          ...shared,
          name: 'Stale Overlap Fixture 2026',
        }]), { status: 200 });
      }
      return new Response(JSON.stringify([{
        ...shared,
        name: 'Fresh Overlap Fixture 2026',
      }]), { status: 200 });
    }));
    const fresh = await import('./wca-source-adapter');

    await expect(fresh.loadMobileWcaCompetitions('en')).resolves.toMatchObject([{
      id: 'OverlapFixture2026',
      displayName: 'Fresh Overlap Fixture',
      selectedDisplayName: 'Fresh Overlap Fixture 2026',
    }]);
  });
});
