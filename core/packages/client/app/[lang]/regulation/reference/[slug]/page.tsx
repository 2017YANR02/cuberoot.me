import { notFound } from 'next/navigation';
import references from '../../_data/references.json';
import type { RegulationReference } from '@/lib/regulation-references';
import PostArticle from '../../post/_components/PostArticle';

export const dynamicParams = false;
export function generateStaticParams() {
  return (references as RegulationReference[]).map(({ id }) => ({ slug: id }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const reference = (references as RegulationReference[]).find(item => item.id === slug);
  if (!reference) notFound();
  return <PostArticle article={{ ...reference, supplements: [] }} featured={false} contentKind={reference.contentKind} />;
}
