export const COMPETITIONS_PATH = '/competitions';
export const COMPETITION_HOST_PATH = '/competitions/workspace';
export const COMPETITION_ACTIVITIES_PATH = `${COMPETITION_HOST_PATH}/activities`;
export const COMPETITION_ACTIVITIES_TITLE = { zh: '活动管理', en: 'Event management' } as const;
export const COMPETITION_HOST_TITLE = { zh: '办赛工作台', en: 'Competition workspace' } as const;
export const COMPETITION_WORKSPACES = {
  create: { slug: 'create', title: { zh: '创建比赛', en: 'Create a competition' } },
  manage: { slug: 'manage', title: { zh: '赛事管理', en: 'Competition management' }, detailTitle: { zh: '管理赛事', en: 'Manage competition' } },
  supervise: { slug: 'supervise', title: { zh: '执场监考', en: 'My judging assignments' }, detailTitle: { zh: '执场赛事', en: 'Judge a competition' } },
  apply: { slug: 'apply', title: { zh: '主办方申请', en: 'Organizer application' } },
  review: { slug: 'review', title: { zh: '赛事审核台', en: 'Competition reviews' } },
} as const;

export type CompetitionWorkspaceMode = keyof typeof COMPETITION_WORKSPACES;
const hostModes = ['create', 'manage'] as const;
const publicModes = ['supervise', 'apply'] as const;
export type CompetitionHostMode = (typeof hostModes)[number];
export type CompetitionRoute = { mode: 'browse'; id: string } | { mode: (typeof publicModes)[number] | 'review'; id?: string };
export type CompetitionHostRoute = { mode: 'overview'; id?: never } | { mode: CompetitionHostMode | 'activities'; id?: string };

export function competitionWorkspaceHref(mode: CompetitionWorkspaceMode, id?: string) {
  const base = mode === 'review' ? `${COMPETITIONS_PATH}/admin`
    : mode === 'apply' || mode === 'supervise' ? COMPETITIONS_PATH : COMPETITION_HOST_PATH;
  const root = `${base}/${COMPETITION_WORKSPACES[mode].slug}`;
  return id ? `${root}/${encodeURIComponent(id)}` : root;
}

export function competitionHref(id: string) {
  return `${COMPETITIONS_PATH}/${encodeURIComponent(id)}`;
}

export function matchCompetitionRoute(segments: readonly string[]): CompetitionRoute | null {
  const [slug, id] = segments;
  if (!slug || segments.length > 2) return null;
  if (slug === 'admin') return (id === COMPETITION_WORKSPACES.review.slug || id === 'organizer-applications') ? { mode: 'review' } : null;
  if (['workspace', COMPETITION_WORKSPACES.review.slug, 'organizer-applications'].includes(slug) || hostModes.some(mode => COMPETITION_WORKSPACES[mode].slug === slug)) return null;
  const workspace = publicModes.find(mode => COMPETITION_WORKSPACES[mode].slug === slug);
  if (!workspace) return id ? null : { mode: 'browse', id: slug };
  if (id && workspace !== 'supervise') return null;
  return { mode: workspace, id };
}

export function matchCompetitionHostRoute(segments: readonly string[]): CompetitionHostRoute | null {
  if (!segments.length) return { mode: 'overview' };
  const [slug, id] = segments;
  if (segments.length > 2) return null;
  if (slug === 'activities') return { mode: 'activities', id };
  const mode = hostModes.find(candidate => COMPETITION_WORKSPACES[candidate].slug === slug);
  if (!mode || (id && mode !== 'manage')) return null;
  return { mode, id };
}

export const isCompetitionTestSlug = (slug: string) =>
  /^test-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(slug);
