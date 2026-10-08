import { describe, expect, it } from 'vitest';
import { CUBE_ALIASES, CUBES, resolveCubeId, SOURCES } from '../app/[lang]/cube-history/_data/catalog';
import { BRANDS, MECHANISMS, SNAPSHOT_DATE } from '../app/[lang]/cube-history/_data/labels';
import { MILESTONES } from '../app/[lang]/cube-history/_data/milestones';
import { EMPTY_FILTERS, matchesCube, normalizeSearch, selectedCubes, sortBrandKeys, sortCubes, sourceIdsForCube } from '../app/[lang]/cube-history/_data/query';
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
const searchFixture = (id: string, name: string): Cube => ({
  ...byId('gan12'), id, name: { zh: name, en: name }, variants: [], tags: [], highlights: [],
  assessment: { ...byId('gan12').assessment, summary: { zh: '参数说明', en: 'Specifications' } },
});

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
    for (const cube of CUBES) for (const price of [...cube.prices, ...(cube.familyPrices ?? [])]) {
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
    // A manufacturer family quote with no configuration cannot become an exact base-SKU price.
    const mPro = byId('qiyi-m-pro');
    expect(mPro.familyPrices).toEqual(expect.arrayContaining([
      expect.objectContaining({ amount: 56.8, currency: 'CNY', sourceId: 'qiyi-m-pro-official' }),
    ]));
    expect(matchesCube(mPro, { ...EMPTY_FILTERS, evidence: 'cny' })).toBe(false);
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

  it('ties each real photograph to evidence and makes historical image gaps explicit', () => {
    for (const cube of CUBES) {
      if (cube.image) {
        expect(new URL(cube.image.url).protocol, cube.id).toBe('https:');
        expect(sourceIds.has(cube.image.sourceId), cube.id).toBe(true);
        expect(['exact', 'family'], cube.id).toContain(cube.image.match);
        expectLocalized(cube.image.alt);
        expectLocalized(cube.image.note);
      } else {
        expect(cube.image, cube.id).toBeNull();
        expect(cube.imageNote, cube.id).toBeDefined();
        expectLocalized(cube.imageNote!);
      }
    }
  });

  it('keeps merchant ratings with their sample, date and product-page scope', () => {
    for (const cube of CUBES) {
      if (!cube.rating) continue;
      const rating = cube.rating;
      expect(rating.value, cube.id).toBeGreaterThan(0);
      expect(rating.value, cube.id).toBeLessThanOrEqual(rating.scale);
      expect(Number.isInteger(rating.count) && rating.count > 0, cube.id).toBe(true);
      expect(rating.scope, cube.id).toBe('product-page');
      expect(rating.asOf <= SNAPSHOT_DATE, cube.id).toBe(true);
      expect(sourceIds.has(rating.sourceId), cube.id).toBe(true);
      expectLocalized(rating.note);
      expect(sourceIdsForCube(cube), cube.id).toContain(rating.sourceId);
    }
  });

  it('keeps distinct versions addressable without cyclic or invisible family links', () => {
    for (const cube of CUBES) {
      if (!cube.familyId) continue;
      expect(cube.familyId, cube.id).not.toBe(cube.id);
      expect(cubeIds.has(cube.familyId), cube.id).toBe(true);
      const root = byId(cube.familyId);
      expect(root.familyId, cube.id).toBeUndefined();
      expect(root.brand, cube.id).toBe(cube.brand);
    }
    for (const id of ['gan11-m-pro', 'gan12', 'gan13', 'gan14', 'gan15', 'gan16']) {
      const family = CUBES.filter(cube => (cube.familyId ?? cube.id) === id);
      expect(family.length, id).toBeGreaterThan(1);
      expect(family.every(cube => cube.image && cube.image.sourceId), id).toBe(true);
    }
    const leap = CUBES.find(cube => cube.familyId === 'gan12' && /leap/i.test(cube.name.en));
    expect(leap, 'GAN12 Leap has its own record').toBeDefined();
    expect(leap!.specs.mechanism).not.toContain('maglev');
    const maxL = CUBES.find(cube => cube.familyId === 'gan16' && /max[ -]?l/i.test(cube.name.en));
    expect(maxL, 'GAN16 MAX-L has its own size').toBeDefined();
    expect(maxL!.specs.size).toContain('57');
  });

  it('resolves documented legacy IDs directly to existing models', () => {
    expect(new Set(CUBE_ALIASES.map(alias => alias.from)).size).toBe(CUBE_ALIASES.length);
    for (const alias of CUBE_ALIASES) {
      expect(cubeIds.has(alias.from), alias.from).toBe(false);
      expect(cubeIds.has(alias.to), alias.to).toBe(true);
      expect(alias.sourceIds.length, alias.from).toBeGreaterThan(0);
      for (const id of alias.sourceIds) expect(sourceIds.has(id), alias.from + ' -> ' + id).toBe(true);
      expect(resolveCubeId(alias.from)).toBe(alias.to);
      expect(resolveCubeId(alias.to)).toBe(alias.to);
    }
    expect(resolveCubeId('missing-model')).toBe('missing-model');
  });
});

