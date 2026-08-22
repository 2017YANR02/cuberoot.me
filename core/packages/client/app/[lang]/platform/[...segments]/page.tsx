import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlatformRouteView } from '@/components/platform/PlatformRouteView';
import { metadataFromEntry } from '@/lib/page-meta';
import { matchPlatformRoute } from '@/lib/platform-routes';

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; segments: string[] }>;
}): Promise<Metadata> {
  const { lang, segments } = await params;
  const match = matchPlatformRoute(segments);
  if (!match) return { robots: { index: false, follow: false } };

  const noindex = match.definition.access !== 'public'
    || ['search', 'offline', 'login', 'notifications'].includes(match.definition.id);
  const metadata = metadataFromEntry({
    title: match.definition.title,
    description: match.definition.description,
  }, lang);
  const routePath = `platform/${segments.map(encodeURIComponent).join('/')}`;
  const en = `https://cuberoot.me/${routePath}`;
  const zh = `https://cuberoot.me/zh/${routePath}`;

  return {
    ...metadata,
    alternates: noindex ? undefined : {
      canonical: lang === 'zh' ? zh : en,
      languages: { en, zh, 'x-default': en },
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function PlatformSubpage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  const match = matchPlatformRoute(segments);
  if (!match) notFound();
  return <PlatformRouteView definition={match.definition} params={match.params} />;
}
