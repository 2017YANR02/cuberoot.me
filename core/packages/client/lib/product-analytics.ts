'use client';

import { ANALYTICS_ACTION_FEATURES, ANALYTICS_BATCH_SIZE, ANALYTICS_UUID, analyticsPage, type AnalyticsAction, type ProductAnalyticsEvent } from '@cuberoot/shared/product-analytics';
import { apiUrl } from './api-base';
import { getOwnerKey, getRolePreview, getSessionToken } from './auth-store';
import { sessionFetch } from './session-fetch';
import { peekWebAccessToken } from './web-session';
import { setAnalyticsFeatureReceiver } from './analytics-signal';
export { trackFeatureUse } from './analytics-signal';

type Snapshot = { ready: boolean; enabled: boolean };
type Session = { owner: string; subjectToken: string; sessionId: string; touched: number };
const SESSION_KEY = 'cuberoot:analytics:session:v1';
const IDLE_MS = 30 * 60_000;
let snapshot: Snapshot = { ready: false, enabled: false };
const listeners = new Set<() => void>();
let session: Session | null = null;
let generation = 0;
let controller: AbortController | null = null;
let queued: ProductAnalyticsEvent[] = [];
let sending = false;
let drainKeepalive = false;
const deferred = new Set<() => void>();
let failures = 0;
let retryAfter = 0;
type Attribution = Pick<ProductAnalyticsEvent, 'sourceViewId' | 'sourcePlacement' | 'sourcePosition'>;
let page: { value: NonNullable<ReturnType<typeof analyticsPage>>; path: string; viewId: string; entryPoint: ProductAnalyticsEvent['entryPoint']; attribution: Attribution } | null = null;
let pendingEntry: { feature: string; source: 'home' | 'search'; at: number; attribution: Attribution } | null = null;
const used = new Set<string>();

export const subscribeAnalytics = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const analyticsSnapshot = () => snapshot;
const serverSnapshot: Snapshot = { ready: false, enabled: false };
export const analyticsServerSnapshot = () => serverSnapshot;
function publish(next: Snapshot) {
  snapshot = next;
  setAnalyticsFeatureReceiver(next.enabled ? deferFeatureUse : null);
  listeners.forEach(listener => listener());
}
function saveSession() { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* memory-only session */ } }

