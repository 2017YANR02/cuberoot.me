import type { MetadataRoute } from 'next';

// AI/content-training and third-party SEO-audit crawlers hammer the high-
// cardinality static pages (~200k person + ~17k comp URLs, reachable via
// internal links, served from the CDN as plain Edge Requests) with zero SEO
// upside. Block them by UA. Real search engines (Googlebot / Bingbot /
// Baiduspider / YandexBot / DuckDuckBot) and on-demand user fetches stay
// fully allowed, so search indexing is unaffected.
const BLOCKED_BOTS = [
  // AI training / scraping
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-Web', 'anthropic-ai',
  'CCBot', 'Google-Extended', 'Applebot-Extended',
  'Bytespider', 'PerplexityBot', 'Amazonbot',
  'meta-externalagent', 'FacebookBot', 'cohere-ai',
  'Diffbot', 'ImagesiftBot', 'Omgilibot', 'YouBot', 'Timpibot',
  // Third-party SEO-audit crawlers (no search visibility, pure load)
  'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'DataForSeoBot', 'BLEXBot',
];

// Served at /robots.txt.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // /stats/* (JSON data) and /api/* (live endpoints) are machine-fetched by
      // the app, never content — keep all crawlers out so they stop re-crawling
      // raw data files (Baidu alone hit /stats/*.json thousands of times/day).
      // /recon/submit/* are auth-gated edit forms (one static sentinel shell, also
      // noindex'd) — zero search value, keep crawlers out so they don't spend
      // budget on the id space. /recon/submit (new form) + /recon/submit-sketch
      // stay crawlable (trailing slash scopes this to the edit subtree).
      { userAgent: '*', allow: '/', disallow: ['/stats/', '/api/', '/recon/submit/'] },
      { userAgent: BLOCKED_BOTS, disallow: '/' },
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
