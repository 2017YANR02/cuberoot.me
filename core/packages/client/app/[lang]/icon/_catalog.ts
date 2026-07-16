// /icon gallery data — grouped view over the SINGLE source of truth for every
// cube icon on the site: components/EventIcon/svg-map.ts (SVG_BY_KEY). That map
// is generated from components/EventIcon/svg/{event,unofficial,penalty}/*.svg,
// a verbatim vendored copy of https://github.com/cubing/icons (src/svg). The
// same keys drive <CubingIcon> / <EventIcon> and the /sim puzzle picker, so
// adding/removing an icon there updates /sim, EventIcon AND this gallery at once
// — this page is just the browsable management view of that shared set.

import { SVG_BY_KEY } from '@/components/EventIcon/svg-map';

export type IconCategory = 'event' | 'unofficial' | 'penalty';

export interface IconEntry {
  /** Full cubing-icon class / CubingIcon key, e.g. 'event-333'. */
  key: string;
  category: IconCategory;
  /** Slug after the category prefix ('333' / 'fto' / 'A4b') — the upstream filename. */
  slug: string;
  /** Raw inline SVG markup — no fill, so it inherits currentColor (theme-adaptive). */
  svg: string;
}

export interface IconGroup {
  category: IconCategory;
  entries: IconEntry[];
}

const CATEGORY_ORDER: IconCategory[] = ['event', 'unofficial', 'penalty'];
const CATEGORY_SET = new Set<string>(CATEGORY_ORDER);

// Slugs only ever use letters/digits/underscore (never '-'), so splitting on
// the first hyphen cleanly separates category from slug.
function parseKey(key: string): { category: IconCategory; slug: string } | null {
  const i = key.indexOf('-');
  if (i < 0) return null;
  const category = key.slice(0, i);
  if (!CATEGORY_SET.has(category)) return null;
  return { category: category as IconCategory, slug: key.slice(i + 1) };
}

export const ICON_GROUPS: IconGroup[] = (() => {
  const byCat: Record<IconCategory, IconEntry[]> = { event: [], unofficial: [], penalty: [] };
  for (const [key, svg] of Object.entries(SVG_BY_KEY)) {
    const parsed = parseKey(key);
    if (!parsed) continue;
    byCat[parsed.category].push({ key, category: parsed.category, slug: parsed.slug, svg });
  }
  return CATEGORY_ORDER.map((category) => ({ category, entries: byCat[category] }));
})();

export const CATEGORY_LABEL: Record<IconCategory, { en: string; zh: string }> = {
  event: { en: 'WCA events', zh: 'WCA 项目' },
  unofficial: { en: 'Unofficial events', zh: '非官方项目' },
  penalty: { en: 'Penalties', zh: '惩罚' },
};

/** Data URI of the original (fill-less) SVG — for download / right-click "Save link as". */
export function svgHref(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
