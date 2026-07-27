import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';
import { REG_ARTICLES } from './articles';

// Chapter metadata derived from REG_ARTICLES rather than copied into
// lib/page-meta.ts. A chapter's wording then has exactly one source: rename an
// article here and the <title>, the hub card, the in-page heading and the
// prev/next label all move together.
//
// The tagline doubles as the meta description — it is already a one-line summary
// of the chapter written for humans, which is precisely what a description is.
//
// Title shape is "WCA Regulations: Notation", brand appended by
// metadataFromEntry. Leading with the regulation keyword rather than the bare
// chapter name because "Notation" alone is meaningless in a search result.
export function regulationMetadata(slug: string) {
  return async function generateMetadata({ params }: {
    params: Promise<{ lang: string }>;
  }): Promise<Metadata> {
    const a = REG_ARTICLES.find((x) => x.slug === slug);
    // Unknown slug: inherit the site-wide defaults rather than throw. The page
    // itself already renders null for an unknown slug.
    if (!a) return {};
    const { lang } = await params;
    return metadataFromEntry(
      {
        title: {
          zh: `WCA 规则:${a.title.zh}`,
          en: `WCA Regulations: ${a.title.en}`,
        },
        description: a.tagline,
      },
      lang,
    );
  };
}
