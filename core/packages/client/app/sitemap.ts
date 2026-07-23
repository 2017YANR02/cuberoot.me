import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MetadataRoute } from 'next';

// Static-routes sitemap. The fs scan below runs during `next build` (where app/
// source exists) and the result is baked into the static /sitemap.xml served by
// both Vercel and the self-hosted standalone.
//
// This file has NO network I/O, so it can never time out the build. The dynamic,
// slow recon URLs live in a SEPARATE runtime-cached sitemap
// (app/recon-sitemap.xml/route.ts), advertised alongside this one in app/robots.ts.
// That split is deliberate: the recon list is ~1.3MB / ~13s and fetching it here
// at build used to blow Next's 60s per-page static-generation cap whenever the API
// was busy and fail the whole deploy. A slow/degraded API must never break a build.
export const dynamic = 'force-static';

// Canonical host is the bare domain (www redirects to it). List final, non-redirecting URLs.
const BASE = 'https://cuberoot.me';

// Kept OUT (dev/poc/internal pages, no SEO value). Locale-stripped path, exact.
const EXCLUDE = new Set(['ffmpeg-poc', 'jsonEditor']);

// Dynamic-segment pages worth indexing at a specific value (the scan skips
// [param] dirs since it can't know which values are valid).
const EXTRA = ['recognize/pll', 'alg/3x3'];

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

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [...new Set([...scanRoutes(), ...EXTRA])]
    .filter((r) => !EXCLUDE.has(r))
    .sort();
  // Pattern B: English is the BARE URL (no /en prefix); Chinese is /zh/….
  const en = (path: string) => (path ? `${BASE}/${path}` : `${BASE}/`);
  const zh = (path: string) => (path ? `${BASE}/zh/${path}` : `${BASE}/zh`);
  const now = new Date();
  return routes.map((path) => ({
    url: en(path),
    lastModified: now,
    alternates: {
      languages: { en: en(path), zh: zh(path), 'x-default': en(path) },
    },
  }));
}
