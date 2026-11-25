import { notFound } from 'next/navigation';
import { OnlineCompetitions } from '@/components/competitions/OnlineCompetitions';
import { COMPETITIONS_PATH, COMPETITION_WORKSPACES, competitionWorkspaceHref, matchCompetitionRoute } from '@/lib/competition-links';
import { metadataFromEntry, pageMetadata } from '@/lib/page-meta';
import { CompetitionHeader } from '../_components/CompetitionHeader';

type RouteParams = { params: Promise<{ lang: string; segments: string[] }> };
const publicMetadata = pageMetadata('competitions/[...segments]');

export function generateStaticParams() { return [{ segments: ['admin', COMPETITION_WORKSPACES.review.slug] }]; }

export async function generateMetadata({ params }: RouteParams) {
  const { lang, segments } = await params;
  const match = matchCompetitionRoute(segments);
  if (!match) notFound();
  if (match.mode === 'browse') return publicMetadata({ params });
  const workspace = COMPETITION_WORKSPACES[match.mode];
  const title = match.id && 'detailTitle' in workspace ? workspace.detailTitle : workspace.title;
  return { ...metadataFromEntry({ title }, lang), robots: { index: false, follow: false } };
}

export default async function CompetitionPage({ params }: RouteParams) {
  const { lang, segments } = await params;
  const match = matchCompetitionRoute(segments);
  if (!match) notFound();
  const fallback = match.mode !== 'browse' && match.id ? competitionWorkspaceHref(match.mode) : COMPETITIONS_PATH;
  const title = match.mode !== 'browse' && !match.id ? COMPETITION_WORKSPACES[match.mode].title[lang === 'zh' ? 'zh' : 'en'] : undefined;
  return <main className="competition-center">
    <CompetitionHeader fallback={fallback} title={title} />
    <OnlineCompetitions mode={match.mode} id={match.id} initialReview={segments[1] === 'organizer-applications' ? 'organizers' : 'events'} />
  </main>;
}
