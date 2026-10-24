// Local solver proof: pnpm --filter @cuberoot/client test:solvers xcross-ranking_solver
// Requires the committed WASM and XC table assets; normal sparse CI runs the structural tests.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { rankXCrossSolutions, xcrossEffort } from '@cuberoot/timer-ui/stage-solver/xcross-ranking';
import type { MovesResult } from '@cuberoot/timer-ui/stage-solver/rust-cross-client';
interface TestCrossSolver {
  attach_xcross(bytes: Uint8Array): void;
  solve_face(scramble: string, stage: number, face: number): number;
  solve_moves(scramble: string, stage: number, face: number, extra: number, cap: number, combo: string, onSol: () => void): string;
  solve_moves_masked(scramble: string, stage: number, face: number, extra: number, cap: number, combo: string, mask: number, onSol: () => void): string;
  solve_candidates(scramble: string, stage: number, face: number, min: number, extra: number, combo: string, mask: number): string;
  free(): void;
}

describe('bounded WASM candidate coverage', () => {
  let solver: TestCrossSolver;
  beforeAll(async () => {
    const asset = (name: string) => readFileSync(new URL(`../../../../tools/solver/rust-cross/${name}`, import.meta.url));
    const wasm = await import(new URL('../../../../tools/solver/rust-cross/cross_solver.js', import.meta.url).href);
    wasm.initSync({ module: asset('cross_solver_bg.wasm') });
    solver = new wasm.CrossSolverWasm(gunzipSync(asset('tables/pt_cross.bin.gz')));
    solver.attach_xcross(gunzipSync(asset('tables/pt_cross_C4E0.bin.gz')));
  });
  afterAll(() => solver.free());

  it('covers both stages/six bottom colours with independent replay and unchanged exact distances', () => {
    const scramble = "R2 B D' F2 R' U L2 B' D2 L F U2 R2 B2 U' L2 F2 D R2";
    for (const stage of [1, 2]) for (let face = 0; face < 6; face++) {
      const base: MovesResult = JSON.parse(solver.solve_moves(scramble, stage, face, 0, 1, '', () => {}));
      const candidates: MovesResult = JSON.parse(solver.solve_candidates(scramble, stage, face, base.len, 2, '', 0x3ffff));
      expect(candidates.len).toBe(base.len);
      expect(candidates.sols.length).toBeLessThanOrEqual((stage === 1 ? 4 : 6) * 3 * 18 * 4);
      for (const sol of candidates.sols) {
        const score = xcrossEffort(scramble, sol);
        expect(score.valid, sol.m).toBe(true);
        expect(score.moves).toBeGreaterThanOrEqual(base.len);
        expect(score.moves).toBeLessThanOrEqual(base.len + 2);
      }
      expect(solver.solve_face(scramble, stage, face)).toBe(base.len);
      expect(rankXCrossSolutions(scramble, [...base.sols, ...candidates.sols], 10).length).toBeGreaterThan(0);
    }
  });

  it('retains longer depths/nonoptimal slots and respects fixed slots/forbidden faces', () => {
    const scramble = 'F R B';
    const base: MovesResult = JSON.parse(solver.solve_moves(scramble, 1, 0, 0, 1, '', () => {}));
    const varied: MovesResult = JSON.parse(solver.solve_candidates(scramble, 1, 0, base.len, 2, '', 0x3ffff));
    expect([...new Set(varied.sols.map(s => xcrossEffort(scramble, s).moves))].sort()).toEqual([3, 4, 5]);
    expect([...new Set(varied.sols.map(s => s.c))].sort()).toEqual(['BL', 'BR', 'FL', 'FR']);
    const masked: MovesResult = JSON.parse(solver.solve_moves_masked(scramble, 1, 0, 0, 1, '2', 0x7fff, () => {}));
    const fixed: MovesResult = JSON.parse(solver.solve_candidates(scramble, 1, 0, masked.len, 2, '2', 0x7fff));
    expect(fixed.sols.length).toBeGreaterThan(0);
    for (const sol of fixed.sols) {
      expect(sol.c).toBe('FR');
      expect(sol.m).not.toMatch(/B/);
      expect(xcrossEffort(scramble, sol).valid).toBe(true);
    }
    expect(JSON.parse(solver.solve_candidates('', 2, 0, 0, 2, '', 0x3ffff)).sols).toEqual([]);
  });
});
