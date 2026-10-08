import gan from './gan.json';
import moyu from './moyu-yj.json';
import moyuVariants from './moyu-yj-variants.json';
import other from './qiyi-other.json';
import qiyi from './qiyi-xman.json';
import historical from './historical.json';
import historicalBrands from './historical-brands.json';
import historicalCollectibles from './historical-collectibles.json';
import type { Dataset } from './types';

// JSON stays portable. The research contract is checked by cube-history.test.ts.
const datasets = [historical, historicalBrands, historicalCollectibles, gan, moyu, moyuVariants, other, qiyi] as Dataset[];
export const CUBES = datasets.flatMap(dataset => dataset.cubes);
export const SOURCES = datasets.flatMap(dataset => dataset.sources);
export const SOURCE_BY_ID = new Map(SOURCES.map((source, index) => [source.id, { ...source, number: index + 1 }]));
