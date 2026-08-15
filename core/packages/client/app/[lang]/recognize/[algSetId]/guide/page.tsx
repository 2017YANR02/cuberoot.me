import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { metadataFromEntry } from '@/lib/page-meta';
import RecognitionGuideClient from './RecognitionGuideClient';
import { RECOGNITION_GUIDES, isGuideSetId } from './guide-content';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ algSetId: 'pll' }, { algSetId: 'oll' }];
}

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; algSetId: string }>;
}): Promise<Metadata> {
  const { lang, algSetId } = await params;
  if (!isGuideSetId(algSetId)) return {};
  const spec = RECOGNITION_GUIDES[algSetId];
  return metadataFromEntry(
    { title: spec.title, description: spec.seoDescription },
    lang,
  );
}

export default async function Page({ params }: {
  params: Promise<{ algSetId: string }>;
}) {
  const { algSetId } = await params;
  if (!isGuideSetId(algSetId)) notFound();
  return <RecognitionGuideClient />;
}
