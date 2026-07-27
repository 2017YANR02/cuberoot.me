import type { MetadataRoute } from 'next';

// Crawler policy. Three tiers, each for a different reason — see below.
//
// HISTORY (2026-07-27 revision): this file used to `Disallow: /` every AI bot,
// citing "they hammer the ~200k person + ~17k comp URLs with zero SEO upside".
// That rationale was never measured — the note that shipped it says outright
// that the AI-bot share was unmeasurable on the Vercel side. Measuring the
// origin log (29h window, 198,709 requests) put every AI crawler COMBINED at
// 77 hits (0.04%), and spot-checking their paths showed most were vulnerability
// scanners spoofing the UA (/.env, /id_rsa, /serviceAccountKey.json). Meanwhile
// Sogou — never blocked — was 38,713 hits (19.4%).
//
// So the blanket ban paid the full cost (invisible in ChatGPT Search /
// Perplexity citations) for a load problem that did not exist. The fix is to
// aim the Disallow at the expensive URL SPACE instead of at the crawlers:
// /wca/persons/ and /wca/comp/ are the only high-cardinality trees, and they
// are static sentinel shells with zero content of their own.

// The two high-cardinality trees, plus the machine-only paths. Applied to
// EVERY crawler including Google — these are the URLs that are expensive to
// crawl and worthless to index.
//
// /stats/* (JSON data) and /api/* (live endpoints) are fetched by the app, never
// content — Baidu alone used to re-crawl /stats/*.json thousands of times a day.
// /recon/submit/* are auth-gated edit forms (static sentinel, also noindex) —
// the trailing slash scopes this to the edit subtree, so /recon/submit (new
// form) and /recon/submit-sketch stay crawlable.
// /wca/persons/* (~200k) and /wca/comp/* (~17k) render from a single sentinel
// shell; their content is client-fetched, so a crawler gets an empty page after
// spending a request. Both are deliberately absent from the sitemap too.
const EXPENSIVE_PATHS = [
  '/stats/',
  '/api/',
  '/recon/submit/',
  '/wca/persons/',
  '/wca/comp/',
];

// Tier 3 — third-party SEO-audit crawlers. Pure load, zero search visibility,
// nobody reads their index but their own paying customers. Still fully banned.
// (Verified effective: 0 hits from all three in the 29h origin sample.)
const SEO_AUDIT_BOTS = [
  'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'DataForSeoBot', 'BLEXBot',
];

// Tier 2 — model-TRAINING crawlers. Blocking these costs no visibility: they
// feed pretraining corpora, not the retrieval layer that produces citations.
// Whether to allow them is a licensing/stance call, not a traffic one. Kept
// blocked (status quo), and split out from tier 1 so the two decisions can move
// independently.
const AI_TRAINING_BOTS = [
  'GPTBot', 'ClaudeBot', 'Claude-Web', 'anthropic-ai',
  'CCBot', 'Google-Extended', 'Applebot-Extended',
  'Bytespider', 'meta-externalagent', 'cohere-ai',
  'Diffbot', 'ImagesiftBot', 'Omgilibot', 'Timpibot',
];

// Tier 1 — CITATION / retrieval crawlers. These are what "GEO" actually means:
// they fetch a page so an assistant can cite it with a link. Blocking them
// deletes the site from ChatGPT Search, Perplexity, and friends. Now ALLOWED,
// under the same EXPENSIVE_PATHS limits every other crawler gets.
//   OAI-SearchBot  — ChatGPT search index
//   ChatGPT-User   — live fetch when a user opens a link in ChatGPT
//   PerplexityBot  — Perplexity index
//   Amazonbot      — Alexa / Rufus answers
//   YouBot         — You.com
//   FacebookBot    — link unfurling
// They inherit the `*` rule, so no separate entry is needed; this list exists so
// the intent is greppable and nobody re-adds them to a blocklist by reflex.
export const CITATION_BOTS_ALLOWED = [
  'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot',
  'Amazonbot', 'YouBot', 'FacebookBot',
];

// Served at /robots.txt.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everyone (real search engines + citation bots) — full site minus the
      // expensive trees.
      { userAgent: '*', allow: '/', disallow: EXPENSIVE_PATHS },

      // Sogou renders JS but caches NOTHING: 1,228 pages crawled cost 38,713
      // requests (~32 per page, every shared chunk re-downloaded at 200, never
      // 304) = 1.02 GB of the origin's 4.04 GB egress. It only ever reaches the
      // self-hosted origin (China DNS route), so it burns no Vercel quota — but
      // there is no reason to serve the same bundle 749 times. Crawl-delay is
      // the one knob Sogou documents.
      { userAgent: 'Sogou web spider', allow: '/', disallow: EXPENSIVE_PATHS, crawlDelay: 5 },

      { userAgent: AI_TRAINING_BOTS, disallow: '/' },
      { userAgent: SEO_AUDIT_BOTS, disallow: '/' },
    ],
    sitemap: [
      'https://cuberoot.me/sitemap.xml',
      // Recon detail pages live in a SEPARATE runtime-cached sitemap
      // (app/recon-sitemap.xml/route.ts) so a slow recon API can never break the
      // build — see app/sitemap.ts. Advertise it here so crawlers still find it.
      'https://cuberoot.me/recon-sitemap.xml',
    ],
  };
}
