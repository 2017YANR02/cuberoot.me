import type { AlgCase } from '@cuberoot/shared/alg';
import { algCaseDetailHref, buildCaseSlugMap } from './alg_case_link';
import { ollCommentName, pllCommentName, primaryCaseName, zbllCommentLabel } from './alg_case_display';

export interface ReconCommentLink { start: number; end: number; href: string }
export type ReconCommentCases = ReadonlyMap<string, ReadonlyMap<string, string>>;

const labels = /\b(ZBLL|ZBLS|EPLL|OLL|PLL|F2L|COLL)\b(?:[- \t]+([A-Za-z0-9][A-Za-z0-9+-]*(?:[ \t]+\d+)?))?/gi;
const caseKey = (name: string) => name.toLowerCase().replace(/\s+/g, '');

/** Use the library's source names, display names and canonical case slugs together. */
export function reconCommentCaseIndex(set: string, cases: AlgCase[]): Map<string, string> {
  const slugs = buildCaseSlugMap(cases, set);
  const index = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const c of cases) {
    const slug = c.id == null ? undefined : slugs.byId.get(c.id);
    if (!slug) continue;
    const href = algCaseDetailHref('3x3', set, slug);
    const aliases = [c.name, c.meta?.ollcp, primaryCaseName('3x3', set, c)];
    if (set === 'oll') aliases.push(ollCommentName(c.name));
    if (set === 'pll') aliases.push(pllCommentName(c.name));
    if (set === 'zbll') aliases.push(zbllCommentLabel(c.name) ?? undefined);
    for (const alias of aliases) {
      if (!alias) continue;
      const key = caseKey(alias.replace(new RegExp(`^${set}[\\s-]+`, 'i'), ''));
      if (index.has(key) && index.get(key) !== href) ambiguous.add(key);
      index.set(key, href);
    }
  }
  for (const key of ambiguous) index.delete(key);
  return index;
}

/** Offsets are in the original line; never rewrite the player's source text. */
export function reconCommentLinks(line: string, cases: ReconCommentCases = new Map()): ReconCommentLink[] {
  const comment = line.indexOf('//');
  if (comment < 0) return [];
  const offset = comment + 2;
  const text = line.slice(offset);
  const pattern = new RegExp(labels);
  const links: ReconCommentLink[] = [];
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const set = match[1].toLowerCase().replace(/^epll$/, 'pll');
    const exact = match[2] ? cases.get(set)?.get(caseKey(match[2])) : undefined;
    const length = exact ? match[0].length : match[1].length;
    links.push({
      start: offset + match.index,
      end: offset + match.index + length,
      href: exact ?? `/alg/3x3/${set}`,
    });
    pattern.lastIndex = match.index + length;
  }
  return links;
}
