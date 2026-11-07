import { safeNext } from './safe-next';

const BASE = 'https://cuberoot.invalid';
const ENTRY_NAVIGATION_KEY = 'navBack'; // Read old shared links once, then remove it.
const HISTORY_KEY = '__cuberootEntry';
const HANDOFF_KEY = 'cuberoot.entry-handoff.v1';
const CHANGE_EVENT = 'cuberoot:entry-navigation';
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
function validatedTrail(values: unknown, url: URL): string[] {
  if (!Array.isArray(values) || values.length > MAX_DEPTH || JSON.stringify(values).length > MAX_CONTEXT_LENGTH) return [];
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string' || value.length > 1024) return [];
    const parsed = parse(value);
    const clean = parsed && snapshot(parsed);
    if (!clean) return [];
    if (!samePage(parsed!, url) && !result.includes(clean)) result.push(clean);
  }
  return result;
}
function urlTrail(url: URL): string[] {
  const raw = url.searchParams.get(ENTRY_NAVIGATION_KEY);
  if (!raw) return legacyTrail(url);
  if (raw.length > MAX_CONTEXT_LENGTH) return [];
  try {
    return validatedTrail(JSON.parse(raw), url);
  } catch { return []; }
}
function cleanUrl(target: URL): string {
  target.searchParams.delete(ENTRY_NAVIGATION_KEY);
  for (const key of LEGACY_KEYS) target.searchParams.delete(key);
  return pathOf(target);
}

export type EntryNavigationMode = 'push' | 'replace' | 'back' | 'return' | 'none';

/** Pure link rendering: provenance must never be serialized into an href. */
export function entryNavigationHref(href: string, current: string, mode: EntryNavigationMode = 'push', depth = 0): string {
  if (mode === 'back') return entryNavigationBack(current) ?? href;
  const target = parse(href);
  if (!target) return href;
  const next = target.searchParams.get('next');
  if (next && depth < MAX_DEPTH && ['/account', '/membership'].includes(bare(target.pathname))) {
    const cleanNext = entryNavigationHref(next, '', 'none', depth + 1);
    if (cleanNext !== next) {
      target.searchParams.set('next', cleanNext);
      return cleanUrl(target);
    }
  }
  // Preserve product payloads and their encoding unless removing old provenance.
  if (![ENTRY_NAVIGATION_KEY, ...LEGACY_KEYS].some(key => target.searchParams.has(key))) return href;
  return cleanUrl(target);
}

const currentPath = () => window.location.pathname + window.location.search + window.location.hash;
function currentTrail(source: URL): string[] {
  const state: unknown = window.history.state?.[HISTORY_KEY];
  return Array.isArray(state) ? validatedTrail(state, source) : urlTrail(source);
}
function nextTrail(target: URL, source: URL | null, mode: EntryNavigationMode): string[] {
  // A deliberate Home/brand link leaves the current navigation journey.
  if (mode === 'none' || bare(target.pathname) === '/' || !source) return [];
  let entries = currentTrail(source);
  const existing = entries.findIndex(entry => samePage(parse(entry)!, target));
  if (existing >= 0) entries = entries.slice(0, existing);
  else if (mode === 'return' || mode === 'back') return [];
  else if (mode === 'push' && !samePage(source, target)
    && !(source.searchParams.has('next') && ['/account', '/membership'].includes(bare(source.pathname)))) {
    const origin = snapshot(source);
    if (origin) entries.push(origin);
  }
  entries = entries.slice(-MAX_DEPTH);
  while (entries.length && JSON.stringify(entries).length > MAX_CONTEXT_LENGTH) entries.shift();
  return entries;
}

/** The recorded entry wins; without provenance the caller retains its explicit hierarchy fallback. */
export function entryNavigationBack(current: string, _parentHref = '/'): string | null {
  const source = parse(current);
  if (!source || typeof window === 'undefined' || current !== currentPath()) return null;
  return currentTrail(source).at(-1) ?? null;
}

