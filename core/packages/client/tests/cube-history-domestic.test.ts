import { describe, expect, it } from 'vitest';
import { CUBES, SOURCE_BY_ID } from '../app/[lang]/cube-history/_data/catalog';
import { BRANDS } from '../app/[lang]/cube-history/_data/labels';
import { EMPTY_FILTERS, matchesCube } from '../app/[lang]/cube-history/_data/query';
import { preferredPrice } from '../app/[lang]/cube-history/_data/prices';
import gan from '../app/[lang]/cube-history/_data/gan.json';
import ganSmart from '../app/[lang]/cube-history/_data/gan-smart.json';
import moyu from '../app/[lang]/cube-history/_data/moyu-yj.json';
import moyuVariants from '../app/[lang]/cube-history/_data/moyu-yj-variants.json';
import other from '../app/[lang]/cube-history/_data/qiyi-other.json';
import qiyi from '../app/[lang]/cube-history/_data/qiyi-xman.json';
import historical from '../app/[lang]/cube-history/_data/historical.json';
import historicalBrands from '../app/[lang]/cube-history/_data/historical-brands.json';
import historicalCollectibles from '../app/[lang]/cube-history/_data/historical-collectibles.json';
import type { Dataset } from '../app/[lang]/cube-history/_data/types';

const original = ([historical, historicalBrands, historicalCollectibles, gan, ganSmart,
  moyu, moyuVariants, other, qiyi] as Dataset[]).flatMap(dataset => dataset.cubes);
const publicById = new Map(CUBES.map(cube => [cube.id, cube]));
const domesticPrices = (cube: (typeof original)[number]) =>
  cube.prices.filter(price => price.region === 'CN' && price.currency === 'CNY');

describe('cube history domestic-price publication policy', () => {
  it('preserves every version and all non-price facts while publishing only exact domestic observations', () => {
    expect(CUBES.map(cube => cube.id)).toEqual(original.map(cube => cube.id));
    for (const raw of original) {
      expect(publicById.get(raw.id), raw.id).toEqual({ ...raw, prices: domesticPrices(raw) });
    }
    // The original evidence is not mutated or reclassified to fill a price gap.
    expect(original.some(cube => cube.prices.some(price => price.currency !== 'CNY'))).toBe(true);
    expect(CUBES.some(cube => cube.prices.length > 0)).toBe(true);
    for (const cube of CUBES) {
      for (const price of cube.prices) {
        expect(price.region, cube.id).toBe('CN');
        expect(price.currency, cube.id).toBe('CNY');
        expect(SOURCE_BY_ID.has(price.sourceId), cube.id).toBe(true);
      }
    }
  });

  it('treats overseas-only versions as missing prices in cards, filters and coverage counts', () => {
    const overseasOnly = original.filter(cube => cube.prices.length > 0 && domesticPrices(cube).length === 0);
    expect(overseasOnly.length).toBeGreaterThan(0);
    for (const raw of overseasOnly) {
      const cube = publicById.get(raw.id)!;
      expect(cube.prices, raw.id).toEqual([]);
      expect(preferredPrice(cube.prices), raw.id).toBeUndefined();
      expect(matchesCube(cube, { ...EMPTY_FILTERS, evidence: 'missing-price' }), raw.id).toBe(true);
      for (const evidence of ['has-price', 'current-price', 'launch-price', 'cny']) {
        expect(matchesCube(cube, { ...EMPTY_FILTERS, evidence }), raw.id + ': ' + evidence).toBe(false);
      }
    }
    expect(CUBES.filter(cube => cube.prices.length > 0)).toHaveLength(
      original.filter(cube => domesticPrices(cube).length > 0).length,
    );
  });

  it('keeps launch/current types, dates, conditions and amounts without currency conversion', () => {
    for (const raw of original) {
      const published = publicById.get(raw.id)!;
      const expected = domesticPrices(raw);
      expect(published.prices, raw.id).toEqual(expected);
      for (const quote of published.prices) expect(raw.prices, raw.id).toContain(quote);
    }
    const gan17 = publicById.get('gan17')!;
    expect(gan17.prices).toContainEqual(expect.objectContaining({
      kind: 'launch', amount: 439, currency: 'CNY', region: 'CN', asOf: '2026-08-10',
    }));
    expect(preferredPrice(gan17.prices)?.kind).toBe('launch');
  });

  it('exports the same domestic-only quotes for Chinese and English searches', () => {
    for (const q of ['威龙 V11', 'WeiLong V11']) {
      const filtered = CUBES.filter(cube => matchesCube(cube, { ...EMPTY_FILTERS, q }));
      expect(filtered.some(cube => cube.id === 'moyu-weilong-v11'), q).toBe(true);
      // The page exports these canonical filtered records, not the raw datasets.
      const exported = JSON.parse(JSON.stringify({ cubes: filtered })) as { cubes: typeof CUBES };
      for (const cube of exported.cubes) {
        expect(cube.prices, cube.id).toEqual(domesticPrices(original.find(raw => raw.id === cube.id)!));
        expect(cube.prices.every(price => price.region === 'CN' && price.currency === 'CNY')).toBe(true);
      }
    }
  });
});

describe('cube history localized brand names', () => {
  it.each([
    ['MoYu', '魔域', 'MoYu'],
    ['QiYi', '奇艺', 'QiYi'],
    ['YJ', '永骏', 'YJ'],
    ['DaYan', '大雁', 'DaYan'],
    ['GAN', 'GAN', 'GAN'],
  ])('displays %s in the selected language without appending the other name', (key, zh, en) => {
    expect(BRANDS[key]).toEqual({ zh, en });
  });

  it('retains both language search names and stable brand filter keys', () => {
    const cube = publicById.get('moyu-weilong-v11')!;
    expect(cube.brand).toBe('MoYu');
    for (const q of ['魔域', 'MoYu']) {
      expect(matchesCube(cube, { ...EMPTY_FILTERS, brand: 'MoYu', q }), q).toBe(true);
    }
  });
});
