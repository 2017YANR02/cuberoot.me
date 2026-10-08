import type { Cube } from './types';
import { BRANDS, PERIODS, TECHNOLOGIES } from './labels';

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
  return value.normalize('NFKC').toLowerCase().replace(/×/g, 'x').replace(/[\s_·\-]/g, '');
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
  if (filters.evidence === 'cny' && !cube.prices.some(price => price.currency === 'CNY')) return false;
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
  const q = normalizeSearch(filters.q.trim());
  if (!q) return true;
  const brand = BRANDS[cube.brand];
  const chineseBrand = brand?.zh.replace(/[^\u4e00-\u9fff]/g, '') ?? '';
  const corpus = [
    cube.id, cube.brand, BRANDS[cube.brand]?.zh ?? '', BRANDS[cube.brand]?.en ?? '', cube.name.zh, cube.name.en,
    chineseBrand + cube.name.zh, cube.brand + cube.name.en,
    ...cube.variants, ...cube.tags, ...cube.specs.mechanism,
    ...cube.highlights.flatMap(item => [item.zh, item.en]),
    cube.assessment.summary.zh, cube.assessment.summary.en,
  ].join(' ');
  const searchable = normalizeSearch(corpus);
  if (searchable.includes(q)) return true;
  // A brand, model and mechanism need not be adjacent in the source text.
  const terms = filters.q.normalize('NFKC').trim().split(/\s+/).map(normalizeSearch).filter(Boolean);
  return terms.every(term => searchable.includes(term));
}

export function sortCubes(cubes: readonly Cube[], order: string): Cube[] {
  return [...cubes].sort((a, b) => {
    if (order === 'name') return a.name.en.localeCompare(b.name.en, 'en') || a.id.localeCompare(b.id, 'en');
    // Missing dates always stay at the end, in either direction.
    if (a.year === null && b.year !== null) return 1;
    if (b.year === null && a.year !== null) return -1;
    const aDate = a.release.date ?? String(a.year ?? '');
    const bDate = b.release.date ?? String(b.year ?? '');
    const direction = order === 'oldest' ? 1 : -1;
    return direction * aDate.localeCompare(bDate, 'en') || a.id.localeCompare(b.id, 'en');
  });
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
    ...(cube.familyPrices ?? []).map(price => price.sourceId),
    ...(cube.image ? [cube.image.sourceId] : []),
    ...(cube.rating ? [cube.rating.sourceId] : []),
  ])];
}
