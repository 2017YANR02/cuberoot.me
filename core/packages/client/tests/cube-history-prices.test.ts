import { describe, expect, it } from 'vitest';
import { CUBES } from '../app/[lang]/cube-history/_data/catalog';
import { preferredPrice, priceAmount, priceLabel, sortedPrices } from '../app/[lang]/cube-history/_data/prices';
import { EMPTY_FILTERS, groupCubesByModel, matchesCube, sourceIdsForModelGroup } from '../app/[lang]/cube-history/_data/query';
import type { Cube, CubePrice } from '../app/[lang]/cube-history/_data/types';

const current: CubePrice = {
  kind: 'current', amount: 49.99, currency: 'USD', region: 'US', asOf: '2026-10-09',
  variant: 'UV', sourceId: 'current-source', note: { zh: '美国商店价格', en: 'US store price' },
};
const launch: CubePrice = {
  kind: 'launch', amount: 399, currency: 'CNY', region: 'CN', asOf: '2025-02-27',
  variant: 'UV', sourceId: 'launch-source', note: { zh: '首发公告', en: 'Launch announcement' },
};
const byId = (id: string) => CUBES.find(cube => cube.id === id)!;
const withPrices = (prices: CubePrice[]): Cube => ({ ...byId('gan12'), prices });

describe('cube history price semantics', () => {
  it('prefers launch evidence and then mainland current evidence without comparing currency amounts', () => {
    const mainland: CubePrice = { ...current, currency: 'CNY', region: 'CN', amount: 349 };
    const quotes = Object.freeze([current, mainland, launch]);
    expect(preferredPrice(quotes)).toBe(launch);
    expect(preferredPrice([current, mainland])).toBe(mainland);
    expect(quotes).toEqual([current, mainland, launch]);
    expect(preferredPrice([])).toBeUndefined();
  });

  it('uses observation dates to choose within the same market priority', () => {
    const older: CubePrice = { ...current, amount: 39.99, asOf: '2026-08-01' };
    expect(sortedPrices([older, current])).toEqual([current, older]);
  });

  it('retains currency and labels an overseas current quote separately from a China launch price', () => {
    expect(priceAmount(current)).toBe('US$49.99');
    expect(priceAmount(launch)).toBe('¥399');
    expect(priceAmount({ ...current, currency: 'EUR', region: 'EU', amount: 45 })).toBe('€45');
    expect(priceLabel(current)).toEqual({ zh: '海外当前参考价', en: 'Current overseas price' });
    expect(priceLabel(launch)).toEqual({ zh: '中国首发价', en: 'China launch price' });
  });

  it('keeps currency and price-type filters independent, including mixed-price records', () => {
    const test = (prices: CubePrice[], evidence: string) => matchesCube(withPrices(prices), { ...EMPTY_FILTERS, evidence });
    expect(test([current], 'cny')).toBe(false);
    expect(test([current], 'launch-price')).toBe(false);
    expect(test([current], 'current-price')).toBe(true);
    expect(test([launch], 'current-price')).toBe(false);
    expect(test([launch], 'cny')).toBe(true);
    for (const evidence of ['cny', 'launch-price', 'current-price', 'has-price']) {
      expect(test([launch, current], evidence), evidence).toBe(true);
      expect(test([], evidence), evidence).toBe(false);
    }
    expect(test([], 'missing-price')).toBe(true);
    expect(test([current], 'missing-price')).toBe(false);
  });

  it('keeps material preorder and sold-out conditions available to compact price displays', () => {
    const preorder = byId('gan15-newblack').prices.find(price => price.kind === 'launch');
    expect(preorder?.qualifier?.zh).toContain('预售');
    expect(preorder?.qualifier?.en.toLowerCase()).toContain('preorder');
    for (const cube of CUBES) {
      for (const price of cube.prices.filter(price => price.kind === 'current' && /售罄|缺货/.test(price.note.zh))) {
        expect(price.qualifier?.zh, cube.id).toMatch(/售罄|缺货/);
        expect(price.qualifier?.en.toLowerCase(), cube.id).toMatch(/sold.out|out.of.stock/);
      }
    }
  });

  it('exports the original model-date evidence even when only a later edition matches', () => {
    const base: Cube = { ...byId('gan16'), release: { ...byId('gan16').release, date: '2025-07-28', sourceIds: ['origin-evidence'] } };
    const edition: Cube = { ...byId('gan16-max-l'), release: { ...byId('gan16-max-l').release, date: '2026-05-28', sourceIds: ['edition-evidence'] } };
    const group = groupCubesByModel([edition], [base, edition])[0];
    expect(group.variants).toEqual([edition]);
    expect(sourceIdsForModelGroup(group)).toEqual(expect.arrayContaining(['origin-evidence', 'edition-evidence']));
  });
});
