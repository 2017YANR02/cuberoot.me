import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { metadataFromEntry } from '@/lib/page-meta';
import RecognitionGuideClient from './RecognitionGuideClient';
import Sq1ShapeGuideClient from './Sq1ShapeGuideClient';
import { RECOGNITION_GUIDES, SQ1_SHAPE_GUIDE, isGuideSetId } from './guide-content';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ algSetId: 'pll' }, { algSetId: 'oll' }, { algSetId: 'sq1-shape' }];
}

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; algSetId: string }>;
}): Promise<Metadata> {
  const { lang, algSetId } = await params;
  if (algSetId === 'sq1-shape') {
    return metadataFromEntry(
      { title: SQ1_SHAPE_GUIDE.title, description: SQ1_SHAPE_GUIDE.seoDescription },
      lang,
    );
  }
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
  if (algSetId === 'sq1-shape') return <Sq1ShapeGuideClient />;
  if (!isGuideSetId(algSetId)) notFound();
  return <RecognitionGuideClient />;
}
