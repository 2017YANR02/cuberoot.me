/**
 * Pyraminx ↔ PuzzleGeometry move bridge for the general `PgEngineBinding`.
 *
 * The engine's 8 turning generators expressed as PG group elements:
 *   • tip turn   = PG `DRF` family (touches only the tip orbit CORNERS2);
 *   • big turn   = PG `DRF · 2DRF` — the engine's corner turn carries the tip *and*
 *     the corner-axial slice + 3 edges, whereas PG's `2DRF` alone is just the slice,
 *     so the engine generator is their product (disjoint orbits → they commute).
 *
 * Vertex/orientation correspondence (σ = identity: engine U/L/R/B = PG
 * DRF/DFL/DLR/FRL; engine bare turn dir −1 = the forward generator; PG mirror =
 * state·φ(m)) was determined AND proven by the closed-loop test: scramble the engine,
 * mirror into PG, factor the inverse, replay on the engine → `complete` every time.
 * Any vertex bijection works with its matching chirality (24 winners); this is the
 * σ = identity one.
 */
import type { MoveBridge } from '../pgBinding';
import type { PGOrbitsDef, PGTransform } from '@/lib/puzzle-geometry';
import type { WordStep } from '../pgGroup';
import { parsePyraMoves, pyraMovesToString, reducePyraAlg, type PyraMove } from './pyraState';

/** BSGS generator index k = engine vertex; PG vertex name for that engine vertex. */
const PG_VERTICES = ['DRF', 'DFL', 'DLR', 'FRL'] as const;

export const pyraPgBridge: MoveBridge<PyraMove> = {
  pgName: 'pyraminx',
  engineGens(od: PGOrbitsDef): PGTransform[] {
    const idx = (n: string) => od.movenames.indexOf(n);
    const gens: PGTransform[] = [];
    for (const v of PG_VERTICES) gens.push(od.moveops[idx(v)]); // tips: gi 0..3
    for (const v of PG_VERTICES) gens.push(od.moveops[idx(v)].mul(od.moveops[idx(`2${v}`)])); // corners: gi 4..7
    return gens;
  },
  moveToStep(m: PyraMove): WordStep {
    return { gi: (m.tip ? 0 : 4) + m.vertex, inv: m.dir === 1 };
  },
  stepToMove(s: WordStep): PyraMove {
    return { vertex: s.gi % 4, tip: s.gi < 4, dir: s.inv ? 1 : -1 };
  },
  parse: parsePyraMoves,
  toString: pyraMovesToString,
  reduce: reducePyraAlg,
};
