import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MetadataRoute } from 'next';

// Statically generated at build time → the fs scan below runs during
// `next build` (where app/ source exists) and the result is baked into the
// static /sitemap.xml served by both Vercel and the self-hosted standalone.
export const dynamic = 'force-static';

// Canonical host is www (apex 301/307s to it). List final, non-redirecting URLs.
const BASE = 'https://www.cuberoot.me';

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

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [...new Set([...scanRoutes(), ...EXTRA])]
    .filter((r) => !EXCLUDE.has(r))
    .sort();
  const at = (lang: string, path: string) => `${BASE}/${lang}${path ? `/${path}` : ''}`;
  const now = new Date();
  return routes.map((path) => ({
    url: at('en', path),
    lastModified: now,
    alternates: {
      languages: { en: at('en', path), zh: at('zh', path), 'x-default': at('en', path) },
    },
  }));
}
