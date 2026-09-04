import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';
import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import {
  fetchTutorialEntry, tutorialLang, tutorialTitle, hasLang,
  type CatalogEntry,
} from '@/lib/tutorial-seo';
import { categoryLabel } from '../_data/categories';

// ~609 tutorial posts shared a single inherited title ("Cubing Tutorials") and
// the site-wide description, so search results could not tell any two of them
// apart. The catalog that names them is a static JSON on the static origin, and
// this route is force-static + dynamicParams with no prebuilt params, so the
// fetch below runs on first render of a slug and never during `next build` —
// a slow static origin can make a title stale, never fail a deploy.

function describe(e: CatalogEntry, title: string): { zh: string; en: string } {
  const cat = categoryLabel(e.category);
  if (e.view === 'algset' && e.algCount > 0) {
    return {
      zh: `${title}:共 ${e.algCount} 个公式,每个情况配图并给出多种解法。`,
      en: `${title}: ${e.algCount} algorithms, each case with an image and alternative solutions.`,
    };
  }
  return {
    zh: `${title}:${cat.zh}分类下的速拧教程。`,
    en: `${title} — a speedcubing tutorial filed under ${cat.en}.`,
  };
}

// One tutorial is a hand-built page rather than a catalog entry, so the catalog
// lookup below cannot name it. TutorialPostClient special-cases the same slug.
const SPEFFZ_SLUG = 'speffz-letter-scheme';
const SPEFFZ = {
  title: { zh: 'Speffz 字母编码', en: 'Speffz Letter Scheme' },
  description: {
    zh: 'Speffz:盲拧用的贴纸字母编号方案,附三阶各面展开图与角块、棱块的编号对照。',
    en: 'Speffz — the sticker lettering scheme used for blindfolded solving, with a labelled net and the corner and edge codes.',
  },
};

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (slug === SPEFFZ_SLUG) return metadataFromEntry(SPEFFZ, lang);
  const e = await fetchTutorialEntry(slug);
  // Unknown slug, or the catalog is unreachable: inherit /tutorial-legacy's own title
  // rather than invent one for a page that may not exist.
  if (!e) return {};
  const l = tutorialLang(lang);
  const title = tutorialTitle(e, l);
  const meta = metadataFromEntry(
    { title: { zh: title, en: title }, description: describe(e, title) },
    lang,
  );
  // Only 60 of the posts are bilingual. The client falls back to whichever
  // language exists, so /zh/tutorial-legacy/<en-only-slug> renders the English article
  // — a real page, but a duplicate of the bare URL in the wrong language.
  // Indexing both would split the signal and put an English page in Chinese
  // results, so the language that does not exist is noindex (still followed, so
  // its links keep flowing). Hidden posts are excluded outright.
  const indexable = hasLang(e, l) && !e.hidden;
  return indexable ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function Layout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const e = await fetchTutorialEntry(slug);
  const l = tutorialLang(lang);
  // No structured data on the pages we just told crawlers not to index.
  if (!e || !hasLang(e, l) || e.hidden) return children;
  const title = tutorialTitle(e, l);
  const prefix = { zh: '/zh', en: '' }[l];
  const hub = { zh: '魔方教程', en: 'Cubing Tutorials' }[l];
  return (
    <>
      <JsonLd
        data={articleJsonLd({
          headline: title,
          description: describe(e, title)[l],
          url: `${SITE_URL}${prefix}/tutorial-legacy/${encodeURIComponent(slug)}`,
          lang,
          partOfName: hub,
          partOfUrl: `${SITE_URL}${prefix}/tutorial-legacy`,
        })}
      />
      {children}
    </>
  );
}
