import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';

// Form for submitting an alternative solution.
// The recon id is in the URL but this route prebuilds no params, and the page
// itself is a submission form, not content — a generic, honest title beats inheriting "Reconstructions"
// from /recon, which is a different page.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return metadataFromEntry(
    {
      title: { zh: '提交替代解', en: 'Submit an Alternative Solution' },
      description: { zh: '为这个打乱提交你自己的解法,加入替代解对照。', en: 'Submit your own solution to this scramble and add it to the alternatives.' },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
