import type { ReconSolve } from '@cuberoot/shared';
import { apiUrl } from '@/lib/api-base';
import { reconCanonical, reconPathSeg } from '@/lib/recon-seo';

// Runtime-generated recon sitemap, DECOUPLED from `next build`.
//
// The recon list is ~1.3MB and takes ~13s from the API. Fetching it during the
// static build (as app/sitemap.ts used to) blew Next's 60s per-page cap whenever
// the API was busy and failed the whole deploy. `force-dynamic` guarantees this
// runs at request time — never at build — so a slow/degraded recon API can only
// ever make THIS one sitemap stale, never break a deploy.
//
// CDN-cached via s-maxage (Vercel edge / nginx): the ~13s origin fetch runs at
// most once per day per region; crawlers are served from cache. On any failure we
// return a valid EMPTY urlset with a short cache so we retry soon — never a 500,
// which would make search engines drop the sitemap. Advertised to crawlers in
// app/robots.ts alongside /sitemap.xml.
//
// Only OFFICIAL (WCA) recons: non-official detail pages are noindex, so listing
// them would contradict that and waste crawl budget. One sitemap file caps at 50k
// URLs; ~1.6k wca recons is well under (split via a sitemap index if it ever nears).
export const dynamic = 'force-dynamic';

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
// Failure: short cache so a transient API blip doesn't pin an empty sitemap for a day.
const CACHE_ERR = 'public, max-age=300, s-maxage=300';

export async function GET(): Promise<Response> {
  let list: ReconSolve[];
  try {
    const res = await fetch(apiUrl('/v1/recon/list'), {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`recon/list ${res.status}`);
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) throw new Error('recon/list not an array');
    list = data as ReconSolve[];
  } catch {
    return xml(urlset(''), CACHE_ERR);
  }

  const entries = list
    .filter((r) => r.official === 'wca')
    .map((r) => {
      const id = String(r.id);
      // Slugged segment (`<id>-<slug>`); reconPathSeg falls back to bare id when
      // the row lacks the fields for a slug — never throws.
      const seg = reconPathSeg(r);
      const en = esc(reconCanonical(id, 'en', seg));
      const zh = esc(reconCanonical(id, 'zh', seg));
      const lastmod =
        r.date && /^\d{4}-\d{2}-\d{2}/.test(r.date)
          ? `<lastmod>${r.date.slice(0, 10)}</lastmod>`
          : '';
      return (
        `<url><loc>${en}</loc>${lastmod}` +
        `<xhtml:link rel="alternate" hreflang="en" href="${en}"/>` +
        `<xhtml:link rel="alternate" hreflang="zh" href="${zh}"/>` +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${en}"/></url>`
      );
    })
    .join('');

  return xml(urlset(entries), CACHE_OK);
}
