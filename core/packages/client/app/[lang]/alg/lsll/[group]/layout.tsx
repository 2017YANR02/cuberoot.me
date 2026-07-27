import type { Metadata } from 'next';
import { CATEGORIES } from '@/lib/lsll/model';
import { metadataFromEntry } from '@/lib/page-meta';

// All 42 LSLL groups are prerendered from a static array, so naming them costs
// nothing. The letter is the same one LsllGroupClient puts in the heading.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; group: string }>;
}): Promise<Metadata> {
  const { lang, group } = await params;
  const cat = CATEGORIES.find((c) => c.slug === group);
  if (!cat) return {};
  return metadataFromEntry(
    {
      title: {
        zh: `LSLL ${cat.letter}`,
        en: `LSLL ${cat.letter}`,
      },
      description: {
        zh: `LSLL ${cat.letter} 类:最后一槽连同顶层一步解决,共 ${cat.count} 个情况。`,
        en: `LSLL ${cat.letter}: finishing the last slot and the last layer in a single algorithm — ${cat.count} cases.`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
