import {
  SITE_DIRECTORY_GROUPS,
  SITE_DIRECTORY_TEXTS,
  type SiteDirectoryEntry,
  type SiteDirectoryEntryId,
} from '@cuberoot/shared/site-directory';

import { localizedWebsitePath, tr } from './i18n';
import { SITE_ORIGIN } from './runtime-config';
import { isSafeWebSessionDestination, isWebSessionTicket } from './web-session-contract';
import { MINI_PROGRAM_WEB_MARKER } from './platform';

type DiscoveryRouteKey = Exclude<SiteDirectoryEntryId, 'algdb' | 'alg' | 'github'> | 'alg';
export type WebRouteKey = DiscoveryRouteKey | 'home' | 'account' | 'account-link' | 'privacy' | 'logout';

interface WebRouteDefinition {
  title: string;
  description: string;
  path: string;
  publicEntry: boolean;
  nativeTabPath?: string;
  sessionHandoff?: boolean;
  loadFailureMessage?: string;
}

export type WebToolAction = 'web' | 'native' | 'copy' | 'disabled';

export interface WebToolLink {
  action: WebToolAction;
  actionLabel: string;
  disabled: boolean;
  href: string;
  id: SiteDirectoryEntryId;
  key: WebRouteKey | null;
  title: string;
  titleEn: string;
}

export interface WebToolGroup {
  description: string;
  eyebrow: string;
  id: string;
  title: string;
  tools: WebToolLink[];
}

export interface WebRouteShare {
  imageUrl: string;
  title: string;
  path: string;
}

export const WEB_ROUTE_SHARE_IMAGE = '/assets/share-cover.png';

function directoryRouteKey(entry: SiteDirectoryEntry): DiscoveryRouteKey | null {
  if ('miniProgramAction' in entry && entry.miniProgramAction) return null;
  return entry.id === 'algdb' ? 'alg' : entry.id as DiscoveryRouteKey;
}

function toolAction(entry: SiteDirectoryEntry): WebToolAction {
  if ('miniProgramAction' in entry && entry.miniProgramAction) {
    return entry.miniProgramAction;
  }
  return entry.id === 'timer' ? 'native' : 'web';
}

function toolActionLabel(entry: SiteDirectoryEntry, action: WebToolAction): string {
  if ('miniProgramNote' in entry && entry.miniProgramNote) return tr(entry.miniProgramNote);
  if (action === 'native') return tr({ en: 'Native Mini Program feature', zh: '小程序原生功能' });
  return tr({ en: 'Open website page', zh: '打开网站页面' });
}

const DIRECTORY_TOOL_GROUPS: WebToolGroup[] = SITE_DIRECTORY_GROUPS.map((group) => ({
  id: group.id,
  eyebrow: tr(group.eyebrow),
  title: tr(group.title),
  description: tr(group.sub),
  tools: group.entries.map((entry) => {
    const action = toolAction(entry);
    return {
      action,
      actionLabel: toolActionLabel(entry, action),
      disabled: action === 'disabled',
      href: entry.href,
      id: entry.id,
      key: directoryRouteKey(entry),
      title: tr(SITE_DIRECTORY_TEXTS[entry.nameKey]),
      titleEn: SITE_DIRECTORY_TEXTS[entry.nameKey].en,
    };
  }),
}));

const discoveryRoutes = {} as Record<DiscoveryRouteKey, WebRouteDefinition>;
for (const group of SITE_DIRECTORY_GROUPS) {
  for (const entry of group.entries) {
    const key = directoryRouteKey(entry);
    if (!key) continue;
    discoveryRoutes[key] = {
      title: tr(SITE_DIRECTORY_TEXTS[entry.nameKey]),
      description: tr(group.sub),
      path: localizedWebsitePath(entry.href),
      publicEntry: true,
      ...(entry.id === 'timer' ? { nativeTabPath: '/pages/timer/index' } : {}),
      ...(!entry.internal ? { sessionHandoff: false } : {}),
    };
  }
}

