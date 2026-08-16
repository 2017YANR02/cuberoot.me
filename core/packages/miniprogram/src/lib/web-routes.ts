const SITE_ORIGIN = 'https://cuberoot.me';

export const WEB_ROUTES = {
  timer: { title: '计时器', path: '/zh/timer' },
  alg: { title: '公式库', path: '/zh/alg' },
  competitions: { title: 'WCA 比赛', path: '/zh/wca/comp' },
  courses: { title: '课程', path: '/zh/courses' },
  wiki: { title: '魔方百科', path: '/zh/wiki' },
} as const;

export type WebRouteKey = keyof typeof WEB_ROUTES;

export function resolveWebRoute(key: unknown): { title: string; url: string } | null {
  if (typeof key !== 'string' || !Object.hasOwn(WEB_ROUTES, key)) return null;
  const route = WEB_ROUTES[key as WebRouteKey];
  return { title: route.title, url: `${SITE_ORIGIN}${route.path}` };
}
