import { SITE_DIRECTORY_GROUPS } from './site_directory';
import { PAGE_META } from './page_catalog';

/** Versioned, bounded vocabulary shared by the browser and ingestion API. */
export const HOME_ANALYTICS_LAYOUT = 'home-2026-11-03';
export const ANALYTICS_RETENTION_DAYS = 30;
export const ANALYTICS_BATCH_SIZE = 20;
export const ANALYTICS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ANALYTICS_EVENTS = ['web.page_view', 'web.page_engaged', 'web.feature_interaction', 'web.entry_impression', 'web.entry_click', 'web.feature_use'] as const;
export const ANALYTICS_ACTIONS = ['timer_solve', 'scramble_generate', 'solver_result', 'sim_move', 'alg_play', 'recon_play'] as const;
export type AnalyticsAction = typeof ANALYTICS_ACTIONS[number];
export type AnalyticsEventName = typeof ANALYTICS_EVENTS[number];
export const ANALYTICS_ACTION_FEATURES: Record<AnalyticsAction, string> = {
  timer_solve: 'timer', scramble_generate: 'scramble', solver_result: 'scramble',
  sim_move: 'sim', alg_play: 'algdb', recon_play: 'recon',
};
export type AnalyticsAudience = 'anonymous' | 'member' | 'admin';
export type AnalyticsReportAudience = 'public' | AnalyticsAudience;
export interface ProductAnalyticsReport {
  days: number;
  audience: AnalyticsReportAudience;
  timezone: 'UTC';
  coverage: 'default_web';
  retentionDays: number;
  truncated: boolean;
  summary: { events: number; sessions: number; accountUsers: number; anonymousSessions: number; firstEventAt: string | null; lastEventAt: string | null };
  pages: Array<{ route: string; feature: string; device: string; language: string; views: number; subjects: number; sessions: number; engagedSessions: number; interactingSessions: number; usingSubjects: number; usingSessions: number; uses: number }>;
  features: Array<{ feature: string; views: number; sessions: number; interactingSessions: number; usingSessions: number }>;
  entries: Array<{ entry: string; placement: string; layout: string; position: string; device: string; impressions: number; clicks: number; usedAfterClick: number }>;
  frequency: Array<{ feature: string; users: number; activeDaysPerUser: number; sessionsPerUser: number }>;
}

const entries = SITE_DIRECTORY_GROUPS.flatMap(group => [...group.entries]);
export const ANALYTICS_ENTRY_IDS: readonly string[] = entries.map(entry => entry.id);
export const ANALYTICS_PLACEMENTS = ['main', 'wca', 'train', 'tool', 'learn', 'other', 'header', 'search'] as const;
const routes = [
  ...entries.filter(entry => entry.href.startsWith('/')).map(entry => ({
    route: entry.href.split('?')[0]!.replace(/\/$/, ''), feature: entry.id as string,
  })),
  { route: '/wca/persons', feature: 'wca-persons' },
  { route: '/wca/comp', feature: 'competitions' },
  { route: '/scramble/gen', feature: 'scramble' },
  { route: '/scramble/solver', feature: 'scramble' },
  { route: '/scramble/analyzer', feature: 'scramble' },
  { route: '/scramble/stats', feature: 'scramble' },
  { route: '/recognize', feature: 'recognize' },
  { route: '/calc', feature: 'calc' },
  { route: '/search', feature: 'search' },
  { route: '/download', feature: 'download' },
].sort((a, b) => b.route.length - a.route.length);

const excluded = (path: string) => /(^|\/)(?:admin|edit|manage|auth|account|privacy|chat|docs|vault)(\/|$)/.test(path);
const featureFor = (path: string) => routes.find(item => path === item.route || path.startsWith(`${item.route}/`))?.feature ?? 'other';
// Keep static subpages distinct; parameter names are templates, never user values.
const catalog = Object.keys(PAGE_META).map(key => `/${key}`).filter(path => path !== '/' && !excluded(path)).map(route => ({
  route, feature: featureFor(route),
  pattern: new RegExp(`^${route.split('/').map(segment => segment.startsWith('[') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/')}$`),
})).sort((a, b) => Number(a.route.includes('[')) - Number(b.route.includes('[')) || b.route.length - a.route.length);

