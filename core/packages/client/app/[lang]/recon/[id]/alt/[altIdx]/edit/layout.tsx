import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';

// Edit form for an alternative solution.
// The recon id is in the URL but this route prebuilds no params, and the page
// itself is an edit form, not content — a generic, honest title beats inheriting "Reconstructions"
// from /recon, which is a different page.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return metadataFromEntry(
    {
      title: { zh: '编辑替代解', en: 'Edit Alternative Solution' },
      description: { zh: '修改你提交的替代解。', en: 'Edit the alternative solution you submitted.' },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
