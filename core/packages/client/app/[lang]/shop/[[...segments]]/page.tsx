import { notFound } from 'next/navigation';
import { ShopRoute } from '@/components/shop/ShopRoute';
import { platformPageMetadata } from '@/lib/platform-metadata';
import { matchPlatformRoute } from '@/lib/platform-routes';

export function generateStaticParams() { return []; }

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; segments?: string[] }>;
}) {
  const { lang, segments = [] } = await params;
  return platformPageMetadata(lang, ['shop', ...segments]);
}

export default async function ShopPage({ params }: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  const match = matchPlatformRoute(['shop', ...segments]);
  if (!match) notFound();
  return <ShopRoute key={segments.join('/')} definition={match.definition} id={match.params.id} />;
}
