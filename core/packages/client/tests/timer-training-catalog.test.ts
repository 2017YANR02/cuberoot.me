import { describe, expect, it } from 'vitest';
import { ALG_CATALOG, ALG_PUZZLES } from '@cuberoot/shared/alg';
import { PUZZLE_EVENT } from '@/app/[lang]/alg/_trainer/events';
import {
  RECOGNITION_TRAINING_SETS,
  VIRTUAL_ALG_SET_METADATA,
  VIRTUAL_ALG_SET_PARAMS,
} from '@/lib/training-set-metadata';
import {
  resolveTrainingTarget, TRAINING_DIRECTORY, trainingDirectoryForEvent, trainingEventForTarget,
} from '@/lib/timer-training-catalog';

describe('timer training catalog', () => {
  it('includes every registered project and formula set, preserving both supported puzzle spellings', () => {
    for (const puzzle of ALG_PUZZLES) {
      const group = TRAINING_DIRECTORY.find(item => item.id === `alg:${puzzle}`);
      expect(group, puzzle).toBeDefined();
      expect(group?.eventId).toBe(PUZZLE_EVENT[puzzle]);
      for (const set of ALG_CATALOG[puzzle]) {
        expect(group?.items.some(item => item.path === `/alg/${puzzle}/${set.slug}/select`), `${puzzle}/${set.slug}`).toBe(true);
        for (const segment of new Set([puzzle, PUZZLE_EVENT[puzzle]])) {
          for (const leaf of ['run', 'select'] as const) {
            expect(resolveTrainingTarget(`/alg/${segment}/${set.slug}/${leaf}`)).toMatchObject({
              kind: `alg-${leaf}`, params: { puzzle, set: set.slug },
              title: { zh: set.zh, en: set.en },
            });
          }
          expect(resolveTrainingTarget(`/alg/${segment}/${set.slug}`)?.kind).toBe('alg-set');
          const simple = resolveTrainingTarget(`/alg/${segment}/${set.slug}/simple`);
          if (segment === '3x3' && set.slug === 'zbll') expect(simple?.kind).toBe('alg-simple');
          else expect(simple).toBeNull();
          expect(resolveTrainingTarget(`/alg/${segment}/${set.slug}/case%20one`)).toMatchObject({
            kind: 'alg-case', params: { puzzle, set: set.slug, subgroup: 'case one' },
          });
        }
      }
    }
  });

  it('keeps every menu destination resolvable and unique with bilingual compact group names', () => {
    const paths = new Set<string>();
    for (const group of TRAINING_DIRECTORY) {
      expect(group.title.zh).not.toContain('魔方');
      expect(group.title.en).not.toBe('');
      expect(group.items.length).toBeGreaterThan(0);
      for (const item of group.items) {
        expect(paths.has(item.path), item.path).toBe(false);
        paths.add(item.path);
        expect(item.title.zh, item.path).not.toBe('');
        expect(item.title.en, item.path).not.toBe('');
        expect(resolveTrainingTarget(item.path), item.path).not.toBeNull();
      }
    }
  });

  it('keeps every training reachable through its project without mixing project-specific options', () => {
    for (const group of TRAINING_DIRECTORY) for (const item of group.items) {
      const target = resolveTrainingTarget(item.path)!;
      const event = trainingEventForTarget(target);
      const ownPaths = trainingDirectoryForEvent(event ?? '333').flatMap(section => section.items.map(entry => entry.path));
      expect(ownPaths, item.path).toContain(item.path);
      expect(new Set(ownPaths).size).toBe(ownPaths.length);
      const otherPaths = trainingDirectoryForEvent(event === '222' ? '333' : '222')
        .flatMap(section => section.items.map(entry => entry.path));
      expect(otherPaths.includes(item.path), item.path).toBe(event === null);
    }
    const paths = (event: string) => trainingDirectoryForEvent(event).flatMap(group => group.items.map(item => item.path));
    expect(paths('oll')).toEqual(paths('333'));
    expect(paths('333oh')).toEqual(paths('333'));
    expect(paths('eg1')).toEqual(paths('222'));
    expect(paths('333bf')).toEqual(paths('333bld'));
    expect(paths('333')).toContain('/alg/roux');
    expect(paths('skewb')).toContain('/alg/skewb-trainer');
    expect(paths('sq1')).toContain('/sq1/cs/name/train');
    expect(paths('333bld')).toContain('/alg/3bld/edge');
  });

  it('shares lightweight identities with the existing recognition and virtual-set registries', async () => {
    const [{ RECOGNIZE_SETS, isRecognizeSetId }, virtual] = await Promise.all([
      import('@/lib/recognize-sets'), import('@/lib/alg-virtual-sets'),
    ]);
    expect(Object.keys(RECOGNITION_TRAINING_SETS).sort()).toEqual(Object.keys(RECOGNIZE_SETS).sort());
    for (const id of Object.keys(RECOGNITION_TRAINING_SETS)) expect(isRecognizeSetId(id), id).toBe(true);
    for (const id of ['unknown', '__proto__', 'constructor']) expect(isRecognizeSetId(id), id).toBe(false);
    expect(virtual.VIRTUAL_ALG_SET_PARAMS).toBe(VIRTUAL_ALG_SET_PARAMS);
    for (const meta of VIRTUAL_ALG_SET_METADATA) {
      expect(virtual.virtualAlgSet(meta.puzzle, meta.slug)?.meta).toBe(meta.meta);
      expect(resolveTrainingTarget(`/alg/${meta.puzzle}/${meta.slug}/run`)).toMatchObject({
        kind: 'alg-run', params: { puzzle: meta.puzzle, set: meta.slug },
      });
      // Virtual sets have their own selectors and must not hit the PG-backed selector.
      expect(resolveTrainingTarget(`/alg/${meta.puzzle}/${meta.slug}/select`)).toBeNull();
    }
  });

  it('keeps mixed-set routes, LSLL selection, progress and guides available inside the host', () => {
    for (const puzzle of ALG_PUZZLES) {
      expect(resolveTrainingTarget(`/alg/${puzzle}/mix/select?sets=oll,pll`)).toMatchObject({
        kind: 'alg-select', params: { puzzle, set: 'mix' },
      });
      expect(resolveTrainingTarget(`/alg/${puzzle}/mix/run`)?.kind).toBe('alg-run');
    }
    for (const [path, kind] of [
      ['/alg', 'alg-library'], ['/alg/333', 'alg-library'], ['/alg/lsll', 'lsll'],
      ['/alg/lsll/ap', 'lsll-group'], ['/alg/lsll/case?k=123', 'lsll-case'],
      ['/alg/lsll/route?round=2', 'lsll-route'], ['/alg/progress', 'progress'],
      ['/alg/progress/cases?mark=learning', 'progress-cases'], ['/alg/time-attack', 'time-attack'],
      ['/recognize/pll/guide', 'recognize-guide'], ['/recognize/oll/guide', 'recognize-guide'],
      ['/sq1/cs/name', 'sq1-shape-guide'],
    ]) expect(resolveTrainingTarget(path)?.kind, path).toBe(kind);
    expect(resolveTrainingTarget('/recognize/coll/guide')).toBeNull();
  });

  it('covers all specialized trainers and preserves legacy iframe and statistics identities', () => {
    for (const path of [
      '/alg/3x3/cross', '/alg/333/cross', '/alg/roux', '/alg/skewb-trainer',
      '/predict', '/notation?train=true', '/color-test/positions', '/color-test/relations',
      '/sq1/cs/name/train',
    ]) expect(resolveTrainingTarget(path), path).not.toBeNull();
    for (const tool of [
      'edge', 'corner', 'edge-float', 'corner-float', '2e2e', '2c2c', 'parity',
      'flip', 'twist', 'ltct', 'memo', 'timer', 'helper', 'lookup', 'comm', 'tables',
      'sheets', 'resources', 'readme',
    ]) expect(resolveTrainingTarget(`/alg/3bld/${tool}`)).toMatchObject({ kind: 'bld', params: { tool } });
    for (const tool of [
      'algorithm-trainer', 'train', 'parity-game', 'inspect', 'visualize', 'import',
      'count', 'pbl-finder', 'karnaukh-notation',
    ]) expect(resolveTrainingTarget(`/alg/sq1/${tool}`)).toMatchObject({ kind: 'sq1-tool', params: { tool } });
    const legacy = TRAINING_DIRECTORY.find(group => group.id === 'legacy')!;
    expect(legacy.items).toHaveLength(10);
    for (const item of legacy.items) {
      const slug = item.path.slice(1);
      const source = slug === 'alg-trainers' ? 'alg_trainers' : slug;
      expect(resolveTrainingTarget(item.path)).toMatchObject({
        kind: 'legacy', params: { src: `/tools/${source}/`, trainingGroup: `legacy:${slug}` },
      });
    }
  });

  it('normalizes locale and encoding without losing decoded route parameters', () => {
    expect(resolveTrainingTarget('/zh/alg/333/oll/run/?scope=s%2B#case')).toMatchObject({
      path: '/alg/333/oll/run', kind: 'alg-run', params: { puzzle: '3x3', set: 'oll' },
    });
    expect(resolveTrainingTarget('/en/alg/3x3/zbll/s%2B2')).toMatchObject({
      path: '/alg/3x3/zbll/s%2B2', kind: 'alg-case', params: { slug: 's+2' },
    });
  });

  it('rejects external, malformed, unregistered and unsupported paths', () => {
    for (const path of [
      '', '/', 'alg/3x3/oll/run', 'https://example.com/alg/3x3/oll/run',
      '//example.com/alg/3x3/oll/run', 'javascript:alert(1)', '/\\example.com/alg',
      '/alg//3x3/oll/run', '/alg/3x3/../oll/run', '/alg/3x3/%2e%2e/run',
      '/alg/3x3/oll/%2fadmin', '/alg/3x3/oll/%5cadmin', '/alg/3x3/oll/%00',
      '/alg/3x3/oll/%', '/alg/3x3/oll/run/extra', '/alg/3x3/oll/a/edit',
      '/alg/unknown/oll/run', '/alg/3x3/unknown/run', '/alg/3bld/unknown',
      '/recognize/unknown', '/recognize/sq1-shape', '/tools/alg_trainers/',
      '/timer', '/account', '/org/example/training', '/predict/extra',
    ]) expect(resolveTrainingTarget(path), path).toBeNull();
  });
});
