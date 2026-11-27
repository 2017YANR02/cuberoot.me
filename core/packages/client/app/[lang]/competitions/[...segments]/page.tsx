import { notFound } from 'next/navigation';
import { OnlineCompetitions } from '@/components/competitions/OnlineCompetitions';
import { COMPETITIONS_PATH, COMPETITION_WORKSPACES, competitionWorkspaceHref, isCompetitionTestSlug, matchCompetitionRoute } from '@/lib/competition-links';
import { apiUrl } from '@/lib/api-base';
import { metadataFromEntry, pageMetadata } from '@/lib/page-meta';
import { CompetitionHeader } from '../_components/CompetitionHeader';

type RouteParams = { params: Promise<{ lang: string; segments: string[] }> };
const publicMetadata = pageMetadata('competitions/[...segments]');

export function generateStaticParams() { return [{ segments: ['admin', COMPETITION_WORKSPACES.review.slug] }]; }

export async function generateMetadata({ params }: RouteParams) {
  const { lang, segments } = await params;
  const match = matchCompetitionRoute(segments);
  if (!match) notFound();
  if (match.mode === 'browse') {
    const metadata = await publicMetadata({ params });
    const key = match.id;
    // Shared test links use the reserved slug. Verify UUID aliases anonymously before indexing.
    const isUuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(key);
    const listed = !isUuid || await fetch(apiUrl(`/v1/platform/competitions/${key}`), { method: 'HEAD', signal: AbortSignal.timeout(3000) })
      .then(response => response.ok, () => false);
    return isCompetitionTestSlug(key) || !listed ? { ...metadata, robots: { index: false, follow: false } } : metadata;
  }
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
