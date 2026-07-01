/**
 * Maps the engine's single-slice atoms (axis, layer) to the vendored PuzzleGeometry
 * move ops for an NxNxN cube, and builds the generator array the group-theory kernel
 * uses. Kept separate from the bridge so the offline facts generator shares it.
 *
 * PG names the N single slices of each axis counting inward from a PRIMARY face until
 * the middle, then from the secondary face (probed from the vendored `getOrbitsDef`):
 *   x-axis: L, 2L, …, then 2R, R      (primary L = engine layer 0)
 *   y-axis: D, 2D, …, then 2U, U      (primary D = engine layer 0)
 *   z-axis: F, 2F, …, then 2B, B      (primary F = engine layer N-1)
 * i.e. x/y are numbered from the NEGATIVE face, z from the POSITIVE face. Engine layer
 * 0 = negative face (L/D/B), layer N-1 = positive face (R/U/F). A `1` prefix is omitted
 * (PG writes `F`, not `1F`).
 *
 * The two end faces of an axis turn in opposite rotational senses, so all generators are
 * normalised to the POSITIVE-face sense (R/U/F clockwise): an op named for a positive
 * face is used as-is, one named for a negative face is inverted. The one remaining global
 * engine-dir ↔ PG-op sign is pinned by the closed-loop test (tests/nxn_pg_bridge.test.ts).
 */
import type { PGOrbitsDef, PGTransform } from '@/lib/puzzle-geometry';

const PRIMARY = ['L', 'D', 'F'] as const;   // face PG numbers from, per axis
const SECONDARY = ['R', 'U', 'B'] as const; // face PG numbers the far half from
/** Whether the primary (numbered) face sits at engine layer 0. True for x/y (L/D),
 *  false for z (F is at layer N-1). */
const PRIMARY_AT_0 = [true, true, false] as const;

/** PG move name + whether it is named from a positive face (R/U/F), for engine
 *  (axis, layer). posSide drives the generator's sign normalisation (see buildEngineGens). */
export function pgSliceName(axis: 0 | 1 | 2, layer: number, N: number): { name: string; posSide: boolean } {
  const half = Math.ceil(N / 2);
  const P = PRIMARY[axis];
  const S = SECONDARY[axis];
  let letter: string;
  let k: number;
  if (PRIMARY_AT_0[axis]) {
    // primary at layer 0 → depth from primary = layer
    if (layer < half) { letter = P; k = layer + 1; }
    else { letter = S; k = N - layer; }
  } else {
    // primary at layer N-1 → depth from primary = N-1-layer
    if (N - 1 - layer < half) { letter = P; k = N - layer; }
    else { letter = S; k = layer + 1; }
  }
  const name = `${k === 1 ? '' : k}${letter}`;
  const posSide = letter === 'R' || letter === 'U' || letter === 'F';
  return { name, posSide };
}

/** The 3N PG slice names in engine index order (axis*N + layer) — for the panel's
 *  generator display. */
export function sliceMoveNames(N: number): string[] {
  const names: string[] = [];
  for (let axis = 0 as 0 | 1 | 2; axis < 3; axis++) {
    for (let layer = 0; layer < N; layer++) names.push(pgSliceName(axis, layer, N).name);
  }
  return names;
}

/** Build the 3N generator transforms indexed by `axis*N + layer`, normalised to the
 *  positive-face rotational sense (positive-named op as-is, negative-named inverted). */
export function buildEngineGens(od: PGOrbitsDef, N: number): PGTransform[] {
  const byName = new Map<string, PGTransform>();
  od.movenames.forEach((n, i) => byName.set(n, od.moveops[i]));
  const gens: PGTransform[] = [];
  for (let axis = 0 as 0 | 1 | 2; axis < 3; axis++) {
    for (let layer = 0; layer < N; layer++) {
      const { name, posSide } = pgSliceName(axis, layer, N);
      const op = byName.get(name);
      if (!op) throw new Error(`nxnPgSlices: no PG move "${name}" for ${N}x${N}x${N} (axis ${axis}, layer ${layer})`);
      gens.push(posSide ? op : op.inv());
    }
  }
  return gens;
}
