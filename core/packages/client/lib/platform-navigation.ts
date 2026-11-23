import { fillPlatformParams, matchPlatformRoute, resolvePlatformCanonicalPath, PLATFORM_ROUTES } from './platform-routes';
import type { PlatformLocaleText, PlatformRouteDefinition } from './platform-types';

export type PlatformPrimary = 'discover' | 'courses' | 'teachers' | 'events' | 'organizations' | 'community';
type NavItem = { id: string; href: string; label: PlatformLocaleText };
const item = (id: string, href: string, zh: string, en: string): NavItem => ({ id, href, label: { zh, en } });

export const PLATFORM_SECTION_NAV: Record<PlatformPrimary, readonly NavItem[]> = {
  discover: [],
  events: [item('events', '/platform/events', '全部活动', 'All events'), item('online-competitions', '/platform/events/online', '线上比赛', 'Online competitions')],
  courses: [],
  community: [item('community-feed', '/platform/community/feed', '动态', 'Feed'), item('community', '/platform/community', '版块', 'Boards'), item('leaderboard', '/platform/leaderboard', '学习榜', 'Learning leaderboard')],
  teachers: [],
  organizations: [item('org', '/platform/org', '机构工作台', 'Organization workspace')],
};

export const PLATFORM_PERSONAL_ROUTES = PLATFORM_ROUTES.filter(item => [
  'account-courses', 'progress', 'orders', 'account-invites', 'account-favorites', 'account-notes',
  'account-badges', 'me-membership', 'account-shipping',
].includes(item.id));

/** Admin workspaces use the same two-tier navigation as the public Platform. */
const ADMIN_GROUPS = [
  { id: 'overview', label: { zh: '概览', en: 'Overview' }, routes: ['admin', 'admin-homepage', 'admin-event-analytics', 'admin-logs'] },
  { id: 'learning', label: { zh: '课程', en: 'Courses' }, routes: ['admin-courses', 'admin-paths', 'admin-invites', 'admin-algorithms'] },
  { id: 'teaching', label: { zh: '讲师', en: 'Instructors' }, routes: ['admin-teachers', 'admin-applications', 'admin-payouts'] },
  { id: 'operations', label: { zh: '运营', en: 'Operations' }, routes: ['admin-events', 'admin-competition-applications', 'admin-organization-verification', 'admin-news', 'admin-community'] },
  { id: 'commerce', label: { zh: '交易', en: 'Commerce' }, routes: ['admin-orders', 'admin-products', 'admin-coupons', 'admin-reconcile'] },
  { id: 'qr', label: { zh: '二维码', en: 'QR codes' }, routes: ['admin-qr', 'admin-qr-cards', 'admin-qr-prompts', 'admin-qr-stats'] },
] as const;

export const PLATFORM_ADMIN_NAV = ADMIN_GROUPS.map(group => ({
  id: group.id,
  label: group.label,
  items: group.routes.map(id => {
    const route = PLATFORM_ROUTES.find(candidate => candidate.id === id)!;
    return { id: route.id, href: `/platform/${route.pattern}`, label: route.title, route };
  }),
}));

export function platformAdminNavigationState(definition?: PlatformRouteDefinition) {
  if (definition?.area !== 'admin') return null;
  // Editing/creating an entity keeps its parent list selected; the longest
  // matching path is important for QR cards, prompts and detail pages.
  const selected = PLATFORM_ADMIN_NAV.flatMap(group => group.items.map(item => ({ group, item })))
    .filter(({ item }) => definition.pattern === item.route.pattern || definition.pattern.startsWith(`${item.route.pattern}/`))
    .sort((a, b) => b.item.route.pattern.length - a.item.route.pattern.length)[0];
  return selected ? { group: selected.group, secondary: selected.item.id } : null;
}

export function platformWorkspaceRoutes(definition: PlatformRouteDefinition | undefined, signedIn: boolean, isAdmin: boolean) {
  if (definition?.area === 'admin') return isAdmin
    ? platformAdminNavigationState(definition)?.group.items.map(entry => entry.route) ?? [] : [];
  const personalPage = PLATFORM_PERSONAL_ROUTES.some(item => item.id === definition?.id) || definition?.id === 'order-detail';
  const ids = ['account-courses', 'progress', 'account-notes', 'account-favorites', 'account-badges', 'account-invites', 'me-membership', 'orders', 'account-shipping'];
  return personalPage && signedIn ? ids.flatMap(id => PLATFORM_PERSONAL_ROUTES.filter(item => item.id === id)) : [];
}

export function platformPathname(pathname: string): string {
  return pathname.replace(/^\/(en|zh)(?=\/|$)/, '').split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
}

export function isInstructorCourseListEntry(href: string): boolean {
  return platformPathname(href) === '/platform/instructor/courses';
}

export function platformNavigationState(pathname: string): {
  primary: PlatformPrimary | null; secondary: string | null; definition?: PlatformRouteDefinition;
} {
  const path = platformPathname(pathname);
  const segments = path.replace(/^\/platform\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const definition = path === '/platform' || path.startsWith('/platform/') ? matchPlatformRoute(segments)?.definition : undefined;
  let primary: PlatformPrimary | null = null;
  let secondary: string | null = null;
  if (segments[0] === 'teachers') { primary = 'teachers'; }
  else if (definition?.area === 'organization') { primary = 'organizations'; secondary = 'org'; }
  else if (definition?.area === 'community') {
    primary = 'community';
    secondary = definition.id === 'leaderboard' ? 'leaderboard' : definition.id === 'community-feed' ? 'community-feed'
      : ['community-mine', 'community-search', 'community-review'].includes(definition.id) ? null : 'community';
  } else if (['courses', 'membership'].includes(segments[0])) {
    primary = 'courses';
  } else if (segments[0] === 'events') {
    primary = 'events'; secondary = segments[1] === 'online' || segments[1] === 'preview' ? 'online-competitions' : 'events';
  } else if (definition?.id === 'home' || segments[0] === 'paths') {
    primary = 'discover';
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

// Native teacher directory routes still share canonical links with the original directory.
// More specific destinations precede catch-alls.
// filter() already returns a new array. Keep startup compatible with older Android WebViews.
const sharedRoutes = PLATFORM_ROUTES.filter(route => isPlatformSharedRoute(route) || route.id === 'teachers' || route.id === 'teacher-detail').sort((a, b) => {
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
