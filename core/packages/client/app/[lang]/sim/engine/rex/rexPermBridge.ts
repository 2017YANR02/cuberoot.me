/**
 * Rex Cube perm-bridge — its group built straight from the engine's own permutation
 * model (rexState) over a 42-point layout, the non-PG analogue of a MoveBridge.
 *
 * FACTS-ONLY (`solvable:false`): the PG octahedron (FTO) counts the invisible 4-fold
 * centre orientation and would over-report |G|, and the real group (~4e23) is too big
 * for an in-browser constructive BSGS. |G| + orbit facts + live solved-state still work.
 *
 * Layout: [centres 6][petals-A 12][petals-B 12][edges 12] = 42 points. A corner turn
 * cycles 9 petals as three 3-cycles; BFS over the 8 generators splits the 24 petals
 * into TWO orbits of 12 (per the rexState header), laid out as the two petal blocks.
 */
import {
  solvedRex, applyRexMove, parseRexMoves, rexMovesToString,
  CORNER_NAMES, type RexMove,
} from './rexState';
import type { PermBridge, PermOrbit } from '../permBridge';

const DEGREE = 42;

/** Partition the 24 petals into orbits by BFS over the engine's 8 corner turns. */
function petalPartition(): number[][] {
  const gens = CORNER_NAMES.map((_, c) => applyRexMove(solvedRex(), { corner: c, dir: 1 }).petals);
  const seen = new Array<number>(24).fill(-1);
  const orbits: number[][] = [];
  for (let s = 0; s < 24; s++) {
    if (seen[s] >= 0) continue;
    const id = orbits.length;
    const orbit: number[] = [];
    const q = [s];
    seen[s] = id;
    while (q.length) {
      const x = q.pop()!;
      orbit.push(x);
      for (const g of gens) if (seen[g[x]] < 0) { seen[g[x]] = id; q.push(g[x]); }
    }
    orbits.push(orbit.sort((a, b) => a - b));
  }
  return orbits;
}

const PETAL_ORBITS = petalPartition();
/** petal index → its point in the 42-point layout (block 6.. per orbit of 12). */
const pointOfPetal = new Array<number>(24);
PETAL_ORBITS.forEach((orbit, oi) => orbit.forEach((p, i) => { pointOfPetal[p] = 6 + oi * 12 + i; }));

/** g[slot] = source slot for corner `c`'s +120° turn, read straight off the engine. */
function buildGen(c: number): number[] {
  const after = applyRexMove(solvedRex(), { corner: c, dir: 1 });
  const g = Array.from({ length: DEGREE }, (_, i) => i);
  for (let s = 0; s < 6; s++) g[s] = after.centers[s];
  for (let p = 0; p < 24; p++) g[pointOfPetal[p]] = pointOfPetal[after.petals[p]];
  for (let s = 0; s < 12; s++) g[30 + s] = 30 + after.edges[s];
  return g;
}

const GENS = CORNER_NAMES.map((_, c) => buildGen(c));

const orbits: PermOrbit[] = [
  { name: 'CENTERS', pieces: 6, oriMod: 1, permutes: true },
  { name: 'PETALS', pieces: 12, oriMod: 1, permutes: true },
  { name: 'PETALS2', pieces: 12, oriMod: 1, permutes: true },
  { name: 'EDGES', pieces: 12, oriMod: 1, permutes: true },
];

export const rexPermBridge: PermBridge<RexMove> = {
  key: 'rex',
  genPerms: () => GENS.map((g) => g.slice()),
  orbits,
  moveNames: [...CORNER_NAMES],
  moveToStep: (m) => ({ gi: m.corner, inv: m.dir === -1 }),
  stepToMove: (s) => ({ corner: s.gi, dir: s.inv ? -1 : 1 }),
  parse: parseRexMoves,
  toString: rexMovesToString,
  solvable: false,
};
