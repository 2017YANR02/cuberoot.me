import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';

// Alternative-solution list for one reconstruction.
// The recon id is in the URL but this route prebuilds no params, and the page
// itself is noindex anyway (it lists user submissions for a single solve) — a generic, honest title beats inheriting "Reconstructions"
// from /recon, which is a different page.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return metadataFromEntry(
    {
      title: { zh: '替代解', en: 'Alternative Solutions' },
      description: { zh: '同一个打乱的其它解法:不同方法、不同路线的复盘对照。', en: 'Other solutions to the same scramble — the same solve reconstructed with different methods and routes.' },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
