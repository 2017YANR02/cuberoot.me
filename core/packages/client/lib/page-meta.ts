import type { Metadata } from 'next';
import { PAGE_META, type PageMetaEntry } from '@cuberoot/shared/page-catalog';
export { PAGE_META, type PageMetaEntry, type Msg } from '@cuberoot/shared/page-catalog';

// Per-route <title> and <meta name="description"> for the whole site.
//
// WHY THIS EXISTS: 180 of the 228 pages are 'use client', and a client component
// cannot export `metadata`. So every page set its tab title from the
// useDocumentTitle hook — after hydration, in the browser. The server HTML that
// crawlers, link unfurlers and AI assistants actually read carried NO <title> at
// all (measured: 0 of 202 sitemap URLs) and one identical site-wide description.
//
// The fix does not require splitting any page into server + client halves. A
// route's layout.tsx may be a server component even when its page.tsx is
// 'use client', and metadata declared in the layout applies to the page beneath
// it. So each route gets a three-line layout.tsx that calls pageMetadata('<route>')
// and renders children unchanged.
//
// The zh/en strings in shared/src/page_catalog.ts were seeded from useDocumentTitle;
// subpage browser titles use these page names without repeating the site brand.
// Adding a route: add an entry in that shared catalog, then create layout.tsx (see any
// existing one). A route with no entry simply inherits the site-wide defaults,
// which is the old behaviour — never a crash.
//
// Language comes from the [lang] route param, NOT from the i18n singleton:
// tr()/useT() are client-only, and reading headers() here would opt the whole
// site out of static rendering.
const BRAND = 'CubeRoot';
const SEP = ' — ';
// Re-included on every openGraph object below: Next REPLACES the parent
// openGraph per segment rather than deep-merging, so a page that sets its own
// og:title without an image would lose the share thumbnail and unfurl as plain
// text (notably on WeChat).
const SHARE_IMAGE = '/icons/CubeRoot.png';
function pick(lang: string): 'zh' | 'en' {
  return lang === 'zh' ? 'zh' : 'en';
}

/** Build a Metadata object from an entry — shared by pageMetadata and callers
 *  that derive entries from their own data (e.g. the regulation chapters). */
export function metadataFromEntry(entry: PageMetaEntry, lang: string): Metadata {
  const l = pick(lang);
  const page = entry.title[l].trim();
  const title = page || BRAND;
  const shareTitle = page && page !== BRAND ? `${BRAND}${SEP}${page}` : BRAND;
  const description = entry.description?.[l];
  return {
    title,
    ...(description ? { description } : {}),
    openGraph: {
      title: shareTitle,
      ...(description ? { description } : {}),
      type: 'website',
      siteName: BRAND,
      images: [{ url: SHARE_IMAGE, width: 640, height: 640, alt: BRAND }],
    },
    twitter: {
      card: 'summary',
      title: shareTitle,
      ...(description ? { description } : {}),
      images: [SHARE_IMAGE],
    },
  };
}

/** generateMetadata factory for a static route. Usage in <route>/layout.tsx:
 *    export const generateMetadata = pageMetadata('math/group');
 */
export function pageMetadata(route: string) {
  return async function generateMetadata({ params }: {
    params: Promise<{ lang: string }>;
  }): Promise<Metadata> {
    const entry = PAGE_META[route];
    if (!entry) return {};
    const { lang } = await params;
    return metadataFromEntry(entry, lang);
  };
}
