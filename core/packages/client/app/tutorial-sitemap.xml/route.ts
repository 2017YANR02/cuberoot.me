import { fetchTutorialCatalog, type CatalogEntry } from '@/lib/tutorial-seo';

// Runtime-generated tutorial sitemap, DECOUPLED from `next build` — same split,
// and for the same reason, as app/recon-sitemap.xml/route.ts: app/sitemap.ts is
// deliberately network-free so a slow static origin can never fail a deploy,
// which leaves the ~609 tutorial posts and their category listings with no way
// into a sitemap at all. `force-dynamic` guarantees this runs at request time.
//
// On failure we return a valid EMPTY urlset with a short cache, never a 500 —
// a 500 makes search engines drop the sitemap outright. Advertised in
// app/robots.ts alongside /sitemap.xml.
export const dynamic = 'force-dynamic';

const BASE = 'https://cuberoot.me';

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => XML_ESCAPE[c]);

const urlset = (inner: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
  `xmlns:xhtml="http://www.w3.org/1999/xhtml">${inner}</urlset>`;

const xml = (body: string, cache: string): Response =>
  new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': cache },
  });

// Browser 1h; CDN 1d then serve-stale up to 7d while revalidating in the background.
const CACHE_OK = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
// Failure: short cache so a transient origin blip doesn't pin an empty sitemap for a day.
const CACHE_ERR = 'public, max-age=300, s-maxage=300';

// Pattern B: English is the bare URL, Chinese is /zh/….
const enUrl = (path: string) => `${BASE}/${path}`;
const zhUrl = (path: string) => `${BASE}/zh/${path}`;

/** One <url>. `langs` lists ONLY the languages this page genuinely exists in —
 *  hreflang is a claim that a translation exists, so emitting the pair for a
 *  post that has just one language would point crawlers at a page rendering the
 *  wrong language. With a single language we emit the loc alone and no
 *  alternates; the layout marks the other URL noindex to match. */
function urlEntry(path: string, langs: ('en' | 'zh')[], lastmod: string): string {
  const hasEn = langs.includes('en');
  const en = esc(enUrl(path));
  const zh = esc(zhUrl(path));
  const loc = hasEn ? en : zh;
  const alts =
    langs.length === 2
      ? `<xhtml:link rel="alternate" hreflang="en" href="${en}"/>` +
        `<xhtml:link rel="alternate" hreflang="zh" href="${zh}"/>` +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>`
      : '';
  return `<url><loc>${loc}</loc>${lastmod}${alts}</url>`;
}

/** catalog mtime is a float ms epoch. Unlike the static sitemap — where every
 *  URL would have carried the same build timestamp — this is a real per-post
 *  date, so it is worth emitting. Bad values are dropped rather than guessed. */
function lastmodOf(e: CatalogEntry): string {
  if (!Number.isFinite(e.mtime) || e.mtime <= 0) return '';
  const d = new Date(e.mtime);
  const iso = Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  return iso ? `<lastmod>${iso}</lastmod>` : '';
}

function langsOf(e: CatalogEntry): ('en' | 'zh')[] {
  const langs: ('en' | 'zh')[] = [];
  if (e.hasEn) langs.push('en');
  if (e.hasZh) langs.push('zh');
  return langs;
}

export async function GET(): Promise<Response> {
  const catalog = await fetchTutorialCatalog();
  if (catalog.length === 0) return xml(urlset(''), CACHE_ERR);

  const visible = catalog.filter((e) => !e.hidden);

  const posts = visible
    .map((e) => {
      const langs = langsOf(e);
      // A post with neither language flag has nothing to render; skip it.
      if (langs.length === 0) return '';
      return urlEntry(`tutorial/${encodeURIComponent(e.slug)}`, langs, lastmodOf(e));
    })
    .join('');

  // Category listings: bilingual by construction (the label is translated and
  // the list itself is language-neutral), so both URLs are always legitimate.
  // Newest post in the category doubles as the listing's lastmod.
  const newest = new Map<string, number>();
  for (const e of visible) {
    if (!Number.isFinite(e.mtime)) continue;
    newest.set(e.category, Math.max(newest.get(e.category) ?? 0, e.mtime));
  }
  const categories = [...newest.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, mtime]) =>
      urlEntry(
        `tutorial/c/${encodeURIComponent(cat)}`,
        ['en', 'zh'],
        lastmodOf({ mtime } as CatalogEntry),
      ),
    )
    .join('');

  return xml(urlset(posts + categories), CACHE_OK);
}
