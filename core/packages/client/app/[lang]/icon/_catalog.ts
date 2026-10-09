// /icon gallery data — grouped view over the SINGLE source of truth for every
// cube icon on the site: @cuberoot/event-icon. Those maps are generated from
// packages/event-icon/svg/{event,unofficial,penalty,puzzle}/*.svg,
// upstream artwork from https://github.com/cubing/icons plus CubeRoot originals
// in svg/puzzle. The same keys drive <CubingIcon> / <EventIcon> and the /sim puzzle picker, so
// adding/removing an icon there updates /sim, EventIcon AND this gallery at once
// — this page is just the browsable management view of that shared set.
//
// The penalty illustrations live in their own map (168KB, 20-27KB apiece) and
// nothing renders them through CubingIcon — this gallery is their only consumer,
// so it is also the only place that pays for them. See gen-svg-map.mjs.

import { PENALTY_SVG_BY_KEY, SVG_BY_KEY } from '@cuberoot/event-icon/maps';

export type IconCategory = 'event' | 'puzzle' | 'unofficial' | 'penalty';

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

const CATEGORY_ORDER: IconCategory[] = ['event', 'puzzle', 'unofficial', 'penalty'];
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
  const byCat: Record<IconCategory, IconEntry[]> = { event: [], puzzle: [], unofficial: [], penalty: [] };
  for (const [key, svg] of [...Object.entries(SVG_BY_KEY), ...Object.entries(PENALTY_SVG_BY_KEY)]) {
    const parsed = parseKey(key);
    if (!parsed) continue;
    byCat[parsed.category].push({ key, category: parsed.category, slug: parsed.slug, svg });
  }
  return CATEGORY_ORDER.map((category) => ({ category, entries: byCat[category] }));
})();

export const CATEGORY_LABEL: Record<IconCategory, { en: string; zh: string }> = {
  event: { en: 'WCA events', zh: 'WCA 项目' },
  puzzle: { en: 'CubeRoot puzzle designs', zh: '魔方根项目图标' },
  unofficial: { en: 'Unofficial events', zh: '非官方项目' },
  penalty: { en: 'Penalties', zh: '惩罚' },
};

/** Data URI of the original (fill-less) SVG — for download / right-click "Save link as". */
export function svgHref(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
