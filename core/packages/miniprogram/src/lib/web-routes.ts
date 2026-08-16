import { SITE_ORIGIN } from './runtime-config';

export const WEB_ROUTES = {
  timer: {
    title: '计时器',
    description: '训练、成绩与统计',
    path: '/zh/timer',
  },
  alg: {
    title: '公式库',
    description: 'OLL、PLL、ZBLL 等公式查询与训练',
    path: '/zh/alg',
    showInTools: true,
  },
  competitions: {
    title: 'WCA 比赛',
    description: '查比赛、赛程与成绩',
    path: '/zh/wca/comp',
    showInTools: true,
  },
  wiki: {
    title: '魔方百科',
    description: '教程、术语与方法资料',
    path: '/zh/wiki',
    showInTools: true,
  },
  courses: {
    title: '课程',
    description: '系统学习与试学内容',
    path: '/zh/courses',
    showInTools: true,
  },
  account: {
    title: '账号管理',
    description: '管理 WCA 账号与登录方式',
    path: '/zh/account',
  },
  privacy: {
    title: '隐私说明',
    description: '查看数据、登录与删除说明',
    path: '/zh/privacy',
  },
  logout: {
    title: '退出登录',
    description: '清除小程序与网站登录状态',
    path: '/auth/miniprogram#action=logout&next=%2Fzh%2Faccount',
    sessionHandoff: false,
    loadFailureMessage: '小程序已退出，网站退出暂未完成。请检查网络后重试。',
  },
} as const;

export type WebRouteKey = keyof typeof WEB_ROUTES;

export interface WebToolLink {
  key: WebRouteKey;
  title: string;
  description: string;
}

export function listWebTools(): WebToolLink[] {
  const tools: WebToolLink[] = [];
  for (const key of Object.keys(WEB_ROUTES) as WebRouteKey[]) {
    const route = WEB_ROUTES[key];
    if (!('showInTools' in route) || route.showInTools !== true) continue;
    tools.push({ key, title: route.title, description: route.description });
  }
  return tools;
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
    sessionHandoff: !('sessionHandoff' in route) || route.sessionHandoff !== false,
    url: `${SITE_ORIGIN}${route.path}`,
  };
  if ('loadFailureMessage' in route) {
    return { ...resolved, loadFailureMessage: route.loadFailureMessage };
  }
  return resolved;
}

export function createWebSessionHandoffUrl(path: string, ticket: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
    throw new Error('invalid Mini Program web session handoff');
  }
  const fragment = `ticket=${ticket}&next=${encodeURIComponent(path)}`;
  return `${SITE_ORIGIN}/auth/miniprogram#${fragment}`;
}
