import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { careerPositions } from '../../positions';
import ApplicationForm from './application-form';

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang, id } = await params;
  const position = careerPositions.find(item => item.id === id);
  if (!position) return {};
  return { title: lang === 'zh' ? `申请职位：${position.title.zh}` : `Apply: ${position.title.en}`, robots: { index: false, follow: false } };
}

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const position = careerPositions.find(item => item.id === id);
  if (!position) notFound();
  return <ApplicationForm position={position} />;
}
