/**
 * Pyraminx ↔ PuzzleGeometry move bridge for the general `PgEngineBinding`.
 *
 * The engine's 12 turning generators expressed as PG group elements:
 *   • tip turn    = PG `DRF` family (touches only the tip orbit CORNERS2);
 *   • corner turn = PG `DRF · 2DRF` — the engine's corner turn carries the tip *and*
 *     the corner-axial slice + 3 edges, whereas PG's `2DRF` alone is just the slice,
 *     so the engine generator is their product (disjoint orbits → they commute);
 *   • face turn   = PG's far-slab move on the same axis, which PG names by the face
 *     opposite the vertex (`L` for DRF etc.). Face turns take the group from the pure
 *     turning group (75,582,720) to the full pyraminx group including the 12 whole-
 *     puzzle reorientations (906,992,640 — exactly PG's facts order, so the group panel
 *     becomes self-consistent with the precomputed facts/index).
 *
 * Vertex/orientation correspondence (σ = identity: engine U/L/R/B = PG
 * DRF/DFL/DLR/FRL; engine bare corner turn dir −1 = the forward generator; engine bare
 * face turn dir +1 = the forward face generator — PG names the far slab from the face's
 * own perspective, the opposite end of the axis; PG mirror = state·φ(m)) was determined
 * AND proven by the closed-loop test: scramble the engine (face turns included), mirror
 * into PG, factor the inverse, replay on the engine → `complete` every time. Any vertex
 * bijection works with its matching chirality (24 winners); this is the σ = identity one.
 */
import type { MoveBridge } from '../pgBinding';
import type { PGOrbitsDef, PGTransform } from '@/lib/puzzle-geometry';
import type { WordStep } from '../pgGroup';
import { parsePyraMoves, pyraMovesToString, reducePyraAlg, type PyraMove, type PyraPart } from './pyraState';

/** BSGS generator index k = engine vertex; PG vertex name for that engine vertex. */
const PG_VERTICES = ['DRF', 'DFL', 'DLR', 'FRL'] as const;
/** PG's far-slab (face) move on each engine vertex's axis — PG names it by the face
 *  opposite the vertex: DRF↔L, DFL↔R, DLR↔F, FRL↔D. */
const PG_FACES = ['L', 'R', 'F', 'D'] as const;

const PART_BASE: Record<PyraPart, number> = { tip: 0, corner: 4, face: 8 };

export const pyraPgBridge: MoveBridge<PyraMove> = {
  pgName: 'pyraminx',
  engineGens(od: PGOrbitsDef): PGTransform[] {
    const idx = (n: string) => od.movenames.indexOf(n);
    const gens: PGTransform[] = [];
    for (const v of PG_VERTICES) gens.push(od.moveops[idx(v)]); // tips: gi 0..3
    for (const v of PG_VERTICES) gens.push(od.moveops[idx(v)].mul(od.moveops[idx(`2${v}`)])); // corners: gi 4..7
    for (const f of PG_FACES) gens.push(od.moveops[idx(f)]); // faces: gi 8..11
    return gens;
  },
  moveToStep(m: PyraMove): WordStep {
    // Bare corner/tip (dir −1) and bare face (dir +1) are both the forward generator —
    // the face grip looks down the axis from the opposite end.
    return { gi: PART_BASE[m.part] + m.vertex, inv: m.part === 'face' ? m.dir === -1 : m.dir === 1 };
  },
  stepToMove(s: WordStep): PyraMove {
    const part: PyraPart = s.gi < 4 ? 'tip' : s.gi < 8 ? 'corner' : 'face';
    const dir = (part === 'face' ? (s.inv ? -1 : 1) : (s.inv ? 1 : -1)) as 1 | -1;
    return { vertex: s.gi % 4, part, dir };
  },
  parse: parsePyraMoves,
  toString: pyraMovesToString,
  reduce: reducePyraAlg,
};
