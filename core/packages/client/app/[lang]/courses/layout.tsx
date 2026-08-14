import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

const coursesMetadata = pageMetadata('courses');

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const metadata = await coursesMetadata({ params });
  return { ...metadata, robots: { index: false, follow: false } };
}

export default function Layout({ children }: {
  children: React.ReactNode;
}) {
  return children;
}
