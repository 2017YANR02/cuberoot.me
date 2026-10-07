import gan from './gan.json';
import moyu from './moyu-yj.json';
import other from './qiyi-other.json';
import historical from './historical.json';
import type { Dataset } from './types';

// JSON stays portable. The research contract is checked by cube-history.test.ts.
const datasets = [historical, gan, moyu, other] as Dataset[];
export const CUBES = datasets.flatMap(dataset => dataset.cubes);
export const SOURCES = datasets.flatMap(dataset => dataset.sources);
export const SOURCE_BY_ID = new Map(SOURCES.map((source, index) => [source.id, { ...source, number: index + 1 }]));
