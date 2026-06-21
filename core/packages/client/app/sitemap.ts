import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MetadataRoute } from 'next';
import type { ReconSolve } from '@cuberoot/shared';
import { apiUrl } from '@/lib/api-base';
import { reconCanonical, reconPathSeg } from '@/lib/recon-seo';

// Statically generated at build time → the fs scan below runs during
// `next build` (where app/ source exists) and the result is baked into the
// static /sitemap.xml served by both Vercel and the self-hosted standalone.
export const dynamic = 'force-static';

// Canonical host is the bare domain (www redirects to it). List final, non-redirecting URLs.
const BASE = 'https://cuberoot.me';

// Kept OUT (dev/poc/internal pages, no SEO value). Locale-stripped path, exact.
// 'trainer' now redirects to 'trainer/333' (event in the path) → list the canonical instead.
const EXCLUDE = new Set(['ffmpeg-poc', 'jsonEditor', 'trainer']);

// Dynamic-segment pages worth indexing at a specific value (the scan skips
// [param] dirs since it can't know which values are valid).
const EXTRA = ['recognize/pll', 'trainer/333'];

// Walk app/[lang]/** collecting static routes (dirs containing page.tsx),
// skipping dynamic [param], private _folders and (route groups).
function scanRoutes(): string[] {
  const root = join(process.cwd(), 'app', '[lang]');
  const found: string[] = [];
  const walk = (dir: string, rel: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === 'page.tsx')) found.push(rel);
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const c = e.name[0];
      if (c === '[' || c === '_' || c === '(') continue;
      walk(join(dir, e.name), rel ? `${rel}/${e.name}` : e.name);
    }
  };
  walk(root, '');
  return found;
}

// Fetch all OFFICIAL recons at build and emit one sitemap entry each (Pattern B
// alternates via reconCanonical). Any failure (network / non-ok / parse) is
// swallowed so it never breaks the rest of the sitemap. Non-official recons are
// noindex on the detail page → excluded here (contradictory + crawl-budget waste).
// NOTE: one sitemap file caps at 50k URLs; with ~2375 recons we're well under.
// If recons ever approach that, split via generateSitemaps() — not needed now.
async function reconEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(apiUrl('/v1/recon/list'));
    if (!res.ok) return [];
    const list = (await res.json()) as ReconSolve[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r.official === true)
      .map((r) => {
        const id = String(r.id);
        // Slugged segment (`<id>-<slug>`); reconPathSeg falls back to bare id if
        // the list row lacks the fields needed for a slug — never breaks build.
        const seg = reconPathSeg(r);
        const en = reconCanonical(id, 'en', seg);
        const zhUrl = reconCanonical(id, 'zh', seg);
        return {
          url: en,
          lastModified: r.date ? new Date(r.date) : new Date(),
          alternates: { languages: { en, zh: zhUrl, 'x-default': en } },
        };
      });
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [...new Set([...scanRoutes(), ...EXTRA])]
    .filter((r) => !EXCLUDE.has(r))
    .sort();
  // Pattern B: English is the BARE URL (no /en prefix); Chinese is /zh/….
  const en = (path: string) => (path ? `${BASE}/${path}` : `${BASE}/`);
  const zh = (path: string) => (path ? `${BASE}/zh/${path}` : `${BASE}/zh`);
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = routes.map((path) => ({
    url: en(path),
    lastModified: now,
    alternates: {
      languages: { en: en(path), zh: zh(path), 'x-default': en(path) },
    },
  }));
  return [...staticEntries, ...(await reconEntries())];
}
