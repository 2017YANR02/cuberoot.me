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
      { userAgent: '*', allow: '/' },
      { userAgent: BLOCKED_BOTS, disallow: '/' },
    ],
    sitemap: 'https://www.cuberoot.me/sitemap.xml',
  };
}
