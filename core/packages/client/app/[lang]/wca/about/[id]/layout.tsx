import type { Metadata } from 'next';
import { ABOUT_REGISTRY } from './_lib/registry';
import { metadataFromEntry } from '@/lib/page-meta';

// Every "how this statistic is computed" page is prerendered from a static
// registry, so naming them is free. These pages explain method — exactly the
// kind of page a search or an assistant should be able to find by name.

/** Registry titles often read "<name> — <subtitle>"; metadataFromEntry appends
 *  " — CubeRoot", so keep only the head and let the subtitle live in the
 *  description rather than emit a title with two em-dashes. */
const head = (s: string): string => s.split(/\s+[—–]\s+/)[0].trim();

/** Intro is a paragraph or list of paragraphs with light **bold** markup. */
function firstIntro(intro: string | string[]): string {
  const first = Array.isArray(intro) ? intro[0] ?? '' : intro;
  const plain = first.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > 200 ? `${plain.slice(0, 197)}…` : plain;
}

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const entry = ABOUT_REGISTRY[id];
  // Unknown id renders the client's "missing" branch; don't title it.
  if (!entry) return {};
  return metadataFromEntry(
    {
      title: {
        zh: `${head(entry.titleZh)}:算法与口径`,
        en: `${head(entry.titleEn)}: how it is computed`,
      },
      description: {
        zh: firstIntro(entry.introZh),
        en: firstIntro(entry.introEn),
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
