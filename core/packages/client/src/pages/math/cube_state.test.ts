import { describe, it, expect } from 'vitest';
import {
  identity, applyAlg, isSolved, orderOf, invariants, invertAlg, conjugate,
  commutator, thistlethwaiteStage, cycleStructure, inG1,
} from './cube_state';

describe('cube_state move tables', () => {
  it('R has order 4', () => {
    expect(orderOf('R')).toBe(4);
  });
  it('U has order 4', () => {
    expect(orderOf('U')).toBe(4);
  });
  it('R2 has order 2', () => {
    expect(orderOf('R2')).toBe(2);
  });
  it('R U has order 105', () => {
    expect(orderOf('R U')).toBe(105);
  });
  it('R U R U R U R U R U has order ... wait this is 5 reps of R U, so 21', () => {
    expect(orderOf('R U R U R U R U R U')).toBe(21);
  });
  it("R U R' U' has order 6 (sexy move)", () => {
    expect(orderOf("R U R' U'")).toBe(6);
  });
  it("R U R' U R U2 R' (Sune) has order 6", () => {
    expect(orderOf("R U R' U R U2 R'")).toBe(6);
  });
  it('U R has order 105 too', () => {
    expect(orderOf('U R')).toBe(105);
  });
  it('R L has order 4', () => {
    // R and L commute on permutation but not orientation; order 4.
    expect(orderOf('R L')).toBe(4);
  });
  it('full superflip is order 2 (all 12 edges flipped)', () => {
    // Standard superflip alg (Reid): U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2
    expect(orderOf("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2")).toBe(2);
  });
});

describe('invariants', () => {
  it('identity is reachable', () => {
    const inv = invariants(identity());
    expect(inv.reachable).toBe(true);
    expect(inv.coSum).toBe(0);
    expect(inv.eoSum).toBe(0);
  });

  it('single R move keeps cube reachable', () => {
    const s = applyAlg(identity(), 'R');
    const inv = invariants(s);
    expect(inv.reachable).toBe(true);
  });

  it("R U R' U' keeps cube reachable", () => {
    const s = applyAlg(identity(), "R U R' U'");
    const inv = invariants(s);
    expect(inv.reachable).toBe(true);
  });

  it('manually breaking corner orientation makes it unreachable', () => {
    const s = applyAlg(identity(), 'R');
    s.co[0] = (s.co[0] + 1) % 3;
    expect(invariants(s).reachable).toBe(false);
  });
});

describe('inverse / conjugate / commutator', () => {
  it("invertAlg of R U R' is R U' R'", () => {
    expect(invertAlg("R U R'")).toBe("R U' R'");
  });

  it('inverting an alg and applying both returns identity', () => {
    const alg = "R U R' U R U2 R'";
    const inv = invertAlg(alg);
    const s = applyAlg(identity(), `${alg} ${inv}`);
    expect(isSolved(s)).toBe(true);
  });

  it("[R, U] = R U R' U' (sexy move)", () => {
    expect(commutator('R', 'U')).toBe("R U R' U'");
  });

  it("conjugate U F2 U' is U F2 U'", () => {
    expect(conjugate('U', 'F2')).toBe("U F2 U'");
  });
});

describe('Thistlethwaite stages', () => {
  it('solved is stage 4', () => {
    expect(thistlethwaiteStage(identity())).toBe(4);
  });

  it('after F, EO is broken so stage 0', () => {
    const s = applyAlg(identity(), 'F');
    expect(thistlethwaiteStage(s)).toBe(0);
  });

  it('after U, still in G1 (and G2 — UD edges in place, CO 0, ep parity even is needed for G3)', () => {
    const s = applyAlg(identity(), 'U');
    expect(inG1(s)).toBe(true);
  });

  it('after R2, in G3 (only half-turns needed to solve)', () => {
    const s = applyAlg(identity(), 'R2');
    expect(thistlethwaiteStage(s)).toBe(3);
  });

  it("after R U R' U' (sexy move), not even in G1 (F-axis EO flipped)", () => {
    const s = applyAlg(identity(), "R U R' U'");
    expect(thistlethwaiteStage(s)).toBe(0);
  });
});

describe('cycle structure', () => {
  it('identity has empty cycle structure', () => {
    expect(cycleStructure([0, 1, 2, 3])).toEqual([]);
  });
  it('3-cycle on 4 elts → [3]', () => {
    expect(cycleStructure([1, 2, 0, 3])).toEqual([3]);
  });
  it('two 2-cycles → [2, 2]', () => {
    expect(cycleStructure([1, 0, 3, 2])).toEqual([2, 2]);
  });
});
