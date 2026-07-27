import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';

// One alternative solution of a reconstruction.
// The recon id is in the URL but this route prebuilds no params, and the page
// itself is one user-submitted alternative — a generic, honest title beats inheriting "Reconstructions"
// from /recon, which is a different page.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return metadataFromEntry(
    {
      title: { zh: '替代解', en: 'Alternative Solution' },
      description: { zh: '同一打乱的一个替代解法,逐步分解与用时。', en: 'One alternative solution to the same scramble, broken down step by step.' },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
