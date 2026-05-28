import type { MetadataRoute } from 'next';

// Next App Router serves this at /sitemap.xml on both Vercel and the
// self-hosted standalone build. Canonical host is www (apex 301/307s to it),
// so list the final non-redirecting URLs here regardless of which host or
// preview/staging deploy actually serves the file.
const BASE = 'https://www.cuberoot.me';

// Curated indexable routes (locale prefix added below). Each yields
// /en/<path> + /zh/<path> with hreflang alternates. Dynamic long-tail pages
// (per-competition /wca/comp/<id>, per-person, per-alg-set) are intentionally
// excluded — add a sharded sitemap if those need indexing. Internal/poc pages
// (ffmpeg-poc, jsonEditor, visualcube, site, *-about) are left out on purpose.
const ROUTES = [
  '', // landing
  // tools
  'timer', 'sim', 'recon', 'trainer', 'recognize/pll', 'alg',
  'calc', 'battle', 'frame-count', 'mosaic', 'nemesizer', 'wb',
  // scramble suite
  'scramble', 'scramble/gen', 'scramble/analyzer', 'scramble/stats',
  'scramble/pattern', 'scramble/solver',
  // wca suite
  'wca', 'wca/calendar', 'wca/viz', 'wca/globe', 'wca/historical',
  'wca/records', 'wca/prediction', 'wca/grand-slam', 'wca/all-results',
  'wca/sum-of-ranks', 'wca/success-rate', 'wca/all-events-done', 'wca/cohort-ranks',
  // CFOP step trainers
  'cross_trainer', 'eocross_trainer', 'xcross_trainer', 'xxcross_trainer',
  'pairing_trainer', 'pseudo_pairing_trainer', 'pseudo_xcross_trainer', 'xcross_pairing_trainer',
  // content / articles
  'about', 'code', 'math', 'wiki', 'tutorial', 'memo',
  // upstream tool entry points
  'solver', 'cstimer', 'alg-trainers', 'algTrainer',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const at = (lang: string, path: string) => `${BASE}/${lang}${path ? `/${path}` : ''}`;
  const now = new Date();
  return ROUTES.map((path) => ({
    url: at('en', path),
    lastModified: now,
    alternates: {
      languages: {
        en: at('en', path),
        zh: at('zh', path),
        'x-default': at('en', path),
      },
    },
  }));
}
