import { safeNext } from './safe-next';

const BASE = 'https://cuberoot.invalid';
export const ENTRY_NAVIGATION_KEY = 'navBack';
const MAX_DEPTH = 8;
const MAX_CONTEXT_LENGTH = 4096;
const STATE_KEYS = new Set(['q', 'tab', 'page', 'sort', 'event', 'eventId', 'country', 'region', 'year', 'view', 'settings', 'section', 'pet', 'puzzle', 'category', 'teacher', 'id']);
const LEGACY_KEYS = ['accountBack', 'accountEntry', 'shopBack', 'shopEntry'];
const EXCLUDED = /^\/(?:api|v1|auth|_next|stats|tools|icons|images|fonts|contact\/[^/]+\.[^/]+)(?:\/|$)/;
const bare = (path: string) => path.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
function parse(raw: string): URL | null {
  const path = safeNext(raw);
  if (!path) return null;
  const url = new URL(path, BASE);
  if (EXCLUDED.test(bare(url.pathname)) || /\.[a-z0-9]{2,8}$/i.test(url.pathname)) return null;
  url.pathname = url.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  return url;
}
function pathOf(url: URL) { return url.pathname + url.search + url.hash; }
function samePage(a: URL, b: URL) {
  return bare(a.pathname).replace(/\/$/, '') === bare(b.pathname).replace(/\/$/, '')
    && a.searchParams.get('id') === b.searchParams.get('id');
}

/** Store only navigation state. Auth, payments, private document/share tokens and nested continuations never enter the trail. */
function snapshot(url: URL): string | null {
  if (/^\/(?:calendar\/s|docs\/s|sheets\/s|share|q)(?:\/|$)/.test(bare(url.pathname))) return null;
  const clean = new URL(url.pathname, BASE);
  if (bare(url.pathname) === '/chat' && url.searchParams.has('settings')) clean.pathname = url.pathname.startsWith('/zh/') ? '/zh/account' : '/account';
  for (const [key, value] of url.searchParams) {
    if (STATE_KEYS.has(key) && value.length <= 200) clean.searchParams.append(key, value);
  }
  if (/^#[a-zA-Z0-9_%:/.-]{1,160}$/.test(url.hash)) clean.hash = url.hash;
  return pathOf(clean);
}
function legacyTrail(url: URL): string[] {
  for (const [backKey, entryKey, root] of [['accountBack', 'accountEntry', '/account'], ['shopBack', 'shopEntry', '/shop']]) {
    const back = parse(url.searchParams.get(backKey) ?? '');
    const entry = parse(url.searchParams.get(entryKey) ?? '');
    if (!back || bare(back.pathname) !== root || !entry) continue;
    const path = bare(url.pathname), entryPath = bare(entry.pathname).replace(/\/$/, '');
    if (path !== entryPath && !path.startsWith(entryPath + '/')) continue;
    const result = [snapshot(back), samePage(url, entry) ? null : snapshot(entry)].filter((value): value is string => !!value);
    return result;
  }
  return [];
}
function trail(url: URL): string[] {
  const raw = url.searchParams.get(ENTRY_NAVIGATION_KEY);
  if (!raw) return legacyTrail(url);
  if (raw.length > MAX_CONTEXT_LENGTH) return [];
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values) || values.length > MAX_DEPTH) return [];
    const result: string[] = [];
    for (const value of values) {
      if (typeof value !== 'string' || value.length > 1024) return [];
      const parsed = parse(value);
      const clean = parsed && snapshot(parsed);
      if (!clean) return [];
      if (!samePage(parsed!, url) && !result.includes(clean)) result.push(clean);
    }
    return result;
  } catch { return []; }
}
function withTrail(target: URL, entries: string[]): string {
  target.searchParams.delete(ENTRY_NAVIGATION_KEY);
  for (const key of LEGACY_KEYS) target.searchParams.delete(key);
  const bounded = entries.slice(-MAX_DEPTH);
  while (bounded.length && JSON.stringify(bounded).length > MAX_CONTEXT_LENGTH) bounded.shift();
  if (bounded.length) target.searchParams.set(ENTRY_NAVIGATION_KEY, JSON.stringify(bounded));
  return pathOf(target);
}

export type EntryNavigationMode = 'push' | 'replace' | 'back' | 'return' | 'none';

/** One contract for links, imperative navigation and native anchors. No browser history mutation or global last-page storage. */
export function entryNavigationHref(href: string, current: string, mode: EntryNavigationMode = 'push'): string {
  if (mode === 'back') return entryNavigationBack(current) ?? href;
  if (mode === 'none' || mode === 'return') return href;
  const target = parse(href), source = parse(current);
  if (!target || !source) return href;
  // A deliberate Home/brand link leaves the current navigation journey.
  if (bare(target.pathname) === '/') return withTrail(target, []);
  let entries = trail(source);
  const existing = entries.findIndex(entry => samePage(parse(entry)!, target));
  if (existing >= 0) entries = entries.slice(0, existing);
  else if (mode === 'push' && !samePage(source, target)) {
    const origin = snapshot(source);
    if (origin) entries.push(origin);
  }
  // Login/upgrade continuations resume the product journey, not a login-to-product loop.
  const next = target.searchParams.get('next');
  if (next && ['/account', '/membership'].includes(bare(target.pathname))) {
    const destination = parse(next);
    if (destination && !['/account', '/membership'].includes(bare(destination.pathname))) {
      target.searchParams.set('next', entryNavigationHref(next, current, samePage(destination, source) ? 'replace' : mode));
    }
  }
  return withTrail(target, entries);
}

/** The recorded entry wins; without provenance the caller retains its explicit hierarchy fallback. */
export function entryNavigationBack(current: string, _parentHref = '/'): string | null {
  const source = parse(current);
  if (!source) return null;
  const entries = trail(source);
  const previous = entries.pop();
  return previous ? withTrail(parse(previous)!, entries) : null;
}

/** Event-only adapter for full-page navigation and new-tab links. Safe during SSR. */
export function currentEntryHref(href: string, mode: EntryNavigationMode = 'push'): string {
  return typeof window === 'undefined' ? href : entryNavigationHref(href, window.location.pathname + window.location.search + window.location.hash, mode);
}
