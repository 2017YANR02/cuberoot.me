import { describe, expect, it } from 'vitest';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { CUBE_ORIENTATIONS, timerSmartCubeTrainingComplete, type EventId } from '@cuberoot/shared/timer';

const state = (alg: string, orientation = '') => smartCubeTargetFacelets(alg, orientation)!;
const ua = "R U' R U R U R U' R' U' R2";
const sune = "R U R' U R U2 R'";
const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";

describe('fixed-frame smart cube training completion', () => {
  for (const { value: orientation } of CUBE_ORIENTATIONS) {
    it(`preserves each finish line and AUF in grip ${orientation || 'UF'}`, () => {
      const complete = (event: EventId, alg: string) => timerSmartCubeTrainingComplete(event, state(alg, orientation), orientation);
      for (const auf of ['', 'U', 'U2', "U'"]) {
        expect(complete('cross', `${sune} ${auf}`)).toBe(true);
        expect(complete('f2l', `${sune} ${auf}`)).toBe(true);
        expect(complete('oll', `${ua} ${auf}`)).toBe(true);
        expect(complete('coll', `${ua} ${auf}`)).toBe(true);
        expect(complete('cmll', `${ua} ${auf}`)).toBe(true);
        expect(complete('oll', `${sune} ${auf}`)).toBe(false);
        expect(complete('coll', `${sune} ${auf}`)).toBe(false);
        expect(complete('cmll', `${sune} ${auf}`)).toBe(false);
      }
      expect(complete('cmll', 'M2')).toBe(true);
      expect(complete('coll', 'M2')).toBe(false);
      expect(complete('cmll', 'S2')).toBe(false);
      expect(complete('oll', tPerm)).toBe(true);
      expect(complete('coll', tPerm)).toBe(false);
      expect(complete('cmll', tPerm)).toBe(false);
      for (const event of ['cross', 'f2l', 'oll', 'coll', 'cmll'] as const) {
        expect(complete(event, 'R')).toBe(false);
      }
      // The opposite cross/F2L remains complete, but the selected bottom is misaligned.
      expect(complete('cross', 'D')).toBe(false);
      expect(complete('f2l', 'D')).toBe(false);
    });
  }

  it('does not treat full-solve events or malformed states as partial completion', () => {
    for (const event of ['333', '333bld', 'pll', 'll', 'zbll', '222'] as const) {
      expect(timerSmartCubeTrainingComplete(event, state(''), '')).toBe(false);
    }
    expect(timerSmartCubeTrainingComplete('oll', '', '')).toBe(false);
  });
});
