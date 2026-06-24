/**
 * Helicopter Cube ↔ PuzzleGeometry move bridge (PG name `helicopter`, a cube edge-cut
 * at √½). Each of the 12 engine edge twists is a 180° INVOLUTION, so there is no
 * chirality — `dir` is irrelevant and the generator is its own inverse. The engine
 * edges map to PG's 12 shallow single-edge caps by face-letter set (the `2X` two-layer
 * slices are skipped).
 *
 * `solvable: false` — |G| ≈ 2.8×10^20. The Schreier-Sims FACTS (|G|, orbits) and live
 * state (current element order, group-solved test) come for free, but a constructive
 * BSGS-with-words is infeasible in-browser, so solve/scramble are not offered.
 */
import type { MoveBridge } from '../pgBinding';
import type { PGOrbitsDef, PGTransform } from '@/lib/puzzle-geometry';
import type { WordStep } from '../pgGroup';
import { HELI_EDGE_NAMES, parseHeliMoves, heliMovesToString, type HeliMove } from './heliState';

const lettersKey = (name: string): string =>
  [...name].filter((c) => c >= 'A' && c <= 'Z').sort().join('');

export const heliPgBridge: MoveBridge<HeliMove> = {
  pgName: 'helicopter',
  solvable: false,
  engineGens(od: PGOrbitsDef): PGTransform[] {
    const byKey = new Map<string, PGTransform>();
    od.movenames.forEach((n, i) => {
      if (!/^\d/.test(n)) byKey.set(lettersKey(n), od.moveops[i]); // shallow single-edge cap
    });
    return HELI_EDGE_NAMES.map((name) => {
      const op = byKey.get(lettersKey(name));
      if (!op) throw new Error(`heliPgBridge: no PG cap for edge ${name}`);
      return op;
    });
  },
  // 180° involution: the generator equals its inverse, so `inv` carries no meaning.
  moveToStep: (m): WordStep => ({ gi: m.edge, inv: false }),
  stepToMove: (s): HeliMove => ({ edge: s.gi }),
  parse: parseHeliMoves,
  toString: heliMovesToString,
};
