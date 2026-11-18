import { fillPlatformParams, matchPlatformRoute, resolvePlatformCanonicalPath, PLATFORM_ROUTES } from './platform-routes';
import type { PlatformLocaleText, PlatformRouteDefinition } from './platform-types';

export type PlatformPrimary = 'discover' | 'courses' | 'community' | 'teachers' | 'organizations';
type NavItem = { id: string; href: string; label: PlatformLocaleText };
const item = (id: string, href: string, zh: string, en: string): NavItem => ({ id, href, label: { zh, en } });

export const PLATFORM_SECTION_NAV: Record<PlatformPrimary, readonly NavItem[]> = {
  discover: [item('home', '/platform', '推荐', 'Recommended'), item('events', '/platform/events', '活动', 'Events'), item('news', '/platform/news', '资讯', 'News')],
  courses: [item('courses', '/platform/courses', '全部课程', 'All courses'), item('paths', '/platform/paths', '学习路径', 'Learning paths'), item('membership', '/platform/membership', '课程会员', 'Course membership')],
  community: [item('community-feed', '/platform/community/feed', '动态', 'Feed'), item('community', '/platform/community', '版块', 'Boards'), item('leaderboard', '/platform/leaderboard', '学习榜', 'Learning leaderboard')],
  teachers: [item('teachers', '/platform/teachers', '讲师名录', 'Teacher directory'), item('teacher-apply', '/platform/teachers/apply', '讲师入驻', 'Teach with us')],
  organizations: [item('org', '/platform/org', '机构工作台', 'Organization workspace')],
};

export function platformPathname(pathname: string): string {
  return pathname.replace(/^\/(en|zh)(?=\/|$)/, '').split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
}

export function platformNavigationState(pathname: string): {
  primary: PlatformPrimary | null; secondary: string | null; definition?: PlatformRouteDefinition;
} {
  const path = platformPathname(pathname);
  const segments = path.replace(/^\/platform\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const definition = path === '/platform' || path.startsWith('/platform/') ? matchPlatformRoute(segments)?.definition : undefined;
  let primary: PlatformPrimary | null = null;
  let secondary: string | null = null;
  if (segments[0] === 'teachers') { primary = 'teachers'; secondary = segments[1] === 'apply' ? 'teacher-apply' : 'teachers'; }
  else if (definition?.area === 'organization') { primary = 'organizations'; secondary = 'org'; }
  else if (definition?.area === 'community') {
    primary = 'community';
    secondary = definition.id === 'leaderboard' ? 'leaderboard' : definition.id === 'community-feed' ? 'community-feed'
      : ['community-mine', 'community-search', 'community-review'].includes(definition.id) ? null : 'community';
  } else if (['courses', 'paths', 'membership'].includes(segments[0])) {
    primary = 'courses'; secondary = segments[0];
  } else if (definition?.area === 'discover') {
    primary = 'discover'; secondary = segments[0] === 'events' ? 'events' : segments[0] === 'news' ? 'news' : 'home';
  }
  return { primary, secondary, definition };
}

export function isPlatformSharedRoute(definition?: PlatformRouteDefinition): boolean {
  return definition?.kind === 'canonical' && (definition.area === 'community' || definition.area === 'organization'
    || definition.pattern.startsWith('teachers'));
}

/** Canonical path for existing clients that derive a sentinel ID or active item from the browser URL. */
export function platformSharedPathname(pathname: string): string {
  const path = platformPathname(pathname);
  if (!path.startsWith('/platform/')) return path;
  const segments = path.slice('/platform/'.length).split('/').map(decodeURIComponent);
  return resolvePlatformCanonicalPath(segments)?.path.split('?', 1)[0] ?? path;
}

// Inverse of the existing rewrite catalog. More specific destinations precede catch-alls.
const sharedRoutes = PLATFORM_ROUTES.filter(isPlatformSharedRoute).toSorted((a, b) => {
  const score = (route: PlatformRouteDefinition) => (route.canonicalHref?.split(/[/?]/).filter(part => part && !part.startsWith(':')).length ?? 0) * 10
    + (route.canonicalHref?.includes('?') ? 2 : 0) - (route.canonicalHref?.includes('*') ? 1 : 0);
  return score(b) - score(a);
});

/** Keep shared product navigation in Platform; auth, tools and external links retain their destination. */
export function platformNavigationHref(href: string): string {
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/\\')) return href;
  const prefix = href.match(/^\/(en|zh)(?=\/|$)/)?.[0] ?? '';
  const url = new URL(href.slice(prefix.length) || '/', 'https://platform.invalid');
  for (const route of sharedRoutes) {
    const [template, query] = route.canonicalHref!.split('?');
    const parts = template.split('/').filter(Boolean);
    const actual = url.pathname.split('/').filter(Boolean);
    if (parts.at(-1)?.endsWith('*') ? actual.length < parts.length : actual.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let matches = true;
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      if (part.startsWith(':')) {
        params[part.replace(/^:|\*$/g, '')] = part.endsWith('*')
          ? actual.slice(index).map(decodeURIComponent).join('/') : decodeURIComponent(actual[index]);
      } else if (part !== actual[index]) { matches = false; break; }
    }
    if (!matches) continue;
    const remaining = new URLSearchParams(url.search);
    for (const [key, value] of new URLSearchParams(query)) {
      const actualValue = remaining.get(key);
      if (value.startsWith(':') && actualValue) params[value.slice(1)] = actualValue;
      else if (actualValue !== value) { matches = false; break; }
      remaining.delete(key);
    }
    if (!matches) continue;
    const search = remaining.toString();
    return `${prefix}/platform/${fillPlatformParams(route.pattern, params)}${search ? `?${search}` : ''}${url.hash}`;
  }
  return href;
}
