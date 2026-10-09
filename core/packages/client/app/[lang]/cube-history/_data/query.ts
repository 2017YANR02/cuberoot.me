import type { Cube } from './types';
import { BRANDS, CATEGORIES, MECHANISMS, PERIODS, TECHNOLOGIES, TIERS } from './labels';

export const PRIORITY_BRANDS = ['GAN', 'MoYu', 'QiYi', 'YJ'] as const;

export function sortBrandKeys(brands: readonly string[]): string[] {
  const priority = new Map<string, number>(PRIORITY_BRANDS.map((brand, index) => [brand, index]));
  return [...new Set(brands)].sort((a, b) =>
    (priority.get(a) ?? PRIORITY_BRANDS.length) - (priority.get(b) ?? PRIORITY_BRANDS.length)
    || a.localeCompare(b, 'en'));
}

export interface CubeFilters {
  q: string;
  brand: string;
  period: string;
  category: string;
  evidence: string;
  technology: string;
  year: string;
  tier: string;
  family: string;
}
export const EMPTY_FILTERS: CubeFilters = {
  q: '', brand: 'all', period: 'all', category: 'all', evidence: 'all', technology: 'all',
  year: 'all', tier: 'all', family: 'all',
};

export function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/×/g, 'x').replace(/[\p{White_Space}\p{Punctuation}]/gu, '');
}

interface SearchText { compact: string; words: Set<string>; primaryWords: Set<string>; modelPairs: Set<string>; length: number }
interface SearchFields { names: SearchText[]; identity: SearchText; all: SearchText }
interface SearchQuery { compact: string; terms: string[]; exactTerms: string[]; modelPairs: string[] }
// Cube objects are immutable within a loaded snapshot. Normalize their bilingual
// text once, instead of rebuilding the archive corpus on every keystroke.
const searchFields = new WeakMap<Cube, SearchFields>();

function wordsFor(value: string): string[] {
  // Keep decimal sizes and adjacent numbers distinct: 54.6 is neither 546 nor
  // 54.7, and “Carry 4 2026” must retain both 4 and 2026.
  return value.normalize('NFKC').toLowerCase().replace(/×/g, 'x')
    .match(/\d+(?:\.\d+)?|[a-z]+|\p{Script=Han}+|[\p{L}\p{M}]+/gu) ?? [];
}

function joinedCompounds(value: string): string {
  // MAX-L / MAXL is one configuration; its L must not match the L in MagLev.
  // Only join letter-to-letter hyphens, never numeric separators or decimals.
  return value.normalize('NFKC').replace(/[a-z]+(?:\p{Dash_Punctuation}[a-z]+)+/giu,
    compound => compound.replace(/\p{Dash_Punctuation}/gu, ''));
}

function textFor(values: string[]): SearchText {
  const wordLists = values.map(value => wordsFor(joinedCompounds(value)));
  const words = wordLists.flat();
  const originalWords = values.map(wordsFor);
  return {
    compact: values.map(normalizeSearch).join(' '),
    // Retain the separate words too: “X Man” should still find “X-Man”.
    words: new Set([...words, ...originalWords.flat()]),
    primaryWords: new Set(words),
    modelPairs: new Set([...wordLists, ...originalWords].flatMap(list => list.flatMap((word, index) =>
      /^[a-z]+$/.test(word) && /^\d+(?:\.\d+)?$/.test(list[index + 1] ?? '') ? [word + ':' + list[index + 1]] : []))),
    length: words.length,
  };
}

function fieldsFor(cube: Cube): SearchFields {
  const cached = searchFields.get(cube);
  if (cached) return cached;
  const brand = BRANDS[cube.brand];
  const chineseBrand = brand?.zh.replace(/[^\u4e00-\u9fff]/g, '') ?? '';
  const names = [cube.name.zh, cube.name.en, chineseBrand + cube.name.zh, cube.brand + cube.name.en];
  const identity = [...names, cube.id, cube.brand, brand?.zh ?? '', brand?.en ?? '', ...cube.variants, ...cube.tags];
  const terms = [...cube.specs.mechanism.flatMap(key => [key, MECHANISMS[key]?.zh ?? '', MECHANISMS[key]?.en ?? '']),
    CATEGORIES[cube.category]?.zh ?? '', CATEGORIES[cube.category]?.en ?? '',
    TIERS[cube.tier ?? 'unknown']?.zh ?? '', TIERS[cube.tier ?? 'unknown']?.en ?? '',
    '3x3', '三阶', ...cube.highlights.flatMap(item => [item.zh, item.en]),
    cube.assessment.summary.zh, cube.assessment.summary.en];
  const result = { names: names.map(name => textFor([name])), identity: textFor(identity), all: textFor([...identity, ...terms]) };
  searchFields.set(cube, result);
  return result;
}

function queryFor(value: string): SearchQuery {
  const joined = joinedCompounds(value).toLowerCase();
  const terms = [...new Set(wordsFor(joined))];
  return {
    compact: normalizeSearch(value.trim()), terms,
    exactTerms: terms.filter(term => /^\d+(?:\.\d+)?$|^[a-z]$/.test(term)),
    // In compact model input, keep GAN3 together. A GAN356 i3 must not qualify
    // merely because its name contains GAN and a separate 3.
    modelPairs: [...joined.matchAll(/([a-z]+)(\d+(?:\.\d+)?)/g)].map(match => match[1] + ':' + match[2]),
  };
}

function hasTerm(text: SearchText, term: string): boolean {
  if (text.words.has(term)) return true;
  // Generation numbers and standalone model letters require actual words.
  if (/^\d+(?:\.\d+)?$|^[a-z]$/.test(term)) return false;
  return [...text.words].some(word => word.includes(term));
}