type Handoff = { target: string; entries: string[]; expires: number };
let handoffs: Handoff[] = [];
function readHandoffs(): Handoff[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) ?? '[]');
    if (Array.isArray(value)) handoffs = value.slice(0, MAX_DEPTH).filter(item => item
      && typeof item.target === 'string' && typeof item.expires === 'number' && Array.isArray(item.entries));
  } catch { /* Storage-disabled tabs still support client navigation. */ }
  return handoffs.filter(item => item.expires > Date.now());
}
function saveHandoffs(values: Handoff[]) {
  handoffs = values;
  try {
    if (values.length) sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(values));
    else sessionStorage.removeItem(HANDOFF_KEY);
  } catch { /* Browser history remains the source of truth. */ }
}
function takeHandoff(target: URL): string[] | null {
  const values = readHandoffs();
  const index = values.findIndex(item => item.target === snapshot(target));
  if (index < 0) return null;
  const [match] = values.splice(index, 1);
  saveHandoffs(values);
  return validatedTrail(match.entries, target);
}

/** Event-only adapter. A one-use, tab-local handoff also survives full-page navigation. */
export function currentEntryHref(href: string, mode: EntryNavigationMode = 'push'): string {
  const current = typeof window === 'undefined' ? '' : currentPath();
  const clean = entryNavigationHref(href, current, mode);
  const target = parse(clean);
  if (!current || !target) return clean;
  const source = parse(current);
  // Auth callbacks consume the already prepared continuation when the router commits it.
  if (!source) return clean;
  const values: Handoff[] = [];
  let destination: URL | null = target;
  // Retain login/payment continuations locally, leaving the business `next` URL intact.
  for (let depth = 0; destination && depth < MAX_DEPTH; depth++) {
    const path = snapshot(destination);
    if (path) values.push({ target: path, entries: nextTrail(destination, source, mode),
      expires: Date.now() + (values.length ? 2 * 60 * 60 * 1000 : 30_000) });
    if (!['/account', '/membership'].includes(bare(destination.pathname))) break;
    destination = parse(destination.searchParams.get('next') ?? '');
  }
  saveHandoffs(values);
  return clean;
}

export function subscribeEntryNavigation(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}
export function readEntryNavigationBack(): string | null { return entryNavigationBack(currentPath()); }

/** allow-raw-history: shared navigation infrastructure stores metadata, not page query state.
 * Preserve Next/nuqs state and keep each browser history entry independent, including Back/Forward.
 */
export function installEntryNavigation(): () => void {
  const history = window.history;
  const push = history.pushState;
  const replace = history.replaceState;
  let active = true;
  // Next may wrap these methods after this effect; inactive wrappers remain transparent on teardown.
  const notify = () => queueMicrotask(() => { if (active) window.dispatchEvent(new Event(CHANGE_EVENT)); });
  function write(original: History['pushState'], mode: 'push' | 'replace'): History['pushState'] {
    return function (data, unused, raw) {
      if (!active) return original.call(history, data, unused, raw);
      const current = currentPath();
      const url = new URL(raw ?? current, window.location.href);
      const target = url.origin === window.location.origin ? parse(pathOf(url)) : null;
      if (!target) return original.call(history, data, unused, raw);
      const entries = takeHandoff(target) ?? nextTrail(target, parse(current), mode);
      original.call(history, { ...data, [HISTORY_KEY]: entries }, unused, entryNavigationHref(pathOf(url), current));
      notify();
    };
  }
  const wrappedPush = write(push, 'push');
  const wrappedReplace = write(replace, 'replace');
  history.pushState = wrappedPush;
  history.replaceState = wrappedReplace;
  const restore = () => {
    const path = currentPath(), source = parse(path);
    if (source) {
      const entries = Array.isArray(history.state?.[HISTORY_KEY]) ? currentTrail(source) : takeHandoff(source) ?? urlTrail(source);
      const clean = entryNavigationHref(path, path);
      if (clean !== path || JSON.stringify(history.state?.[HISTORY_KEY]) !== JSON.stringify(entries)) {
        replace.call(history, { ...history.state, [HISTORY_KEY]: entries }, '', clean);
      }
    }
    notify();
  };
  restore();
  // eslint-disable-next-line no-restricted-syntax, no-restricted-globals -- per-entry provenance restoration, not page state.
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', notify);
  return () => {
    active = false;
    if (history.pushState === wrappedPush) history.pushState = push;
    if (history.replaceState === wrappedReplace) history.replaceState = replace;
    window.removeEventListener('popstate', restore);
    window.removeEventListener('hashchange', notify);
  };
}
