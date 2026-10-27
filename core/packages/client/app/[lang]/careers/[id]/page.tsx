import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { careerPositions } from '../positions';
import PositionDetail from './position-detail';

export const dynamicParams = false;
export function generateStaticParams() { return careerPositions.map(({ id }) => ({ id })); }
export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang, id } = await params;
  const position = careerPositions.find(item => item.id === id);
  if (!position) return {};
  return { title: position.title[lang === 'zh' ? 'zh' : 'en'] };
}
export default async function PositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const position = careerPositions.find(item => item.id === id);
  if (!position) notFound();
  return <PositionDetail position={position} />;
}
