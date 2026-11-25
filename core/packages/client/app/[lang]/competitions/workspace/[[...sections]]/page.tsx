import { notFound } from 'next/navigation';
import { Plus } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { OnlineCompetitions } from '@/components/competitions/OnlineCompetitions';
import { PlatformRouteView } from '@/components/platform/PlatformRouteView';
import { COMPETITION_ACTIVITIES_PATH, COMPETITION_HOST_TITLE, COMPETITION_WORKSPACES, competitionWorkspaceHref, matchCompetitionHostRoute } from '@/lib/competition-links';
import { matchPlatformRoute } from '@/lib/platform-routes';
import { metadataFromEntry } from '@/lib/page-meta';
import { CompetitionHostOverview } from '../_components/CompetitionHostOverview';

type RouteParams = { params: Promise<{ lang: string; sections?: string[] }> };
const overview = { zh: '概览', en: 'Overview' } as const;

function activityRoute(id?: string) {
  const route = matchPlatformRoute(id ? ['admin', 'events', id] : ['admin', 'events']);
  if (!route) notFound();
  return route;
}

export function generateStaticParams() {
  return [[], ['manage'], ['create'], ['activities'], ['activities', 'new']].map(sections => ({ sections }));
}

export async function generateMetadata({ params }: RouteParams) {
  const { lang, sections = [] } = await params;
  const match = matchCompetitionHostRoute(sections);
  if (!match) notFound();
  const workspace = match.mode === 'activities' ? activityRoute(match.id).definition
    : match.mode === 'overview' ? { title: COMPETITION_HOST_TITLE } : COMPETITION_WORKSPACES[match.mode];
  const title = match.id && 'detailTitle' in workspace ? workspace.detailTitle : workspace.title;
  return { ...metadataFromEntry({ title }, lang), robots: { index: false, follow: false } };
}

export default async function CompetitionHostPage({ params }: RouteParams) {
  const { lang, sections = [] } = await params;
  const match = matchCompetitionHostRoute(sections);
  if (!match) notFound();
  if (match.mode === 'activities') return <PlatformRouteView {...activityRoute(match.id)} activityManagementHref={COMPETITION_ACTIVITIES_PATH} />;
  const locale = lang === 'zh' ? 'zh' : 'en';
  if (match.mode === 'overview') return <>
    <header className="competition-host-page-heading">
      <h1>{overview[locale]}</h1>
      <AppLink className="competition-primary" href={competitionWorkspaceHref('create')} prefetch={false}>
        <Plus size={16} aria-hidden />{COMPETITION_WORKSPACES.create.title[locale]}
      </AppLink>
    </header>
    <CompetitionHostOverview />
  </>;
  return <>
    {!match.id && <header className="competition-host-page-heading"><h1>{COMPETITION_WORKSPACES[match.mode].title[locale]}</h1></header>}
    <OnlineCompetitions mode={match.mode} id={match.id} />
  </>;
}
