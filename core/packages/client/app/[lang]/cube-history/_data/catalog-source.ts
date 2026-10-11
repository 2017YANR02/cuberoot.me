import gan from './gan.json';
import ganSmart from './gan-smart.json';
import moyu from './moyu-yj.json';
import moyuVariants from './moyu-yj-variants.json';
import other from './qiyi-other.json';
import qiyi from './qiyi-xman.json';
import historical from './historical.json';
import historicalBrands from './historical-brands.json';
import historicalCollectibles from './historical-collectibles.json';
import type { Dataset } from './types';

// JSON stays portable. The research contract is checked by cube-history.test.ts.
const datasets = [historical, historicalBrands, historicalCollectibles, gan, ganSmart, moyu, moyuVariants, other, qiyi] as Dataset[];
// Both language editions use mainland-China CNY quotes only. Filter before any
// view, evidence filter, coverage count or JSON export consumes the catalog.
// Keep original research observations in the datasets; never convert an
// overseas amount or change its market to manufacture a domestic quote.
export const CUBES = datasets.flatMap(dataset => dataset.cubes).map(cube => ({
  ...cube,
  prices: cube.prices.filter(price => price.region === 'CN' && price.currency === 'CNY'),
}));
export const SOURCES = datasets.flatMap(dataset => dataset.sources);
