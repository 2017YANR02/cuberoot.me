import {
  SITE_DIRECTORY_GROUPS,
  type SiteDirectoryEntry,
} from '@cuberoot/shared/site-directory';

function routeKey(entry: SiteDirectoryEntry): string | null {
  if ('miniProgramAction' in entry && entry.miniProgramAction) return null;
  return entry.id === 'algdb' ? 'alg' : entry.id;
}

const websitePathToRouteKey = new Map<string, string>();
for (const group of SITE_DIRECTORY_GROUPS) {
  for (const entry of group.entries) {
    const key = routeKey(entry);
    if (key) websitePathToRouteKey.set(normalizeMiniProgramWebsitePath(entry.href), key);
  }
}

export function normalizeMiniProgramWebsitePath(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || '/';
  let path = pathOnly === '/zh' || pathOnly === '/zh/'
    ? '/'
    : pathOnly.startsWith('/zh/')
      ? pathOnly.slice(3)
      : pathOnly;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path || '/';
}

export function resolveMiniProgramShareRouteKey(pathname: string): string | null {
  const path = normalizeMiniProgramWebsitePath(pathname);
  if (path === '/') return 'home';
  return websitePathToRouteKey.get(path) ?? null;
}
