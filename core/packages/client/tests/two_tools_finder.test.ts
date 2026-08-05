import { describe, expect, it } from 'vitest';
import { applyPocketAlg, pocketStateToFacelet, solvedPocketState } from '@/lib/pocket-facelet';
import {
  ergonomicScore,
  findTwoToolsSolutions,
  simplifyTwoToolsMoves,
  type TwoToolsCaseInput,
} from '@/lib/two-tools-solver';

const sixSolidFaces = (alg: string): boolean => {
  const facelet = pocketStateToFacelet(applyPocketAlg(solvedPocketState(), alg));
  return Array.from({ length: 6 }, (_, i) => new Set(facelet.slice(i * 4, i * 4 + 4)).size === 1)
    .every(Boolean);
};

describe('two-tools finder core', () => {
  it('simplifies adjacent turns without crossing a rotation', () => {
    expect(simplifyTwoToolsMoves("R R U U' F2 F2")).toBe('R2');
    expect(simplifyTwoToolsMoves("R y R'")).toBe("R y R'");
  });

  it('keeps the upstream ergonomic timing semantics', () => {
    const timings = { 'R U R': 0.21, "U R U'": 0.17 };
    expect(ergonomicScore("R U R U'", timings)).toBeLessThan(ergonomicScore('F2 U2 F2 U2'));
  });

  it('finds an exact case in any inspection orientation and returns a real solve', () => {
    const setup = "R U R'";
    const cases: TwoToolsCaseInput[] = [{
      set: 'cll', method: 'CLL', name: 'fixture', subgroup: 'Sune', setup,
      algs: ["R U' R'"],
    }];
    const solutions = findTwoToolsSolutions({
      scramble: setup,
      cases,
      depths: { EG: 0, TCLL: 0, LS: 0 },
    });
    expect(solutions.length).toBeGreaterThan(0);
    expect(solutions[0].method).toBe('CLL');
    expect(sixSolidFaces([setup, solutions[0].inspection, solutions[0].solution].filter(Boolean).join(' '))).toBe(true);
  });

  it('joins the two BFS halves and respects the selected method set', () => {
    const setup = "R U F R'";
    const inverse = "R F' U' R'";
    const cases: TwoToolsCaseInput[] = [
      { set: 'cll', method: 'CLL', name: 'fixture', subgroup: 'T', setup, algs: [inverse] },
      { set: 'eg1', method: 'EG-1', name: 'same state', subgroup: 'T', setup, algs: [inverse] },
    ];
    const solutions = findTwoToolsSolutions({
      scramble: 'R U',
      cases,
      depths: { EG: 2, TCLL: 0, LS: 0 },
      selectedMethods: ['EG-1'],
    });
    expect(solutions.length).toBeGreaterThan(0);
    expect(new Set(solutions.map((s) => s.method))).toEqual(new Set(['EG-1']));
  });
});