describe('cube history exploration', () => {
  it('places the four requested brands first without losing or duplicating other brands', () => {
    expect(sortBrandKeys(['YJ', 'DaYan', 'QiYi', 'Alpha', 'GAN', 'MoYu', 'GAN']))
      .toEqual(['GAN', 'MoYu', 'QiYi', 'YJ', 'Alpha', 'DaYan']);
  });

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

  it('finds compact model and finish queries and respects generation numbers', () => {
    const uvMatches = CUBES.filter(cube => matchesCube(cube, { ...EMPTY_FILTERS, q: 'GAN12UV', family: 'gan12' }));
    expect(uvMatches.length).toBeGreaterThan(0);
    expect(uvMatches.some(cube => /uv/i.test(cube.name.en))).toBe(true);
    expect(matchesCube(byId('moyu-rs3m-2020'), { ...EMPTY_FILTERS, q: 'RS3M2020' })).toBe(true);
    expect(matchesCube(byId('gan17'), { ...EMPTY_FILTERS, q: 'GAN 磁悬浮' })).toBe(true);
    const otherGeneration: Cube = {
      ...byId('gan12'), id: 'gan120-fixture', name: { zh: 'GAN120', en: 'GAN120' },
      variants: [], tags: [], highlights: [{ zh: '120 块磁铁', en: '120 magnets' }],
      assessment: { ...byId('gan12').assessment, summary: { zh: '参数说明', en: 'Specifications' } },
    };
    expect(matchesCube(otherGeneration, { ...EMPTY_FILTERS, q: 'GAN12' })).toBe(false);
  });

  it('finds every archived model by each of its complete public names', () => {
    const misses = CUBES.flatMap(cube => (['zh', 'en'] as const).flatMap(lang =>
      matchesCube(cube, { ...EMPTY_FILTERS, q: cube.name[lang] }) ? [] : [{ id: cube.id, lang, name: cube.name[lang] }]));
    expect(misses).toEqual([]);
  });

  it('preserves decimal sizes and adjacent model and edition numbers', () => {
    const mini = searchFixture('mini-size-fixture', 'Mini 54.6 mm');
    expect(matchesCube(mini, { ...EMPTY_FILTERS, q: '54.6mm' })).toBe(true);
    for (const q of ['54.7mm', '546mm', '5.46mm']) expect(matchesCube(mini, { ...EMPTY_FILTERS, q }), q).toBe(false);
    const carry = searchFixture('carry-edition-fixture', 'Carry4 2026');
    expect(matchesCube(carry, { ...EMPTY_FILTERS, q: 'Carry4' })).toBe(true);
    expect(matchesCube(carry, { ...EMPTY_FILTERS, q: 'Carry4 2026' })).toBe(true);
    expect(matchesCube(carry, { ...EMPTY_FILTERS, q: 'Carry42026' })).toBe(false);
    const otherModel = searchFixture('smart-model-fixture', 'GAN356 i3 V2');
    expect(matchesCube(otherModel, { ...EMPTY_FILTERS, q: 'GAN3 V2' })).toBe(false);
    expect(matchesCube(byId('gan3-v2'), { ...EMPTY_FILTERS, q: 'GAN3 V2' })).toBe(true);
  });

  it('finds MAX-L with spaced, compact and unhyphenated model input', () => {
    for (const q of ['GAN 16 MAX-L', 'GAN16MAX-L', 'GAN16MAXL']) {
      const matches = CUBES.filter(cube => matchesCube(cube, { ...EMPTY_FILTERS, q }));
      expect(matches.map(cube => cube.id), q).toContain('gan16-max-l');
      expect(sortCubes(matches, 'relevance', q)[0].id, q).toBe('gan16-max-l');
    }
  });

  it('distinguishes configuration words and standalone letters from substrings', () => {
    const standard = searchFixture('standard-config-fixture', 'GAN16 MagLev MAX UV');
    const large = searchFixture('large-config-fixture', 'GAN16 MagLev MAX-L UV');
    for (const q of ['GAN 16 MAX-L', 'GAN16MAXL', 'L', 'M']) {
      expect(matchesCube(standard, { ...EMPTY_FILTERS, q }), q).toBe(false);
    }
    expect(matchesCube(large, { ...EMPTY_FILTERS, q: 'GAN 16 MAX L' })).toBe(true);
    expect(matchesCube(searchFixture('magnetic-config-fixture', 'GAN11 M'), { ...EMPTY_FILTERS, q: 'M' })).toBe(true);
    expect(sortCubes([large, standard], 'relevance', 'GAN 16 MAX').map(cube => cube.id))
      .toEqual([standard.id, large.id]);
  });

  it('ranks model-name matches above newer records that only mention the model', () => {
    const mention: Cube = {
      ...byId('gan17'), id: 'incidental-mention-fixture',
      variants: [], tags: [],
      assessment: { ...byId('gan17').assessment, summary: { zh: '与 GAN12 对比。', en: 'Compared with GAN12.' } },
    };
    expect(matchesCube(mention, { ...EMPTY_FILTERS, q: 'GAN12' })).toBe(true);
    expect(sortCubes([mention, byId('gan12')], 'relevance', 'GAN12').map(cube => cube.id))
      .toEqual(['gan12', 'incidental-mention-fixture']);
    expect(sortCubes([mention, byId('gan12')], 'newest', 'GAN12')[0].id).toBe(mention.id);
    expect(sortCubes([byId('gan12'), mention], 'relevance')[0].id).toBe(mention.id);
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

  it('sorts model names in natural numeric order without mutating input', () => {
    const models = ['gan17', 'gan3', 'gan12', 'gan2'].map(byId);
    expect(sortCubes(models, 'name').map(cube => cube.id)).toEqual(['gan2', 'gan3', 'gan12', 'gan17']);
    expect(models.map(cube => cube.id)).toEqual(['gan17', 'gan3', 'gan12', 'gan2']);
  });

  it('caps shared comparisons at four valid, unique model IDs', () => {
    const selected = selectedCubes(CUBES, ['missing', 'gan17', 'gan17', 'gan12', 'gan11-m-pro', 'magic-cube-1977', 'alpha-i']);
    expect(selected.map(cube => cube.id)).toEqual(['gan17', 'gan12', 'gan11-m-pro', 'magic-cube-1977']);
    expect(selectedCubes(CUBES, ['missing'])).toEqual([]);
  });

  it('intersects year, family, positioning and photo-evidence filters', () => {
    const model = byId('gan12');
    const filters = { ...EMPTY_FILTERS, brand: 'GAN', family: 'gan12', year: String(model.year), tier: model.tier ?? 'unknown', evidence: 'with-image' };
    expect(matchesCube(model, filters)).toBe(true);
    expect(matchesCube(byId('gan13'), filters)).toBe(false);
    expect(matchesCube(model, { ...filters, year: 'unknown' })).toBe(false);
    expect(matchesCube(model, { ...filters, evidence: 'missing-image' })).toBe(false);
    const unknown: Cube = { ...model, year: null, image: null, tier: 'unknown' };
    expect(matchesCube(unknown, { ...EMPTY_FILTERS, year: 'unknown', tier: 'unknown', evidence: 'missing-image' })).toBe(true);
    expect(sourceIdsForCube({ ...model, sourceIds: [], prices: [], release: { ...model.release, sourceIds: [] }, assessment: { ...model.assessment, sourceIds: [] } })).toContain(model.image!.sourceId);
  });
});
