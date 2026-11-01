import { safeNext } from './safe-next';

const BASE = 'https://cuberoot.invalid';
const bare = (path: string) => path.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
const ENTRY = /^\/(?:friends|pets|vault|notifications|membership|learn|org|alg\/progress|admin\/team|dev\/team|account\/(?:verify|mcp)|wca\/persons\/[^/]+|recon\/person\/[^/]+)\/?$/;
const RETURN = 'accountBack';
const ROOT = 'accountEntry';
function parse(raw: string) { const path = safeNext(raw); return path ? new URL(path, BASE) : null; }
function entryPath(url: URL) {
  const clean = new URL(url.pathname, BASE);
  for (const key of ['pet', 'section']) {
    const value = url.searchParams.get(key);
    if (value && /^[a-z0-9-]+$/.test(value)) clean.searchParams.set(key, value);
  }
  return clean.pathname + clean.search;
}
function context(url: URL): { back: string; entry: string } | null {
  const back = parse(url.searchParams.get(RETURN) ?? '');
  const entry = parse(url.searchParams.get(ROOT) ?? '');
  if (!back || bare(back.pathname) !== '/account' || !entry || !ENTRY.test(bare(entry.pathname))) return null;
  const clean = new URL(back.pathname, BASE);
  for (const key of ['settings', 'view']) {
    const value = back.searchParams.get(key);
    if (value && /^[a-z]+$/.test(value)) clean.searchParams.set(key, value);
  }
  return { back: clean.pathname + clean.search, entry: entryPath(entry) };
}
function related(path: string, entry: string) {
  const target = bare(path), root = bare(parse(entry)!.pathname).replace(/\/$/, '');
  return target === root || target.startsWith(root + '/')
    || root === '/dev/team' && target === '/admin/team';
}

/** Only account product entries get a continuation; auth and payment state never travel with it. */
export function accountNavigationHref(href: string, current: string): string {
  const target = parse(href), source = parse(current);
  if (!target || !source) return href;
  const sourcePath = bare(source.pathname);
  let origin = context(source);
  if (sourcePath === '/account' || sourcePath === '/chat' && source.searchParams.has('settings')) {
    if (!ENTRY.test(bare(target.pathname))) return href;
    const back = new URL(source.pathname.startsWith('/zh/') ? '/zh/account' : '/account', BASE);
    for (const key of ['settings', 'view']) {
      const value = source.searchParams.get(key);
      if (value && /^[a-z]+$/.test(value)) back.searchParams.set(key, value);
    }
    origin = { back: back.pathname + back.search, entry: entryPath(target) };
  } else if (!origin || !related(source.pathname, origin.entry) || !related(target.pathname, origin.entry)) return href;
  // The old handbook redirects into the same workspace; keep its root canonical.
  const entry = bare(target.pathname) === '/admin/team' && bare(parse(origin.entry)!.pathname) === '/dev/team' ? entryPath(target) : origin.entry;
  target.searchParams.set(RETURN, origin.back);
  target.searchParams.set(ROOT, entry);
  return target.pathname + target.search + target.hash;
}

export function accountNavigationBack(current: string, parentHref = '/'): string | null {
  const url = parse(current);
  if (!url) return null;
  const origin = context(url);
  if (!origin || !related(url.pathname, origin.entry)) return null;
  if (bare(url.pathname).replace(/\/$/, '') === bare(parse(origin.entry)!.pathname).replace(/\/$/, '')) return origin.back;
  const parent = parse(parentHref);
  const parentPath = parent && bare(parent.pathname).replace(/\/$/, '');
  // A deeper page must visit its own parent before returning to the account entry.
  if (parent && parentPath && related(parent.pathname, origin.entry)
    && parentPath !== bare(parse(origin.entry)!.pathname).replace(/\/$/, '')
    && bare(url.pathname).startsWith(parentPath + '/')) {
    return accountNavigationHref(parentHref, current);
  }
  return accountNavigationHref(origin.entry, current);
}
