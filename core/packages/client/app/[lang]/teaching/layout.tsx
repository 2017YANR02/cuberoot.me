import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

const teachingMetadata = pageMetadata('teaching');

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const metadata = await teachingMetadata({ params });
  return { ...metadata, robots: { index: false, follow: false } };
}

export default function Layout({ children }: {
  children: React.ReactNode;
}) {
  return children;
}
