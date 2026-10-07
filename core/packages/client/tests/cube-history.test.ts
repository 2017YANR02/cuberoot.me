import { describe, expect, it } from 'vitest';
import { CUBES, SOURCES } from '../app/[lang]/cube-history/_data/catalog';
import { BRANDS, MECHANISMS, SNAPSHOT_DATE } from '../app/[lang]/cube-history/_data/labels';
import { MILESTONES } from '../app/[lang]/cube-history/_data/milestones';
import { EMPTY_FILTERS, matchesCube, normalizeSearch, selectedCubes, sortCubes, sourceIdsForCube } from '../app/[lang]/cube-history/_data/query';
import type { Cube, LocalizedText } from '../app/[lang]/cube-history/_data/types';

const cubeIds = new Set(CUBES.map(cube => cube.id));
const sourceIds = new Set(SOURCES.map(source => source.id));
const byId = (id: string): Cube => {
  const cube = CUBES.find(item => item.id === id);
  if (!cube) throw new Error('Missing archive model: ' + id);
  return cube;
};
const expectLocalized = (value: LocalizedText) => {
  expect(value.zh.trim().length).toBeGreaterThan(0);
  expect(value.en.trim().length).toBeGreaterThan(0);
};

describe('cube history research contract', () => {
  it('keeps identifiers, source URLs and cross-references unambiguous', () => {
    expect(cubeIds.size).toBe(CUBES.length);
    expect(sourceIds.size).toBe(SOURCES.length);
    expect(new Set(SOURCES.map(source => source.url)).size).toBe(SOURCES.length);
    for (const source of SOURCES) {
      expect(['http:', 'https:']).toContain(new URL(source.url).protocol);
      expect(source.title.trim()).not.toBe('');
      expect(source.publisher.trim()).not.toBe('');
    }
    for (const cube of CUBES) {
      expect(cube.sourceIds.length).toBeGreaterThan(0);
      expect(cube.assessment.sourceIds.length).toBeGreaterThan(0);
      for (const id of sourceIdsForCube(cube)) expect(sourceIds.has(id), cube.id + ' -> ' + id).toBe(true);
    }
    for (const milestone of MILESTONES) {
      for (const id of milestone.cubeIds) expect(cubeIds.has(id), milestone.id + ' -> ' + id).toBe(true);
      for (const id of milestone.sourceIds) expect(sourceIds.has(id), milestone.id + ' -> ' + id).toBe(true);
      expectLocalized(milestone.title);
      expectLocalized(milestone.description);
    }
  });

  it('retains date precision and evidence without turning unknowns into launches', () => {
    const formats = { day: /^\d{4}-\d{2}-\d{2}$/, month: /^\d{4}-\d{2}$/, year: /^\d{4}$/ };
    for (const cube of CUBES) {
      if (cube.release.precision === 'unknown') {
        expect(cube.release.date, cube.id).toBeNull();
      } else {
        expect(cube.release.date, cube.id).toMatch(formats[cube.release.precision]);
        expect(cube.release.date! <= SNAPSHOT_DATE, cube.id).toBe(true);
        expect(Number(cube.release.date!.slice(0, 4)), cube.id).toBe(cube.year);
        expect(cube.release.sourceIds.length, cube.id).toBeGreaterThan(0);
      }
      if (cube.release.basis === 'official') {
        expect(cube.release.date, cube.id).not.toBeNull();
        expect(cube.release.sourceIds.some(id => SOURCES.find(source => source.id === id)?.kind === 'official'), cube.id).toBe(true);
      }
      expectLocalized(cube.release.note);
    }
    // A real 2026 teaser must not silently become a released product.
    expect(byId('moyu-aolong-v6').status).toBe('announced');
    expect(byId('moyu-aolong-v6').release.date).toBeNull();
    expect(byId('moyu-aolong-v6').prices).toEqual([]);
  });

  it('keeps currency, market, version, evidence and time attached to each quote', () => {
    for (const cube of CUBES) for (const price of cube.prices) {
      expect(Number.isFinite(price.amount) && price.amount > 0, cube.id).toBe(true);
      expect(price.currency, cube.id).toMatch(/^[A-Z]{3}$/);
      expect(price.region.trim(), cube.id).not.toBe('');
      expect(['launch', 'current', 'historical']).toContain(price.kind);
      expect(sourceIds.has(price.sourceId), cube.id).toBe(true);
      if (price.asOf !== null) expect(price.asOf <= SNAPSHOT_DATE, cube.id).toBe(true);
      expectLocalized(price.note);
    }
    const latest = byId('gan17');
    expect(latest.prices).toEqual(expect.arrayContaining([
      expect.objectContaining({ amount: 439, currency: 'CNY', kind: 'launch', asOf: '2026-08-10' }),
      expect.objectContaining({ amount: 84.99, currency: 'USD', kind: 'current', asOf: SNAPSHOT_DATE }),
    ]));
    expect(byId('gan2').prices).toEqual([]);
  });

  it('provides both public languages and a readable label for every mechanism', () => {
    for (const cube of CUBES) {
      expect(BRANDS[cube.brand], cube.brand).toBeDefined();
      expectLocalized(cube.name);
      expectLocalized(cube.assessment.summary);
      expectLocalized(cube.assessment.tradeoffs);
      if (cube.specs.adjustment) expectLocalized(cube.specs.adjustment);
      for (const highlight of cube.highlights) expectLocalized(highlight);
      for (const mechanism of cube.specs.mechanism) expect(MECHANISMS[mechanism], cube.id + ': ' + mechanism).toBeDefined();
    }
  });
});

