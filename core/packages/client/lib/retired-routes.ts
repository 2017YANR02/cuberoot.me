import { WCA_STAT_NON_PAGE_IDS } from '@cuberoot/shared/wca-stat-catalog';

/** Retired public URLs bypass dynamic shells and resolve to the root 404. */
export const RETIRED_ROUTES = [
  { path: '/video-recon' },
  { path: '/scramble/recent' },
  { path: '/platform/shop', descendants: true },
  { path: '/platform/events/online', descendants: true },
  { path: '/platform/events/preview' },
  { path: '/platform/competitions', descendants: true },
  { path: '/platform/admin/competition-applications' },
  { path: '/competitions/preview' },
  { path: '/competitions/create' },
  { path: '/competitions/manage', descendants: true },
  { path: '/competitions/organizer-applications' },
  { path: '/competitions/workspace/organizer-applications' },
  { path: '/dev/code-history' },
  { path: '/dev/architecture/decisions' },
  { path: '/dev/architecture/code-history' },
  { path: '/dev/architecture/history' },
  ...WCA_STAT_NON_PAGE_IDS.map(id => ({ path: `/wca/${id}` })),
] as const;

export const RETIRED_COMP_VIEWS = ['common'] as const;
export const RETIRED_WORKSPACE_SECTIONS = ['projects'] as const;

export function isRetiredRoute(path: string, searchParams?: URLSearchParams): boolean {
  if (/^\/admin\/team\/?$/.test(path)
    && RETIRED_WORKSPACE_SECTIONS.some(section => section === searchParams?.get('section'))) return true;
  if (/^\/wca\/comp\/[^/]+\/?$/.test(path)
    && RETIRED_COMP_VIEWS.some(view => view === searchParams?.get('view'))) return true;
  return RETIRED_ROUTES.some(route => path === route.path
    || ('descendants' in route && path.startsWith(`${route.path}/`)));
}
