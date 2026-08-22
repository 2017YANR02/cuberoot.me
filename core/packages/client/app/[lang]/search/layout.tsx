import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-meta';

const searchMetadata = pageMetadata('search');

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const metadata = await searchMetadata({ params });
  return { ...metadata, robots: { index: false, follow: true } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