describe('cube history exploration', () => {
  it('normalizes full-width characters, separators and multiplication signs', () => {
    expect(normalizeSearch('ＧＡＮ １２')).toBe('gan12');
    expect(normalizeSearch('3 × 3')).toBe('3x3');
    expect(matchesCube(byId('gan12'), { ...EMPTY_FILTERS, q: 'ＧＡＮ １２' })).toBe(true);
    expect(matchesCube(byId('moyu-rs3m-2020'), { ...EMPTY_FILTERS, q: '魔域' })).toBe(true);
    expect(matchesCube(byId('dayan-guhong-v1'), { ...EMPTY_FILTERS, q: 'Gu Hong' })).toBe(true);
    expect(matchesCube(byId('dayan-guhong-v1'), { ...EMPTY_FILTERS, q: '大雁 孤鸿' })).toBe(true);
    expect(matchesCube(byId('moyu-weilong-v11'), { ...EMPTY_FILTERS, q: '魔域威龙' })).toBe(true);
    expect(matchesCube(byId('gan12'), { ...EMPTY_FILTERS, q: 'GAN12 MagLev' })).toBe(true);
    expect(matchesCube(byId('gan12'), { ...EMPTY_FILTERS, q: 'GAN12 nonexistent' })).toBe(false);
  });

  it('does not mistake non-magnetic tokens or carbon cores for magnetic mechanisms', () => {
    const nonmagnetic: Cube = {
      ...byId('alpha-i'),
      specs: { ...byId('alpha-i').specs, mechanism: ['non-magnetic', 'spring', 'carbon-core'] },
      tags: ['non-magnetic'],
    };
    expect(matchesCube(nonmagnetic, { ...EMPTY_FILTERS, technology: 'magnet' })).toBe(false);
    expect(matchesCube(nonmagnetic, { ...EMPTY_FILTERS, technology: 'core' })).toBe(false);
    expect(matchesCube(nonmagnetic, { ...EMPTY_FILTERS, technology: 'typo' })).toBe(true);
    expect(matchesCube(byId('gan17'), { ...EMPTY_FILTERS, technology: 'maglev' })).toBe(true);
    expect(matchesCube(byId('gan11-m-pro'), { ...EMPTY_FILTERS, technology: 'core' })).toBe(true);
  });

  it('intersects filters and keeps CNY quotes separate from USD prices', () => {
    const filter = { ...EMPTY_FILTERS, brand: 'GAN', period: 'recent', evidence: 'cny' };
    const matches = CUBES.filter(cube => matchesCube(cube, filter));
    expect(matches.map(cube => cube.id)).toContain('gan17');
    expect(matches.every(cube => cube.brand === 'GAN' && cube.year! >= 2024 && cube.prices.some(price => price.currency === 'CNY'))).toBe(true);
    expect(matchesCube(byId('gan12'), { ...EMPTY_FILTERS, evidence: 'cny' })).toBe(false);
  });

  it('places missing years last in both date directions without mutating input', () => {
    const undated: Cube = { ...byId('gan2'), id: 'undated-fixture', year: null, release: { ...byId('gan2').release, date: null, precision: 'unknown', basis: 'unknown' } };
    const items = [undated, byId('gan17'), byId('magic-cube-1977')];
    expect(sortCubes(items, 'newest').map(cube => cube.id)).toEqual(['gan17', 'magic-cube-1977', 'undated-fixture']);
    expect(sortCubes(items, 'oldest').map(cube => cube.id)).toEqual(['magic-cube-1977', 'gan17', 'undated-fixture']);
    expect(items[0].id).toBe('undated-fixture');
  });

  it('caps shared comparisons at four valid, unique model IDs', () => {
    const selected = selectedCubes(CUBES, ['missing', 'gan17', 'gan17', 'gan12', 'gan11-m-pro', 'magic-cube-1977', 'alpha-i']);
    expect(selected.map(cube => cube.id)).toEqual(['gan17', 'gan12', 'gan11-m-pro', 'magic-cube-1977']);
    expect(selectedCubes(CUBES, ['missing'])).toEqual([]);
  });
});
