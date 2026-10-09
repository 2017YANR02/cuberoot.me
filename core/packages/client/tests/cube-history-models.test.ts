import { describe, expect, it } from 'vitest';
import { CUBES } from '@/app/[lang]/cube-history/_data/catalog';
import { CUBE_MODEL_DEFINITIONS, getCubeModelId, getCubeModelName, getCubeVersionLabel } from '@/app/[lang]/cube-history/_data/models';
import { EMPTY_FILTERS, groupCubesByModel, matchesCube, sortModelGroups } from '@/app/[lang]/cube-history/_data/query';
import type { Cube } from '@/app/[lang]/cube-history/_data/types';

const byId = (id: string): Cube => {
  const cube = CUBES.find(item => item.id === id);
  if (!cube) throw new Error('Missing cube-history fixture: ' + id);
  return cube;
};
const groupsFor = (ids: string[], query = '') => groupCubesByModel(ids.map(byId), CUBES, query);

describe('cube history model identities and chronology', () => {
  it('keeps every catalog record independently addressable and all reviewed memberships unambiguous', () => {
    const reviewedIds = CUBE_MODEL_DEFINITIONS.flatMap(model => model.variants.map(([id]) => id));
    expect(reviewedIds.length).toBe(490);
    expect(new Set(reviewedIds).size).toBe(490);
    for (const id of reviewedIds) expect(CUBES.some(cube => cube.id === id), id).toBe(true);
    const groups = groupCubesByModel(CUBES);
    expect(groups.length).toBe(648);
    expect(groups.flatMap(group => group.variants).length).toBe(CUBES.length);
    expect(new Set(groups.flatMap(group => group.variants.map(cube => cube.id))).size).toBe(CUBES.length);
    for (const group of groups) {
      expect(group.variants).toContain(group.representative);
      for (const cube of group.variants) expect(CUBES).toContain(cube);
    }
  });

  it.each([
    ['gan356-me', 'gan356-me-v2'],
    ['gan3', 'gan3-v2'],
    ['gan356-x', 'gan356-x-v2'],
    ['gan-i3', 'gan-i3-v2'],
    ['gan11-m-pro', 'gan-mini-m-pro'],
    ['gan12-ui-freeplay', 'gan-mini-ui-freeplay'],
    ['yj-guanlong', 'yj-guanlong-plus'],
    ['yj-guanlong-plus', 'yj-guanlong-v3'],
    ['yj-chilong', 'yj-chilong-v2'],
    ['qiyi-3x3', 'qiyi-mini-42'],
    ['qiyi-mini-42', 'qiyi-black-mamba-3x3-v3'],
    ['archive-newisland-lightning', 'archive-newisland-lightning-v2'],
    ['archive-alpha-cc1', 'archive-alpha-cc3'],
    ['yj-mgc3-beta', 'yj-mgc-sigma-3x3'],
    ['monstergo-3x3', 'monstergo-m-edu'],
    ['gan-rsc-gsc', 'gan-gsc'],
  ])('does not collapse distinct products %s and %s through their navigation family', (left, right) => {
    expect(getCubeModelId(byId(left))).not.toBe(getCubeModelId(byId(right)));
    expect(groupsFor([left, right])).toHaveLength(2);
  });

  it('separates each named Tianma generation and leaves unspecified-generation records unassigned to them', () => {
    const ids = [
      'archive-moretry-tianma-x3-v2-3x3-enhanced-1',
      'moretry-tianma-x3-plus',
      'archive-moretry-tianma-x3-v4-3x3-maglev-1',
      'archive-moretry-tianma-x3-3x3-single-track-magnetic-frosted',
    ];
    expect(new Set(ids.map(id => getCubeModelId(byId(id)))).size).toBe(4);
    expect(getCubeModelName(byId(ids[0])).en).toBe('Tianma X3+ V2');
    expect(getCubeModelName(byId(ids[1])).en).toBe('Tianma X3+ V3');
    expect(getCubeModelName(byId(ids[2])).en).toBe('Tianma X3+ V4');
    expect(getCubeModelName(byId(ids[3])).en).toContain('generation unspecified');
    expect(groupsFor([ids[2], 'archive-moretry-tianma-x3-v4-3x3-maglev-uv'])).toHaveLength(1);
  });

  it('keeps configurations, coatings and size choices within the same documented model', () => {
    for (const ids of [
      ['gan11-m-pro', 'gan11-m-duo', 'gan11-m', 'gan11-air'],
      ['gan12', 'gan12-m-leap', 'gan12-maglev-frosted', 'gan12-greninja'],
      ['gan16', 'gan16-maglev-standard', 'gan16-max-l'],
      ['moyu-rs3m-v5', 'moyu-rs3-m-v5-3x3-spring-tension', 'moyu-rs3-m-v5-3x3-maglev-robot-cube-stand'],
      ['dayan-guhong-pro-m', 'dayan-guhong-pro-m-3x3-54mm-maglev', 'dayan-guhong-pro-m-3x3-56mm-standard'],
      ['moyu-weilong-gts2-m', 'moyu-weilong-gts2-m-2019'],
    ]) expect(groupsFor(ids), ids.join(', ')).toHaveLength(1);
    expect(getCubeModelName(byId('gan11-air')).en).toBe('GAN11');
  });

  it('does not automatically merge a future record by a similar name or inherited familyId', () => {
    const future: Cube = {
      ...byId('gan12'), id: 'unreviewed-gan12-new-generation', familyId: 'gan12',
      name: { zh: 'GAN12 新一代', en: 'GAN12 New Generation' },
    };
    expect(getCubeModelId(future)).toBe(future.id);
    expect(groupCubesByModel([byId('gan12'), future])).toHaveLength(2);
  });

  it('retains the original model chronology when filters only match a later licensed edition', () => {
    const [group] = groupsFor(['gan12-greninja']);
    expect(group.variants.map(cube => cube.id)).toEqual(['gan12-greninja']);
    expect(group.firstRelease).toBe(byId('gan12').release);
    expect(group.firstRelease?.date).toBe('2021-09-27');
    expect(group.latestRelease).toBe(byId('gan12-greninja').release);
    expect(group.latestRelease?.date).toBe('2025');
    expect(group.name.en).toBe('GAN12');

    const groups = groupsFor(['gan12-greninja', 'gan13']);
    expect(sortModelGroups(groups, 'newest').map(item => item.id)).toEqual(['gan13', 'gan12']);
    expect(sortModelGroups(groups, 'oldest').map(item => item.id)).toEqual(['gan12', 'gan13']);
    expect(sortModelGroups(groups, 'latest-version').map(item => item.id)).toEqual(['gan12', 'gan13']);
    expect(groups.map(item => item.id)).toEqual(['gan12', 'gan13']);
  });

  it('keeps source basis and precision without inventing an official launch for undated records', () => {
    const unknown = byId('moyu-aolong-v6');
    const [unknownGroup] = groupCubesByModel([unknown]);
    expect(unknownGroup.firstRelease).toBeNull();
    expect(unknownGroup.latestRelease).toBeNull();
    const [retailerGroup] = groupsFor(['gan356-me-v2']);
    expect(retailerGroup.firstRelease?.basis).toBe('retailer');
    expect(retailerGroup.firstRelease?.precision).toBe('day');
    const [yearGroup] = groupsFor(['gan-gsc']);
    expect(yearGroup.firstRelease?.date).toBe('2020');
    expect(yearGroup.firstRelease?.precision).toBe('year');
    expect(yearGroup.firstRelease?.basis).toBe('documented');
    for (const order of ['newest', 'oldest', 'latest-version']) {
      expect(sortModelGroups([unknownGroup, retailerGroup], order).at(-1)?.id).toBe(unknown.id);
    }
  });

  it('starts with a matching base version while retaining precise configuration searches', () => {
    const ids = ['gan11-air', 'gan11-m-duo', 'gan11-m-pro'];
    expect(groupsFor(ids)[0].representative.id).toBe('gan11-m-pro');
    expect(groupsFor(ids, 'GAN11')[0].representative.id).toBe('gan11-m-pro');
    expect(groupsFor(ids, 'GAN11 M Duo')[0].representative.id).toBe('gan11-m-duo');
    expect(groupsFor(['gan12-greninja', 'gan12'], 'GAN12')[0].representative.id).toBe('gan12');
    expect(groupsFor(['gan12-greninja', 'gan12'], 'GAN12 Greninja')[0].representative.id).toBe('gan12-greninja');
  });

  it('never restores excluded versions when choosing the representative or latest-version date', () => {
    const filters = { ...EMPTY_FILTERS, q: 'GAN16MAXL', family: 'gan16', year: '2026', tier: 'flagship' };
    const matches = CUBES.filter(cube => matchesCube(cube, filters));
    const [group] = groupCubesByModel(matches, CUBES, filters.q);
    expect(group.variants.map(cube => cube.id)).toEqual(['gan16-max-l']);
    expect(group.representative.id).toBe('gan16-max-l');
    expect(group.firstRelease).toBe(byId('gan16').release);
    expect(group.latestRelease).toBe(byId('gan16-max-l').release);
  });

  it('provides stable bilingual names and distinct labels without losing configuration terms', () => {
    for (const group of groupCubesByModel(CUBES)) {
      for (const language of ['zh', 'en'] as const) {
        expect(group.name[language].trim(), group.id).not.toBe('');
        const labels = group.variants.map(cube => getCubeVersionLabel(cube)[language]);
        expect(new Set(labels).size, group.id + ' ' + language).toBe(labels.length);
        for (const label of labels) expect(label.trim(), group.id).not.toBe('');
      }
      for (const cube of group.variants) expect(getCubeModelName(cube)).toEqual(group.name);
    }
    expect(getCubeVersionLabel(byId('gan16-max-l')).en).toContain('MAX-L');
    expect(getCubeVersionLabel(byId('gan12-m-leap')).en).toContain('Leap');
    expect(getCubeVersionLabel(byId('dayan-guhong-pro-m-3x3-54mm-maglev')).en).toContain('54mm');
    expect(getCubeVersionLabel(byId('dayan-guhong-pro-m-3x3-54mm-maglev')).en).toContain('MagLev');
    expect(getCubeVersionLabel(byId('moyu-rs3-m-v5-3x3-8-m-ball-core-transparent-core-uv-saocube-se')).en)
      .toBe('Spring-Tension + Ball-Core + Transparent Core + UV SAOCube SE');
  });
});
