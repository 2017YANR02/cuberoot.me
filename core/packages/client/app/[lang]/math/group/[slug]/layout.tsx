import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';
import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import { TOC } from '../_data/toc';

// Per-section metadata. The 63 sections are the densest original writing on the
// site and every one of them had the same empty title and the same site-wide
// description; now each carries its own, in both languages, drawn from the same
// TOC entry that renders the heading and the prev/next links.
//
// Title leads with the subject — "Group theory: Lagrange + cosets" — for the
// same reason the regulation chapters read "WCA Regulations: Notation": the bare
// section name ("Quotient groups") gives a search result no way to tell this
// page from any other algebra page. Leading rather than trailing also avoids a
// second em-dash in narrow browser tabs.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const sec = TOC.find((t) => t.id === slug);
  // Unknown slug renders the index; let it inherit the site defaults.
  if (!sec) return {};
  return metadataFromEntry(
    {
      title: {
        zh: `群论:${sec.zh}`,
        en: `Group theory: ${sec.en}`,
      },
      description: {
        zh: `${sec.zh}:「魔方与群论」第 ${sec.num} 节,含图示与可交互演示。`,
        en: `${sec.en} — section ${sec.num} of a course on group theory told through the Rubik's Cube, with diagrams and interactive demonstrations.`,
      },
    },
    lang,
  );
}

// Same TOC entry drives the Article node, so the structured data can never
// describe a different section than the one on screen. Strings are picked by
// indexing a { zh, en } object rather than a ternary — tr() is client-only and
// cannot run in a server layout.
export default async function Layout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const sec = TOC.find((t) => t.id === slug);
  if (!sec) return children;
  const l: 'zh' | 'en' = lang === 'zh' ? 'zh' : 'en';
  const prefix = { zh: '/zh', en: '' }[l];
  const essay = { zh: '魔方与群论', en: "The Rubik's Cube, as a Group" }[l];
  const blurb = {
    zh: `「魔方与群论」第 ${sec.num} 节。`,
    en: `Section ${sec.num} of a course on group theory told through the Rubik's Cube.`,
  }[l];
  return (
    <>
      <JsonLd
        data={articleJsonLd({
          headline: { zh: sec.zh, en: sec.en }[l],
          description: blurb,
          url: `${SITE_URL}${prefix}/math/group/${slug}`,
          lang,
          partOfName: essay,
          partOfUrl: `${SITE_URL}${prefix}/math/group`,
        })}
      />
      {children}
    </>
  );
}
