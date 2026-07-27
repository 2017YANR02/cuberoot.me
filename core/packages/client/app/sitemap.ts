import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MetadataRoute } from 'next';
import { ALG_CATALOG, ALG_PUZZLES } from '@cuberoot/shared/alg';
import { TOC_SLUGS } from './[lang]/math/group/_data/toc';
import { LISTED_CATEGORIES } from '@/lib/lsll/model';
import { STACK_TOOLS_META } from './[lang]/code/stack/_lib/stack_meta';
import { LLM_TOOLS_META } from './[lang]/code/llm/_lib/llm_meta';
import { ABOUT_REGISTRY } from './[lang]/wca/about/[id]/_lib/registry';

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
//
// /math/group/<slug> is the big one: 63 sections of original long-form writing,
// one URL each, all invisible to search because the scan below skips [slug].
// The slug list is a static array in the page's own data module, so listing them
// costs no I/O and cannot go stale relative to the page.
//
// Deliberately still ABSENT: /wca/persons/<id> (~200k) and /wca/comp/<slug>
// (~17k). Those render from a single sentinel shell with client-fetched content,
// so listing them would spend crawl budget to deliver empty pages — robots.txt
// disallows them for the same reason.
//
// /tutorial/<slug> and its category listings ARE indexed, but from
// app/tutorial-sitemap.xml/route.ts: enumerating them needs a catalog fetch
// this file must not make.
//
// Everything below, by contrast, comes from a static array that the matching
// route already feeds to generateStaticParams — the pages are prerendered at
// build, so listing them costs no I/O and cannot go stale relative to what
// actually exists. Deliberately NOT listed: the /run and /select trainer leaves
// under each alg set (interactive tools, not content, and near-duplicates of
// the set page) and LSLL's degenerate O group (LISTED_CATEGORIES drops it
// because the site itself does not link it — see LsllCategory.pureLL).
const EXTRA = [
  ...(ALG_PUZZLES as readonly string[]).map((puzzle) => `alg/${puzzle}`),
  ...Object.entries(ALG_CATALOG).flatMap(([puzzle, sets]) =>
    sets.map((s) => `alg/${puzzle}/${s.slug}`),
  ),
  ...LISTED_CATEGORIES.map((c) => `alg/lsll/${c.slug}`),
  ...TOC_SLUGS.map((slug) => `math/group/${slug}`),
  ...STACK_TOOLS_META.map((t) => `code/stack/${t.slug}`),
  ...LLM_TOOLS_META.map((t) => `code/llm/${t.slug}`),
  ...Object.keys(ABOUT_REGISTRY).map((id) => `wca/about/${id}`),
  'recognize/pll',
  'recognize/oll',
];

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
  // No lastModified. It used to be `new Date()`, which stamped every one of
  // these URLs with the build time — so a deploy that changed one page told
  // crawlers all 265 had changed. Google states it uses lastmod only when the
  // value is consistently accurate and ignores the field outright when it is
  // not, so a uniform build timestamp is worse than nothing. A real per-page
  // date is not available here either: file mtimes are the checkout time in CI
  // (git does not preserve them), and this file must stay I/O-free, which rules
  // out shelling out to git log. Omitting the field is the honest option; the
  // recon sitemap, which has genuine per-item dates, still emits it.
  return routes.map((path) => ({
    url: en(path),
    alternates: {
      languages: { en: en(path), zh: zh(path), 'x-default': en(path) },
    },
  }));
}