export const WEB_ROUTES: Record<WebRouteKey, WebRouteDefinition> = {
  ...discoveryRoutes,
  home: {
    title: tr({ en: 'Cube Tools', zh: '魔方工具' }),
    description: tr({ en: 'CubeRoot website home', zh: 'CubeRoot 网站主页' }),
    path: localizedWebsitePath('/'),
    publicEntry: true,
    nativeTabPath: '/pages/tools/index',
  },
  account: {
    title: tr({ en: 'Account', zh: '账号管理' }),
    description: tr({ en: 'Manage your WCA account and sign-in methods', zh: '管理 WCA 账号与登录方式' }),
    path: localizedWebsitePath('/account'),
    publicEntry: false,
  },
  'account-link': {
    title: tr({ en: 'Link existing account', zh: '绑定已有账号' }),
    description: tr({
      en: 'Sign in to your existing account, then link WeChat under sign-in methods',
      zh: '先登录已有账号，再在登录方式中绑定微信',
    }),
    path: localizedWebsitePath('/account'),
    publicEntry: false,
    sessionHandoff: false,
  },
  privacy: {
    title: tr({ en: 'Privacy', zh: '隐私说明' }),
    description: tr({ en: 'View data, sign-in and deletion information', zh: '查看数据、登录与删除说明' }),
    path: localizedWebsitePath('/privacy'),
    publicEntry: false,
    sessionHandoff: false,
  },
  logout: {
    title: tr({ en: 'Sign out', zh: '退出登录' }),
    description: tr({ en: 'Clear Mini Program and website sessions', zh: '清除小程序与网站登录状态' }),
    path: `/auth/miniprogram#action=logout&next=${encodeURIComponent(localizedWebsitePath('/account'))}`,
    publicEntry: false,
    sessionHandoff: false,
    loadFailureMessage: tr({
      en: 'Signed out of the Mini Program, but website sign-out is incomplete. Check your connection and try again.',
      zh: '小程序已退出，网站退出暂未完成。请检查网络后重试。',
    }),
  },
};

const DIRECTORY_TOOLS = DIRECTORY_TOOL_GROUPS.flatMap((group) => group.tools);

export function listWebTools(): WebToolLink[] {
  return [...DIRECTORY_TOOLS];
}

export function listWebToolGroups(query = ''): WebToolGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return DIRECTORY_TOOL_GROUPS
    .map((group) => ({
      ...group,
      tools: normalizedQuery
        ? group.tools.filter((tool) => [tool.title, tool.titleEn, tool.href, tool.id]
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
        : [...group.tools],
    }))
    .filter((group) => group.tools.length > 0);
}

export function resolveWebTool(id: unknown): WebToolLink | null {
  if (typeof id !== 'string') return null;
  return DIRECTORY_TOOLS.find((tool) => tool.id === id) ?? null;
}

export function resolveToolsPageShare(): WebRouteShare {
  return {
    imageUrl: WEB_ROUTE_SHARE_IMAGE,
    title: tr({ en: 'CubeRoot: Cube Tools', zh: '魔方根CubeRoot：魔方工具' }),
    path: '/pages/tools/index',
  };
}

export function resolveAccountPageShare(): WebRouteShare {
  return {
    imageUrl: WEB_ROUTE_SHARE_IMAGE,
    title: tr({ en: 'CubeRoot', zh: '魔方根CubeRoot' }),
    path: '/pages/account/index',
  };
}

export function resolveWebRouteShare(key: unknown): WebRouteShare | null {
  if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(WEB_ROUTES, key)) {
    return null;
  }

  const routeKey = key as WebRouteKey;
  const route = WEB_ROUTES[routeKey];
  if (!route.publicEntry) return null;

  return {
    imageUrl: WEB_ROUTE_SHARE_IMAGE,
    title: tr({
      en: `CubeRoot: ${route.title}`,
      zh: `魔方根CubeRoot：${route.title}`,
    }),
    path: route.nativeTabPath
      ?? `/pages/web/index?key=${encodeURIComponent(routeKey)}`,
  };
}

export function resolveWebRoute(key: unknown): {
  title: string;
  path: string;
  sessionHandoff: boolean;
  loadFailureMessage?: string;
  url: string;
} | null {
  if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(WEB_ROUTES, key)) {
    return null;
  }
  const route = WEB_ROUTES[key as WebRouteKey];
  const resolved = {
    title: route.title,
    path: route.path,
    sessionHandoff: route.sessionHandoff !== false,
    url: withMiniProgramRedirect(`${SITE_ORIGIN}${route.path}`),
  };
  if (route.loadFailureMessage) {
    return { ...resolved, loadFailureMessage: route.loadFailureMessage };
  }
  return resolved;
}

export function createWebSessionHandoffUrl(path: string, ticket: string): string {
  if (!isSafeWebSessionDestination(path) || !isWebSessionTicket(ticket)) {
    throw new Error('invalid Mini Program web session handoff');
  }
  const fragment = `${MINI_PROGRAM_WEB_MARKER}&ticket=${ticket}&next=${encodeURIComponent(path)}`;
  return `${SITE_ORIGIN}/auth/miniprogram#${fragment}`;
}

function withMiniProgramRedirect(url: string): string {
  const fragmentIndex = url.indexOf('#');
  if (fragmentIndex < 0) return `${url}#${MINI_PROGRAM_WEB_MARKER}`;

  const base = url.slice(0, fragmentIndex);
  const fragment = url.slice(fragmentIndex + 1);
  const hasRedirectMarker = fragment.split('&').some(
    (part) => part === MINI_PROGRAM_WEB_MARKER || part.startsWith(`${MINI_PROGRAM_WEB_MARKER}=`),
  );
  if (hasRedirectMarker) return url;
  return `${base}#${MINI_PROGRAM_WEB_MARKER}${fragment ? `&${fragment}` : ''}`;
}
