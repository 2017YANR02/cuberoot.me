import { describe, expect, it } from 'vitest';
import {
  alignAlgToState, foldRotations, isSolvedShape, stateOfAlg,
} from '../scripts/best2x2/derive.mts';
import {
  applyPocketAlg, pocketStateToFacelet, POCKET_ROTATIONS, rotatePocketState,
} from '../lib/pocket-facelet';

describe('Best 2x2 Algs case alignment', () => {
  it('aligns every whole-cube orientation back to one executable face-turn formula', () => {
    const alg = "R U R' U R U2 R'";
    const state = stateOfAlg(alg);
    for (const rot of POCKET_ROTATIONS) {
      const oriented = rotatePocketState(state, rot);
      const aligned = alignAlgToState(oriented, alg);
      expect(aligned).not.toBeNull();
      expect(aligned).not.toMatch(/[xyz]/);
      expect(isSolvedShape(pocketStateToFacelet(applyPocketAlg(oriented, aligned!)))).toBe(true);
    }
  });

  it('keeps rotation folding operationally equivalent', () => {
    const alg = "y R U R' x' F2";
    const state = stateOfAlg(alg);
    const folded = foldRotations(alg);
    expect(isSolvedShape(pocketStateToFacelet(applyPocketAlg(state, folded)))).toBe(true);
  });
});
