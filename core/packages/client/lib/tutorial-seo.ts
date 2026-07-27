// Server-safe access to the tutorial catalog, for metadata + the tutorial
// sitemap. Runs in the RSC/metadata pass, so it must stay free of client-only
// singletons (i18n, zustand) and browser APIs — which is why the catalog URL
// and the entry types live HERE and the client hook imports them, not the other
// way round. useTutorialCatalog.ts pulls in React hooks; a server module must
// never depend on it.

import { statsUrl } from './stats-base';

export const CATALOG_URL = '/stats/tutorial/catalog.json';

export type TutorialLang = 'en' | 'zh';
export type TutorialView = 'article' | 'algset';

export interface CatalogEntry {
  slug: string;
  view: TutorialView;
  title: Partial<Record<TutorialLang, string>>;
  category: string;
  subcategory: string | null;
  topDir: string;
  thumb: string | null;
  mtime: number;
  hasEn: boolean;
  hasZh: boolean;
  order: number;
  hidden: boolean;
  quality: 'ok' | 'degraded';
  algCount: number;
}

// The catalog is a ~250KB static JSON on static.cuberoot.me. Cache it for a day:
// the tutorial pages are force-static + dynamicParams, so this fetch only ever
// runs when a slug is first rendered, never during `next build` (the route's
// generateStaticParams returns none) — a slow static origin cannot break a deploy.
const REVALIDATE = 86400;

/** Whole catalog, or [] if the static origin is unreachable. Never throws:
 *  a missing catalog must degrade to the inherited title, not a 500. */
export async function fetchTutorialCatalog(): Promise<CatalogEntry[]> {
  try {
    const res = await fetch(statsUrl(CATALOG_URL), {
      next: { revalidate: REVALIDATE, tags: ['tutorial-catalog'] },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as CatalogEntry[]) : [];
  } catch {
    return [];
  }
}

export async function fetchTutorialEntry(slug: string): Promise<CatalogEntry | null> {
  const catalog = await fetchTutorialCatalog();
  return catalog.find((e) => e.slug === slug) ?? null;
}

/** Any Chinese locale maps onto the Simplified branch (Traditional was removed). */
export function tutorialLang(lang: string): TutorialLang {
  return lang.startsWith('zh') ? 'zh' : 'en';
}

/** Does this post actually exist in the given language? Only 60 of ~609 posts
 *  are bilingual, so this decides both the sitemap's hreflang set and whether a
 *  page is worth indexing at all in that language. */
export function hasLang(e: CatalogEntry, l: TutorialLang): boolean {
  return l === 'zh' ? e.hasZh : e.hasEn;
}

/** Title in the requested language, falling back to the other one and finally
 *  the slug — the same order TutorialPostClient uses to render the heading, so
 *  the tab title can never disagree with the page. */
export function tutorialTitle(e: CatalogEntry, l: TutorialLang): string {
  return e.title[l] ?? e.title[l === 'zh' ? 'en' : 'zh'] ?? e.slug;
}
