import { describe, it, expect } from 'vitest';
import {
  getPuzzleGeometryByName,
  schreierSims,
  pgPuzzle,
} from '@/lib/puzzle-geometry';

// Smoke + correctness anchor for the vendored cubing.js puzzle-geometry subsystem.
// Proves the group-theory core actually runs in our build: build the Pyraminx from
// its cut description, take the move generators as permutations, and let our copy of
// Schreier-Sims compute the exact group order |G|. The Pyraminx (tips included) has
// |G| = 75,582,720 = 933,120 (corners+edges) × 3^4 (the 4 independent tips).
describe('vendored cubing.js puzzle-geometry — group theory runs', () => {
  it('has the pyraminx cut description', () => {
    expect(pgPuzzle.pyraminx).toBe('t v 0.333333333333333 v 1.66666666666667');
  });

  it('derives the pyraminx orbit structure', () => {
    const od = getPuzzleGeometryByName('pyraminx', {}).getOrbitsDef(false);
    // 3 orbits: 6 edges (ori 2) + two 4-cycles of corner pieces (axials & tips, ori 3).
    expect(od.orbitnames).toEqual(['EDGES', 'CORNERS', 'CORNERS2']);
    // Unconstrained reassembly = (6!·2^6) · (4!·3^4)^2 = 46080 · 1944^2.
    expect(od.reassemblySize()).toBe(174142586880n);
    // 12 generators = 4 vertex axes × { tip (e.g. "DRF"), 2-layer ("2DRF"),
    // whole-puzzle rotation (the bare single letter "L"/"R"/"F"/"D") }.
    expect(od.movenames).toEqual(
      ['DRF', '2DRF', 'L', 'DFL', '2DFL', 'R', 'DLR', '2DLR', 'F', 'FRL', '2FRL', 'D'],
    );
  });

  it('computes |G| with Schreier-Sims, with and without reorientation', () => {
    const od = getPuzzleGeometryByName('pyraminx', {}).getOrbitsDef(false);

    // Full generator set (includes the 4 whole-puzzle rotations) → the puzzle group
    // counted in fixed space, |G| = 906,992,640. Constraint index vs reassembly = 192.
    const full = schreierSims(od.moveops.map((m) => m.toPerm()), () => {});
    expect(full).toBe(906992640n);
    expect(174142586880n / full).toBe(192n);

    // Drop the 4 bare single-letter moves (the tetrahedral reorientations, |A4| = 12)
    // → the classic Pyraminx count quotiented by orientation: 75,582,720 = 906,992,640 / 12.
    const turnsOnly = od.moveops
      .filter((_, i) => od.movenames[i].length > 1)
      .map((m) => m.toPerm());
    const fixedFrame = schreierSims(turnsOnly, () => {});
    expect(fixedFrame).toBe(75582720n);
    expect(full / fixedFrame).toBe(12n);
  });
});
