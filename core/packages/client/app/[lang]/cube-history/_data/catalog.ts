import gan from './gan.json';
import ganSmart from './gan-smart.json';
import moyu from './moyu-yj.json';
import moyuVariants from './moyu-yj-variants.json';
import other from './qiyi-other.json';
import qiyi from './qiyi-xman.json';
import historical from './historical.json';
import historicalBrands from './historical-brands.json';
import historicalCollectibles from './historical-collectibles.json';
import aliases from './aliases.json';
import type { Dataset } from './types';

// JSON stays portable. The research contract is checked by cube-history.test.ts.
const datasets = [historical, historicalBrands, historicalCollectibles, gan, ganSmart, moyu, moyuVariants, other, qiyi] as Dataset[];
export const CUBES = datasets.flatMap(dataset => dataset.cubes);
export const SOURCES = datasets.flatMap(dataset => dataset.sources);
export const SOURCE_BY_ID = new Map(SOURCES.map((source, index) => [source.id, { ...source, number: index + 1 }]));
export const CUBE_ALIASES = aliases;
const canonicalIds = new Map(aliases.map(alias => [alias.from, alias.to]));
/** Historical shared links remain usable when evidence identifies duplicate records. */
export const resolveCubeId = (id: string): string => canonicalIds.get(id) ?? id;
