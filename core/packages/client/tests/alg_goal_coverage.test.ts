import { describe, expect, it } from 'vitest';
import { ALG_CATALOG, type AlgPuzzle } from '@cuberoot/shared';
import { SET_GOAL, goalOf, reachesGoal } from '@/lib/alg_goals';
import { validateAlgCase } from '@/lib/alg_validation';
import { puzzles } from 'cubing/puzzles';

const catalogKeys = Object.entries(ALG_CATALOG).flatMap(([puzzle, sets]) =>
  sets.map(set => `${puzzle}/${set.slug}`),
);

describe('alg set goal coverage', () => {
  it('requires every catalog set to register one explicit validation goal', () => {
    expect(catalogKeys).toHaveLength(69);
    expect(catalogKeys.filter(key => SET_GOAL[key] === undefined)).toEqual([]);
  });

  it('forbids catalog sets from bypassing validation with skip', () => {
    expect(catalogKeys.filter(key => SET_GOAL[key] === 'skip')).toEqual([]);
  });

  it('models Advanced F2L as a solved cross plus at least three solved slots', async () => {
    const kpuzzle = await puzzles['3x3x3'].kpuzzle();
    const oneSlotOut = kpuzzle.defaultPattern().applyAlg("R U' R'");
    const twoSlotsOut = oneSlotOut.applyAlg("L' U L");
    expect(reachesGoal(oneSlotOut, kpuzzle, '3x3', 'f2l-3slots')).toBe(true);
    expect(reachesGoal(oneSlotOut, kpuzzle, '3x3', 'f2l')).toBe(false);
    expect(reachesGoal(twoSlotsOut, kpuzzle, '3x3', 'f2l-3slots')).toBe(false);
  });

  it('fails closed when a future set reaches runtime before its registration', async () => {
    expect(goalOf('3x3', 'future-set', 'face')).toBe('unregistered');
    await expect(validateAlgCase(
      '', "R R'", { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' },
      '3x3' as AlgPuzzle, 'future-set',
    )).resolves.toEqual({ ok: false, reason: '未注册校验目标:3x3/future-set' });
  });
});
