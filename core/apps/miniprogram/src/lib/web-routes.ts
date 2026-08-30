import {
  SITE_DIRECTORY_GROUPS,
  SITE_DIRECTORY_TEXTS,
  type SiteDirectoryEntry,
  type SiteDirectoryEntryId,
} from '@cuberoot/shared/site-directory';

import { SITE_ORIGIN } from './runtime-config';
import { isSafeWebSessionDestination, isWebSessionTicket } from './web-session-contract';

type DiscoveryRouteKey = Exclude<SiteDirectoryEntryId, 'algdb' | 'alg' | 'github'> | 'alg';
export type WebRouteKey = DiscoveryRouteKey | 'account' | 'privacy' | 'logout';

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

function localizedWebsitePath(href: string): string {
  const path = href.length > 1 ? href.replace(/\/$/, '') : href;
  return `/zh${path}`;
}

function toolAction(entry: SiteDirectoryEntry): WebToolAction {
  if ('miniProgramAction' in entry && entry.miniProgramAction) {
    return entry.miniProgramAction;
  }
  return entry.id === 'timer' ? 'native' : 'web';
}

function toolActionLabel(entry: SiteDirectoryEntry, action: WebToolAction): string {
  if ('miniProgramNote' in entry && entry.miniProgramNote) return entry.miniProgramNote.zh;
  if (action === 'native') return '小程序原生功能';
  return '打开网站页面';
}

const DIRECTORY_TOOL_GROUPS: WebToolGroup[] = SITE_DIRECTORY_GROUPS.map((group) => ({
  id: group.id,
  eyebrow: group.eyebrow.zh,
  title: group.title.zh,
  description: group.sub.zh,
  tools: group.entries.map((entry) => {
    const action = toolAction(entry);
    return {
      action,
      actionLabel: toolActionLabel(entry, action),
      disabled: action === 'disabled',
      href: entry.href,
      id: entry.id,
      key: directoryRouteKey(entry),
      title: SITE_DIRECTORY_TEXTS[entry.nameKey].zh,
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
      title: SITE_DIRECTORY_TEXTS[entry.nameKey].zh,
      description: group.sub.zh,
      path: localizedWebsitePath(entry.href),
      publicEntry: true,
      ...(entry.id === 'timer' ? { nativeTabPath: '/pages/timer/index' } : {}),
      ...(!entry.internal ? { sessionHandoff: false } : {}),
    };
  }
}

export const WEB_ROUTES: Record<WebRouteKey, WebRouteDefinition> = {
  ...discoveryRoutes,
  account: {
    title: '账号管理',
    description: '管理 WCA 账号与登录方式',
    path: '/zh/account',
    publicEntry: false,
  },
  privacy: {
    title: '隐私说明',
    description: '查看数据、登录与删除说明',
    path: '/zh/privacy',
    publicEntry: false,
  },
  logout: {
    title: '退出登录',
    description: '清除小程序与网站登录状态',
    path: '/auth/miniprogram#action=logout&next=%2Fzh%2Faccount',
    publicEntry: false,
    sessionHandoff: false,
    loadFailureMessage: '小程序已退出，网站退出暂未完成。请检查网络后重试。',
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
    title: 'CubeRoot 魔方根：魔方工具',
    path: '/pages/tools/index',
  };
}

export function resolveAccountPageShare(): WebRouteShare {
  return {
    imageUrl: WEB_ROUTE_SHARE_IMAGE,
    title: 'CubeRoot 魔方根',
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
    title: `CubeRoot 魔方根：${route.title}`,
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
    url: `${SITE_ORIGIN}${route.path}`,
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
  const fragment = `ticket=${ticket}&next=${encodeURIComponent(path)}`;
  return `${SITE_ORIGIN}/auth/miniprogram#${fragment}`;
}
