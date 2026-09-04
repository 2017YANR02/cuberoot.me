import type { Metadata } from 'next';
import { pageMetadata } from '../../../lib/page-meta';
import TutorialAccessGate from './_components/TutorialAccessGate';
import './tutorial.css';

// Server layout so this route's <title>/<description> reach the SERVER HTML —
// page.tsx is a client component and cannot export metadata itself.
// Wording lives in lib/page-meta.ts under the key below. The whole route family
// stays out of search indexes while its visitor access is locked for maintenance.
const buildTutorialMetadata = pageMetadata('tutorial-legacy');
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const metadata = await buildTutorialMetadata({ params });
  return { ...metadata, robots: { index: false, follow: false } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TutorialAccessGate>{children}</TutorialAccessGate>;
}