export function analyticsEnvironmentAllowed(): boolean {
  if (typeof window === 'undefined' || window.parent !== window || getRolePreview()) return false;
  if (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false;
  return ['cuberoot.me', 'www.cuberoot.me'].includes(location.hostname)
    || process.env.NEXT_PUBLIC_PRODUCT_ANALYTICS_DEV === '1';
}

async function request(path: string, body: Record<string, unknown>, keepalive = false) {
  const marker = getSessionToken();
  // Automatic telemetry must not initiate/join a shared authentication refresh.
  const credential = peekWebAccessToken(marker);
  if (marker && !credential) throw new Error('analytics_credentials_not_ready');
  const local = new AbortController();
  const parent = controller?.signal;
  const abort = () => local.abort();
  parent?.addEventListener('abort', abort, { once: true });
  if (parent?.aborted) abort();
  const timeout = setTimeout(abort, 8000);
  try {
    return await sessionFetch(apiUrl(`/v1/platform/analytics/${path}`), {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
      body: JSON.stringify(body), signal: local.signal, keepalive, priority: 'low',
    });
  } finally { clearTimeout(timeout); parent?.removeEventListener('abort', abort); }
}

/** Start default collection after hydration; account changes isolate the queue. */
export async function initializeAnalytics(): Promise<void> {
  const run = ++generation;
  controller?.abort(); controller = new AbortController();
  queued = []; deferred.clear(); drainKeepalive = false; failures = 0; retryAfter = 0; sending = false; page = null; used.clear(); pendingEntry = null;
  publish({ ready: false, enabled: false });
  if (!analyticsEnvironmentAllowed()) { publish({ ready: true, enabled: false }); return; }
  try {
    const owner = getOwnerKey() || 'anonymous';
    let saved: Session | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') as Session | null; } catch { /* fresh session */ }
    const fresh = !saved || saved.owner !== owner || !ANALYTICS_UUID.test(saved.subjectToken) || !ANALYTICS_UUID.test(saved.sessionId)
      || !Number.isFinite(saved.touched) || Date.now() - saved.touched >= IDLE_MS;
    session = fresh ? { owner, subjectToken: crypto.randomUUID(), sessionId: crypto.randomUUID(), touched: Date.now() } : saved;
    saveSession();
    publish({ ready: true, enabled: true });
  } catch { if (run === generation) publish({ ready: true, enabled: false }); }
}

export function stopAnalytics(): void {
  ++generation; controller?.abort(); queued = []; deferred.clear(); sending = false; page = null; used.clear();
  publish({ ready: false, enabled: false });
}

function active(): boolean {
  if (!snapshot.enabled || !session || !analyticsEnvironmentAllowed() || document.visibilityState !== 'visible') return false;
  if (session.owner !== (getOwnerKey() || 'anonymous')) { void initializeAnalytics(); return false; }
  if (Date.now() - session.touched >= IDLE_MS) {
    const path = page?.path ?? window.location.pathname;
    void initializeAnalytics(); analyticsNavigate(path);
    return snapshot.enabled;
  }
  if (Date.now() - session.touched >= 10_000) { session.touched = Date.now(); saveSession(); }
  return true;
}

export function analyticsActivity(): void {
  if (active() && !page) analyticsNavigate(window.location.pathname);
}

/** A meaningful interaction is distinct from a successful instrumented operation. */
export function trackPageInteraction(): void {
  if (!active() || !page || used.has('interaction')) return;
  used.add('interaction');
  trackAnalytics('web.feature_interaction');
}

export function analyticsNavigate(pathname: string): void {
  try {
    if (!active()) return;
    // window pathname resolves static sentinel rewrites. Query changes are not page views.
    const path = pathname.split(/[?#]/)[0]!;
    if (page?.path === path) return;
    const previous = page;
    const value = analyticsPage(path);
    page = null; used.clear();
    if (!value) return;
    let entryPoint: ProductAnalyticsEvent['entryPoint'] = previous ? 'internal' : 'direct';
    let attribution: Attribution = {};
    if (pendingEntry && pendingEntry.feature === value.feature && Date.now() - pendingEntry.at < 30_000) {
      entryPoint = pendingEntry.source; attribution = pendingEntry.attribution;
    }
    else if (!previous && document.referrer) {
      try { entryPoint = new URL(document.referrer).origin === location.origin ? 'internal' : 'external'; } catch { /* no raw referrer leaves browser */ }
    }
    pendingEntry = null;
    page = { value, path, viewId: crypto.randomUUID(), entryPoint, attribution };
    trackAnalytics('web.page_view');
  } catch { page = null; /* A page must still render if telemetry is unavailable. */ }
}

export function trackAnalytics(name: ProductAnalyticsEvent['name'], extra: Partial<Pick<ProductAnalyticsEvent, 'entryId' | 'placement' | 'position' | 'layoutVersion' | 'action'>> = {}): void {
  try {
    if (!active() || !page) return;
    enqueueEvent(name, extra, page);
  } catch { /* Telemetry errors never reach product event handlers. */ }
}

function enqueueEvent(name: ProductAnalyticsEvent['name'], extra: Partial<ProductAnalyticsEvent>, target: NonNullable<typeof page>, occurredAt = new Date().toISOString()) {
  queued.push({ id: crypto.randomUUID(), name, occurredAt, viewId: target.viewId,
      ...target.value, language: /^\/zh(?:\/|$)/.test(target.path) ? 'zh' : 'en',
      deviceClass: matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop', entryPoint: target.entryPoint, ...target.attribution, ...extra });
  if (queued.length > 200) queued.shift();
  if (queued.length >= ANALYTICS_BATCH_SIZE) void flushAnalytics();
}

export function analyticsEntryTarget(feature: string, placement: NonNullable<ProductAnalyticsEvent['placement']>, position: number): void {
  if (snapshot.enabled && page) pendingEntry = { feature, source: placement === 'search' ? 'search' : 'home', at: Date.now(),
    attribution: { sourceViewId: page.viewId, sourcePlacement: placement, sourcePosition: position } };
}

/** Core operations do only in-memory deduplication and schedule idle work. */
function deferFeatureUse(action: AnalyticsAction): void {
  if (!page || used.has(action) || page.value.feature !== ANALYTICS_ACTION_FEATURES[action]) return;
  const target = page;
  const occurredAt = new Date().toISOString();
  const run = generation;
  used.add(action);
  const collect = () => {
    if (!deferred.delete(collect)) return;
    try {
      if (run === generation && snapshot.enabled) enqueueEvent('web.feature_use', { action }, target, occurredAt);
    } catch { /* Prefer losing telemetry over interrupting the tool. */ }
  };
  deferred.add(collect);
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(collect, { timeout: 2000 });
  else setTimeout(collect, 0);
}

export async function flushAnalytics(keepalive = false): Promise<void> {
  if (keepalive) drainKeepalive = true;
  for (const collect of deferred) collect();
  if (sending || !snapshot.enabled || !session || !queued.length || Date.now() < retryAfter) return;
  if (session.owner !== (getOwnerKey() || 'anonymous')) { queued = []; return; }
  // Wait for normal login refresh; never spend delivery retries on missing credentials.
  const marker = getSessionToken();
  if (marker && !peekWebAccessToken(marker)) return;
  const run = generation;
  queued = queued.filter(event => Date.parse(event.occurredAt) > Date.now() - 14 * 60_000);
  const batch = queued.splice(0, ANALYTICS_BATCH_SIZE);
  if (!batch.length) return;
  sending = true;
  try {
    const response = await request('events', { subjectToken: session.subjectToken, sessionId: session.sessionId, events: batch }, drainKeepalive);
    if (run !== generation) return;
    if (response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500) throw new Error('retry');
    failures = 0; retryAfter = 0; // Other 4xx batches are dropped, never retried unchanged.
  } catch {
    if (run === generation && failures++ < 2) {
      queued = [...batch, ...queued].slice(0, 200);
      retryAfter = Date.now() + failures * 15_000;
    }
  } finally {
    if (run === generation) {
      sending = false;
      if (queued.length && Date.now() >= retryAfter) await flushAnalytics(drainKeepalive);
      else if (!queued.length) drainKeepalive = false;
    }
  }
}
