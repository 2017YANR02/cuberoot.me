'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { ANALYTICS_ENTRY_IDS, ANALYTICS_PLACEMENTS, HOME_ANALYTICS_LAYOUT, analyticsPage, type ProductAnalyticsEvent } from '@cuberoot/shared/product-analytics';
import { useAuthUser } from '@/lib/auth-store';
import { subscribeWebSession } from '@/lib/web-session';
import { analyticsActivity, analyticsEntryTarget, analyticsNavigate, analyticsServerSnapshot, analyticsSnapshot, flushAnalytics, initializeAnalytics, stopAnalytics, subscribeAnalytics, trackAnalytics } from '@/lib/product-analytics';

export function observeAnalyticsEntries(root: Document = document): () => void {
  const seen = new Set<string>();
  const clicked = new Set<string>();
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const ratios = new Map<Element, number>();
  const metadata = (element: Element) => {
    const entryId = element.getAttribute('data-analytics-entry');
    const group = element.closest('[data-analytics-placement]');
    const placement = group?.getAttribute('data-analytics-placement') as ProductAnalyticsEvent['placement'];
    if (!entryId || !ANALYTICS_ENTRY_IDS.includes(entryId) || !placement || !ANALYTICS_PLACEMENTS.includes(placement)
      || element.closest('[data-analytics-disabled="true"], [hidden], [aria-disabled="true"]')) return null;
    const positionRoot = group === element ? group.parentElement : group;
    const position = [...positionRoot!.querySelectorAll('[data-analytics-entry]')].indexOf(element);
    return { entryId, placement, position, layoutVersion: HOME_ANALYTICS_LAYOUT } as const;
  };
  const key = (data: NonNullable<ReturnType<typeof metadata>>) => `${data.placement}:${data.entryId}:${data.position}`;
  const expose = (element: Element) => {
    const data = metadata(element);
    if (!data || seen.has(key(data)) || root.visibilityState !== 'visible') return;
    seen.add(key(data)); trackAnalytics('web.entry_impression', data);
  };
  const schedule = (element: Element) => {
    if (timers.has(element) || root.visibilityState !== 'visible' || (ratios.get(element) ?? 0) < 0.5) return;
    const data = metadata(element);
    if (!data || seen.has(key(data))) return;
    timers.set(element, setTimeout(() => { timers.delete(element); if (element.isConnected && (ratios.get(element) ?? 0) >= 0.5) expose(element); }, 1000));
  };
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    for (const entry of entries) {
      ratios.set(entry.target, entry.intersectionRatio);
      if (entry.intersectionRatio >= 0.5) schedule(entry.target);
      else { clearTimeout(timers.get(entry.target)); timers.delete(entry.target); }
    }
  }, { threshold: [0, 0.5] });
  const scan = () => {
    for (const element of root.querySelectorAll('[data-analytics-entry]')) {
      if (!ratios.has(element)) { ratios.set(element, 0); observer?.observe(element); }
      else schedule(element);
    }
    for (const element of ratios.keys()) if (!element.isConnected) {
      observer?.unobserve(element); ratios.delete(element); clearTimeout(timers.get(element)); timers.delete(element);
    }
  };
  const mutation = new MutationObserver(scan);
  mutation.observe(root.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-analytics-entry', 'data-analytics-disabled', 'hidden'] }); scan();
  const visibility = () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    if (root.visibilityState === 'visible') ratios.forEach((_ratio, element) => schedule(element));
  };
  const click = (event: MouseEvent) => {
    if (!event.isTrusted || (event.type === 'click' ? event.button !== 0 : event.button !== 1)) return;
    const element = (event.target instanceof Element ? event.target : null)?.closest('a[data-analytics-entry]');
    if (!element) return;
    const data = metadata(element);
    if (!data) return;
    // A deliberate click is itself evidence of exposure, including clicks <1 s.
    expose(element);
    if (!clicked.has(key(data))) { clicked.add(key(data)); trackAnalytics('web.entry_click', data); }
    const href = element.getAttribute('href');
    if (href?.startsWith('/') && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
      const destination = analyticsPage(href);
      if (destination) analyticsEntryTarget(destination.feature, data.placement, data.position);
    }
  };
  root.addEventListener('visibilitychange', visibility);
  root.addEventListener('click', click, true); root.addEventListener('auxclick', click, true);
  return () => {
    observer?.disconnect(); mutation.disconnect(); timers.forEach(clearTimeout);
    root.removeEventListener('visibilitychange', visibility);
    root.removeEventListener('click', click, true); root.removeEventListener('auxclick', click, true);
  };
}

/** Mounted once; returns no SSR markup and never reads URL query contents. */
export default function ProductAnalytics() {
  const pathname = usePathname();
  const user = useAuthUser();
  const owner = user?.uid ?? user?.wcaId ?? '';
  const state = useSyncExternalStore(subscribeAnalytics, analyticsSnapshot, analyticsServerSnapshot);
  useEffect(() => {
    void initializeAnalytics();
    const unsubscribeSession = subscribeWebSession(() => {
      const current = analyticsSnapshot();
      if (current.ready && !current.enabled) void initializeAnalytics();
    });
    const refresh = (event: StorageEvent) => { if (event.key?.startsWith('cuberoot:analytics:')) void initializeAnalytics(); };
    window.addEventListener('storage', refresh);
    return () => { unsubscribeSession(); window.removeEventListener('storage', refresh); stopAnalytics(); };
  }, [owner]);
  useEffect(() => {
    if (!state.ready || !state.enabled) return;
    analyticsNavigate(window.location.pathname);
    // DOM observation is only needed for homepage cards/search, never animation
    // trees or result updates in timing/solving/player pages.
    const unobserve = analyticsPage(window.location.pathname)?.feature === 'home' ? observeAnalyticsEntries() : () => {};
    let visibleSeconds = 0;
    let interacted = false;
    let activityPending = false;
    let engaged = false;
    const interact = (event: Event) => { if (event.isTrusted) { interacted = true; activityPending = true; } };
    document.addEventListener('pointerdown', interact, { passive: true });
    document.addEventListener('keydown', interact);
    document.addEventListener('scroll', interact, { passive: true, capture: true });
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') visibleSeconds++;
      if (!engaged && interacted && visibleSeconds >= 30 && document.visibilityState === 'visible') {
        engaged = true; trackAnalytics('web.page_engaged');
      }
    }, 1000);
    const flush = setInterval(() => {
      if (activityPending) { activityPending = false; analyticsActivity(); }
      void flushAnalytics();
    }, 10_000);
    const hide = () => { if (document.visibilityState === 'hidden') void flushAnalytics(true); else analyticsNavigate(window.location.pathname); };
    const leave = () => { void flushAnalytics(true); };
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave);
    return () => {
      unobserve(); clearInterval(tick); clearInterval(flush);
      document.removeEventListener('pointerdown', interact); document.removeEventListener('keydown', interact);
      document.removeEventListener('scroll', interact, true); document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave); void flushAnalytics();
    };
  }, [pathname, state.ready, state.enabled]);
  return null;
}
