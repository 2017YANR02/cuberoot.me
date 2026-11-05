import { notFound } from 'next/navigation';
import { PlatformRouteView } from '@/components/platform/PlatformRouteView';
import { platformPageMetadata } from '@/lib/platform-metadata';
import { matchPlatformRoute } from '@/lib/platform-routes';

// Public details are generated on demand and cached; builds never enumerate remote records.
export function generateStaticParams() { return []; }

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; segments: string[] }>;
}) {
  const { lang, segments } = await params;
  if (segments[0] === 'shop') notFound();
  return platformPageMetadata(lang, segments);
}

export default async function PlatformSubpage({ params }: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  if (segments[0] === 'shop') notFound();
  const match = matchPlatformRoute(segments);
  if (!match) notFound();
  return <PlatformRouteView definition={match.definition} params={match.params} />;
}
