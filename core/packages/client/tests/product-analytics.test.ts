// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ owner: '', marker: '' }));
const network = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-store', () => ({ getOwnerKey: () => auth.owner, getSessionToken: () => auth.marker, getRolePreview: () => null, useAuthUser: () => null }));
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: network }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
import { analyticsNavigate, analyticsSnapshot, flushAnalytics, initializeAnalytics, setAnalyticsEnabled, stopAnalytics, trackFeatureUse } from '@/lib/product-analytics';
import { observeAnalyticsEntries } from '@/components/ProductAnalytics';

describe('optional browser analytics', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_PRODUCT_ANALYTICS_DEV', '1');
    localStorage.clear(); sessionStorage.clear(); auth.owner = ''; auth.marker = '';
    network.mockReset(); network.mockImplementation(async () => new Response(JSON.stringify({ enabled: true }), { status: 200 }));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });
  afterEach(() => { stopAnalytics(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); document.body.innerHTML = ''; });

  it('has no event queue or request before consent; normalizes URLs and deduplicates use', async () => {
    await initializeAnalytics(); analyticsNavigate('/zh/timer'); trackFeatureUse('timer_solve'); await flushAnalytics();
    expect(network).toHaveBeenCalledTimes(0);
    await setAnalyticsEnabled(true);
    analyticsNavigate('/zh/timer?secret=private'); analyticsNavigate('/zh/timer?secret=other');
    vi.useFakeTimers();
    trackFeatureUse('timer_solve'); trackFeatureUse('timer_solve'); trackFeatureUse('sim_move');
    await vi.advanceTimersByTimeAsync(0);
    await flushAnalytics();
    const batch = JSON.parse(network.mock.calls.find(call => String(call[0]).endsWith('/events'))![1].body);
    expect(batch.events.map((e: { name: string }) => e.name)).toEqual(['web.page_view', 'web.feature_use']);
    expect(batch.events[0].route).toBe('/timer');
    expect(JSON.stringify(batch)).not.toContain('private');
    await setAnalyticsEnabled(false); network.mockClear(); trackFeatureUse('timer_solve'); await flushAnalytics();
    expect(network).toHaveBeenCalledTimes(0);
  });

  it('retries with identical event IDs and stops after server revocation', async () => {
    await initializeAnalytics(); await setAnalyticsEnabled(true); analyticsNavigate('/timer');
    network.mockResolvedValueOnce(new Response('', { status: 503 }));
    await flushAnalytics();
    const first = JSON.parse(network.mock.calls.at(-1)![1].body);
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 16_000);
    network.mockResolvedValueOnce(new Response('', { status: 403 }));
    await flushAnalytics();
    expect(JSON.parse(network.mock.calls.at(-1)![1].body)).toEqual(first);
    expect(analyticsSnapshot().enabled).toBe(false);
  });

  it('does not transfer anonymous authorization to a signed-in account', async () => {
    await initializeAnalytics(); await setAnalyticsEnabled(true);
    analyticsNavigate('/timer');
    auth.owner = 'u1'; auth.marker = 'fixture';
    network.mockClear(); await flushAnalytics();
    expect(network).toHaveBeenCalledTimes(0);
    network.mockResolvedValueOnce(new Response(JSON.stringify({ enabled: false })));
    await initializeAnalytics();
    expect(String(network.mock.calls.at(-1)![0])).toMatch(/status$/);
    expect(analyticsSnapshot().enabled).toBe(false);
  });

  it('defers core-operation telemetry and contains collector failures', async () => {
    await initializeAnalytics(); await setAnalyticsEnabled(true); analyticsNavigate('/timer');
    network.mockClear(); vi.useFakeTimers();
    const uuid = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('collector unavailable'); });
    try {
      // Neither UUID generation nor networking runs in the operation's call stack.
      expect(() => trackFeatureUse('timer_solve')).not.toThrow();
      expect(uuid).toHaveBeenCalledTimes(0); expect(network).toHaveBeenCalledTimes(0);
      await vi.advanceTimersByTimeAsync(0);
      expect(uuid).toHaveBeenCalledTimes(1);
      expect(analyticsSnapshot().enabled).toBe(true);
    } finally { uuid.mockRestore(); }
  });

  it('aborts a stalled background request without affecting product state', async () => {
    await initializeAnalytics(); await setAnalyticsEnabled(true); analyticsNavigate('/timer');
    vi.useFakeTimers();
    network.mockImplementationOnce((_path, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new Error('timed out')), { once: true });
    }));
    const pending = flushAnalytics();
    await vi.advanceTimersByTimeAsync(8000);
    await expect(pending).resolves.toBeUndefined();
    expect(analyticsSnapshot().enabled).toBe(true);
  });

  it('never initiates session refresh for background status or events', async () => {
    auth.owner = 'u1'; auth.marker = 'web-session:uncached-fixture';
    await initializeAnalytics();
    expect(network).toHaveBeenCalledTimes(0);
    await setAnalyticsEnabled(true); // An explicit settings action can authenticate.
    network.mockClear(); analyticsNavigate('/timer'); await flushAnalytics();
    expect(network).toHaveBeenCalledTimes(0);
    expect(analyticsSnapshot().enabled).toBe(true);
  });

  it('requires continuous visible exposure and excludes editor/admin regions', async () => {
    await initializeAnalytics(); await setAnalyticsEnabled(true); analyticsNavigate('/');
    document.body.innerHTML = '<div data-analytics-placement="main"><a data-analytics-entry="timer" href="/timer">Timer</a></div><div data-analytics-placement="tool" data-analytics-disabled="true"><a data-analytics-entry="sim">Sim</a></div>';
    let notify: IntersectionObserverCallback;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe() {} unobserve() {} disconnect() {}
    });
    vi.useFakeTimers();
    const cleanup = observeAnalyticsEntries();
    const target = document.querySelector('a')!;
    const entry = (element: Element, ratio: number): IntersectionObserverEntry => ({ target: element, intersectionRatio: ratio, isIntersecting: ratio > 0,
      boundingClientRect: element.getBoundingClientRect(), intersectionRect: element.getBoundingClientRect(), rootBounds: null, time: 0 });
    const visibility = (ratio: number) => notify!([entry(target, ratio)], {} as IntersectionObserver);
    visibility(0.6); vi.advanceTimersByTime(600); visibility(0.4); vi.advanceTimersByTime(1000);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange')); visibility(1); vi.advanceTimersByTime(1000);
    await flushAnalytics();
    expect(JSON.parse(network.mock.calls.at(-1)![1].body).events).toHaveLength(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(1000);
    notify!([entry(document.querySelectorAll('a')[1]!, 1)], {} as IntersectionObserver);
    vi.advanceTimersByTime(1000); await flushAnalytics();
    expect(JSON.parse(network.mock.calls.at(-1)![1].body).events.map((e: { name: string }) => e.name)).toEqual(['web.entry_impression']);
    cleanup();
  });
});