/** Never return IDs, user text, query strings or unknown path segments. */
export function analyticsPage(pathname: string): { route: string; feature: string } | null {
  const path = pathname.split(/[?#]/)[0]!.replace(/^\/(?:zh|en)(?=\/|$)/, '').replace(/\/$/, '') || '/';
  if (excluded(path)) return null;
  if (path === '/') return { route: '/', feature: 'home' };
  const known = catalog.find(item => item.pattern.test(path));
  if (known) return { route: known.route, feature: known.feature };
  const match = routes.find(item => path === item.route || path.startsWith(`${item.route}/`));
  return match ? { route: path === match.route ? match.route : `${match.route}/:detail`, feature: match.feature } : { route: '/other', feature: 'other' };
}

export function validAnalyticsPage(route: string, feature: string): boolean {
  if (route === '/' && feature === 'home' || route === '/other' && feature === 'other') return true;
  return catalog.some(item => item.route === route && item.feature === feature)
    || routes.some(item => item.feature === feature && (route === item.route || route === `${item.route}/:detail`));
}

export interface ProductAnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  occurredAt: string;
  viewId: string;
  route: string;
  feature: string;
  language: 'zh' | 'en';
  deviceClass: 'mobile' | 'desktop';
  entryPoint: 'home' | 'search' | 'internal' | 'external' | 'direct';
  sourceViewId?: string;
  sourcePlacement?: typeof ANALYTICS_PLACEMENTS[number];
  sourcePosition?: number;
  entryId?: string;
  placement?: typeof ANALYTICS_PLACEMENTS[number];
  position?: number;
  layoutVersion?: typeof HOME_ANALYTICS_LAYOUT;
  action?: AnalyticsAction;
}

export function validAnalyticsEvent(value: unknown, now = Date.now()): value is ProductAnalyticsEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const e = value as ProductAnalyticsEvent;
  const keys = ['id', 'name', 'occurredAt', 'viewId', 'route', 'feature', 'language', 'deviceClass', 'entryPoint', 'entryId', 'placement', 'position', 'layoutVersion', 'action', 'sourceViewId', 'sourcePlacement', 'sourcePosition'];
  if (Object.keys(e).some(key => !keys.includes(key))) return false;
  if (!ANALYTICS_UUID.test(e.id) || !ANALYTICS_UUID.test(e.viewId) || !ANALYTICS_EVENTS.includes(e.name)
    || typeof e.route !== 'string' || typeof e.feature !== 'string' || !validAnalyticsPage(e.route, e.feature)
    || !['zh', 'en'].includes(e.language) || !['mobile', 'desktop'].includes(e.deviceClass)
    || !['home', 'search', 'internal', 'external', 'direct'].includes(e.entryPoint)) return false;
  const time = Date.parse(e.occurredAt);
  if (!Number.isFinite(time) || time < now - 15 * 60_000 || time > now + 30_000) return false;
  if (e.sourceViewId !== undefined || e.sourcePlacement !== undefined || e.sourcePosition !== undefined) {
    if (!e.sourceViewId || !ANALYTICS_UUID.test(e.sourceViewId) || !e.sourcePlacement || !ANALYTICS_PLACEMENTS.includes(e.sourcePlacement)
      || !Number.isInteger(e.sourcePosition) || e.sourcePosition! < 0 || e.sourcePosition! > 200
      || e.entryPoint !== (e.sourcePlacement === 'search' ? 'search' : 'home')) return false;
  }
  const entryEvent = e.name === 'web.entry_impression' || e.name === 'web.entry_click';
  if (entryEvent) {
    if (!e.entryId || !ANALYTICS_ENTRY_IDS.includes(e.entryId) || !e.placement || !ANALYTICS_PLACEMENTS.includes(e.placement)
      || e.layoutVersion !== HOME_ANALYTICS_LAYOUT || !Number.isInteger(e.position) || e.position! < 0 || e.position! > 200
      || (e.placement !== 'search' && e.route !== '/')) return false;
  } else if (e.entryId !== undefined || e.placement !== undefined || e.position !== undefined || e.layoutVersion !== undefined) return false;
  if (e.name === 'web.feature_use') return !!e.action && ANALYTICS_ACTIONS.includes(e.action) && ANALYTICS_ACTION_FEATURES[e.action] === e.feature;
  return e.action === undefined;
}
