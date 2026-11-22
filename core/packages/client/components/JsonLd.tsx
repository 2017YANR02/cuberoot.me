// schema.org structured data, rendered as a <script type="application/ld+json">.
//
// Why it matters here specifically: most of this site's pages are client
// components whose visible text arrives after hydration. Structured data is
// plain markup in the server HTML, so it is the one description of a page that
// every consumer — search engines, link unfurlers, assistants that do not run
// JS — can read the same way.
//
// No 'use client': it renders to markup and holds no state, so it works from a
// server layout (the usual case) and from inside a client component alike.
//
// Only ever describe what the page actually shows. An Article with an invented
// datePublished or an aggregateRating nobody submitted is structured-data spam,
// and Google penalises it — every field below is derived from real page data.

export interface JsonLdProps {
  /** A schema.org object, or several independent nodes with their own context. */
  data: Record<string, unknown> | Record<string, unknown>[];
}

export default function JsonLd({ data }: JsonLdProps) {
  const nodes = Array.isArray(data) ? data : [data];
  // Safari/WebKit's structured-data reader can throw when a JSON-LD script
  // contains a top-level array (WebKit bug 255764). Emit one object per script
  // instead, retaining the original entities and their contexts.
  return <>{nodes.map((node, index) => (
    <script
      key={index}
      type="application/ld+json"
      // Escape literal < characters so text values cannot terminate the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replace(/</g, '\\u003c') }}
    />
  ))}</>;
}

export const SITE_URL = 'https://cuberoot.me';
export const SITE_NAME = 'CubeRoot';

/** The publisher reference every Article on the site points at. */
export const PUBLISHER = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icons/CubeRoot.png`,
} as const;

/** Article node for a long-form page. `lang` is the [lang] route param. */
export function articleJsonLd(opts: {
  headline: string;
  description: string;
  url: string;
  lang: string;
  /** Optional breadcrumb-ish parent, e.g. the essay a section belongs to. */
  partOfName?: string;
  partOfUrl?: string;
}): Record<string, unknown> {
  const { headline, description, url, lang, partOfName, partOfUrl } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    // BCP-47 tags; the site serves Simplified Chinese only.
    inLanguage: lang === 'zh' ? 'zh-Hans' : 'en',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    author: PUBLISHER,
    publisher: PUBLISHER,
    ...(partOfName && partOfUrl
      ? { isPartOf: { '@type': 'CreativeWork', name: partOfName, url: partOfUrl } }
      : {}),
  };
}
