/** Retired public URLs bypass dynamic shells and resolve to the root 404. */
export const RETIRED_ROUTES = [
  { path: '/platform/shop', descendants: true },
  { path: '/dev/code-history' },
  { path: '/dev/architecture/decisions' },
  { path: '/dev/architecture/code-history' },
  { path: '/dev/architecture/history' },
  { path: '/wca/cross_city_competition_streaks' },
] as const;

export function isRetiredRoute(path: string): boolean {
  return RETIRED_ROUTES.some(route => path === route.path
    || ('descendants' in route && path.startsWith(`${route.path}/`)));
}