function matchesText(text: SearchText, query: SearchQuery): boolean {
  if (!query.terms.length || query.exactTerms.some(term => !text.words.has(term))) return false;
  if (query.modelPairs.some(pair => !text.modelPairs.has(pair))) return false;
  return text.compact.includes(query.compact) || query.terms.every(term => hasTerm(text, term));
}

function matchesSearch(cube: Cube, value: string): boolean {
  const query = queryFor(value);
  return !query.compact || matchesText(fieldsFor(cube).all, query);
}

function searchRank(cube: Cube, query: string): number {
  const fields = fieldsFor(cube);
  const q = queryFor(query);
  const nameRanks = fields.names.map(name => {
    if (!matchesText(name, q)) return 0;
    if (name.compact === q.compact) return 1000;
    // Exact configuration words outrank prefixes (MAX before MAX-L for a MAX
    // query). Within that tier, a base model precedes longer edition names.
    const extraWords = Math.min(50, Math.max(0, name.length - q.terms.length));
    if (q.terms.every(term => name.primaryWords.has(term))) return 900 - extraWords;
    if (name.compact.includes(q.compact)) return 800 - extraWords;
    return 650 - extraWords;
  });
  return Math.max(...nameRanks, matchesText(fields.identity, q) ? 450 : 100);
}

export function matchesCube(cube: Cube, filters: CubeFilters): boolean {
  if (filters.brand !== 'all' && cube.brand !== filters.brand) return false;
  if (filters.family !== 'all' && (cube.familyId ?? cube.id) !== filters.family) return false;
  if (filters.tier !== 'all' && (cube.tier ?? 'unknown') !== filters.tier) return false;
  if (filters.year === 'unknown' && cube.year !== null) return false;
  if (filters.year !== 'all' && filters.year !== 'unknown' && String(cube.year) !== filters.year) return false;
  if (filters.category !== 'all' && cube.category !== filters.category) return false;
  if (filters.period === 'unknown' && cube.year !== null) return false;
  if (filters.period !== 'all' && filters.period !== 'unknown') {
    const period = PERIODS.find(item => item.id === filters.period);
    if (period && (cube.year === null || cube.year < period.from || cube.year > period.to)) return false;
  }
  if (filters.evidence === 'official' && cube.release.basis !== 'official') return false;
  if (filters.evidence === 'cny' && cube.prices.length === 0) return false;
  if (filters.evidence === 'missing-price' && cube.prices.length > 0) return false;
  if (filters.evidence === 'with-image' && !cube.image) return false;
  if (filters.evidence === 'missing-image' && cube.image) return false;
  if (filters.evidence === 'announced' && cube.status !== 'announced') return false;
  if (filters.technology !== 'all' && filters.technology in TECHNOLOGIES) {
    const tokens = [...cube.specs.mechanism, ...cube.tags]
      .filter(token => !/^(non[- ]?magnetic|non[- ]?magnet|no[- ]?magnets?)$/i.test(token))
      .join(' ').toLowerCase();
    const match = filters.technology === 'magnet'
      ? /magnet|maglev|ball.?core/.test(tokens)
      : filters.technology === 'core'
        ? /core.?magnet|ball.?core|magnetic.?core|auto.?align|auto.?home/.test(tokens)
        : filters.technology === 'smart'
          ? cube.category === 'smart'
          : /maglev/.test(tokens);
    if (!match) return false;
  }
  return matchesSearch(cube, filters.q);
}

export function sortCubes(cubes: readonly Cube[], order: string, query = ''): Cube[] {
  const ranks = order === 'relevance' && query.trim()
    ? new Map(cubes.map(cube => [cube.id, searchRank(cube, query)])) : null;
  return [...cubes].sort((a, b) => {
    if (ranks) {
      const difference = (ranks.get(b.id) ?? 0) - (ranks.get(a.id) ?? 0);
      if (difference) return difference;
    }
    if (order === 'name') return a.name.en.localeCompare(b.name.en, 'en', { numeric: true }) || a.id.localeCompare(b.id, 'en');
    // Missing dates always stay at the end, in either direction.
    if (a.year === null && b.year !== null) return 1;
    if (b.year === null && a.year !== null) return -1;
    const aDate = a.release.date ?? String(a.year ?? '');
    const bDate = b.release.date ?? String(b.year ?? '');
    const direction = order === 'oldest' ? 1 : -1;
    return direction * aDate.localeCompare(bDate, 'en') || a.id.localeCompare(b.id, 'en');
  });
}

export interface CubeModelGroup {
  id: string;
  variants: Cube[];
}

/** Group an already filtered and sorted list without restoring excluded versions. */
export function groupCubesByModel(cubes: readonly Cube[]): CubeModelGroup[] {
  const groups = new Map<string, CubeModelGroup>();
  for (const cube of cubes) {
    const id = cube.familyId ?? cube.id;
    const group = groups.get(id);
    if (group) group.variants.push(cube);
    else groups.set(id, { id, variants: [cube] });
  }
  return [...groups.values()];
}

export function selectedCubes(cubes: readonly Cube[], ids: readonly string[]): Cube[] {
  const byId = new Map(cubes.map(cube => [cube.id, cube]));
  const result: Cube[] = [];
  for (const id of new Set(ids)) {
    const cube = byId.get(id);
    if (cube) result.push(cube);
    if (result.length === 4) break;
  }
  return result;
}

export function sourceIdsForCube(cube: Cube): string[] {
  return [...new Set([
    ...cube.sourceIds, ...cube.release.sourceIds, ...cube.assessment.sourceIds,
    ...cube.prices.map(price => price.sourceId),
    ...(cube.image ? [cube.image.sourceId] : []),
    ...(cube.rating ? [cube.rating.sourceId] : []),
  ])];
}
