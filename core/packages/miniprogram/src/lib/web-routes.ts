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
  },
  competitions: {
    title: 'WCA 比赛',
    description: '查比赛、赛程与成绩',
    path: '/zh/wca/comp',
  },
  wiki: {
    title: '魔方百科',
    description: '教程、术语与方法资料',
    path: '/zh/wiki',
  },
  courses: {
    title: '课程',
    description: '系统学习与试学内容',
    path: '/zh/courses',
  },
} as const;

export type WebRouteKey = keyof typeof WEB_ROUTES;

export interface WebToolLink {
  key: WebRouteKey;
  title: string;
  description: string;
}

const TOOL_ROUTE_KEYS = ['alg', 'competitions', 'wiki', 'courses'] as const;

export function listWebTools(): WebToolLink[] {
  return TOOL_ROUTE_KEYS.map((key) => ({
    key,
    title: WEB_ROUTES[key].title,
    description: WEB_ROUTES[key].description,
  }));
}

export function resolveWebRoute(key: unknown): { title: string; url: string } | null {
  if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(WEB_ROUTES, key)) {
    return null;
  }
  const route = WEB_ROUTES[key as WebRouteKey];
  return { title: route.title, url: `${SITE_ORIGIN}${route.path}` };
}
