/**
 * Megaminx ↔ PuzzleGeometry move bridge (PG name `megaminx`, a dodecahedron face cut at
 * 0.7). The engine's 12 face turns map 1:1 to PG's 12 shallow face moves BY NAME — the
 * engine's face indexing is defined to equal PG's `get3d()` face order
 * (["U","F","L","BL","BR","R","C","A","I","BF","E","D"]), so no fuzzy geometric matching
 * is needed (see megaState.ts FACE_NAME / FACE_NORMAL).
 *
 * `solvable: false` — |G| ≈ 1.01×10⁶⁸. Schreier-Sims FACTS (over the 12 face turns) and
 * live state (current element order, group-solved test) come for free; a constructive
 * BSGS-with-words is hopeless in-browser (and any solution would be astronomically long),
 * so solve/scramble are not offered.
 *
 * `factsOverEngineGens` — PG's `megaminx` also exposes 6 deep 2-layer slices (`2U`, `2F`,
 * …) on top of the 12 face turns; those permute centers and inflate |G| 60× to 6.04×10⁶⁹.
 * We compute the displayed |G| over the 12 face turns alone → the canonical 1.01×10⁶⁸ with
 * a clean integer constraint index 24.
 *
 * The `inv` sense (engine dir → PG move direction) is pinned by tests/mega_pg_bridge.test.ts
 * (engine-solved ⇔ PG-identity across random sequences).
 */
import type { MoveBridge } from '../pgBinding';
import type { PGOrbitsDef, PGTransform } from '@/lib/puzzle-geometry';
import type { WordStep } from '../pgGroup';
import {
  FACE_NAME, parseMegaMoves, megaMovesToString, reduceMegaAlg, type MegaMove,
} from './megaState';

export const megaPgBridge: MoveBridge<MegaMove> = {
  pgName: 'megaminx',
  solvable: false,
  factsOverEngineGens: true,
  factsMoveNames: FACE_NAME,
  engineGens(od: PGOrbitsDef): PGTransform[] {
    const byName = new Map<string, PGTransform>();
    od.movenames.forEach((n, i) => byName.set(n, od.moveops[i]));
    return FACE_NAME.map((name) => {
      const op = byName.get(name);
      if (!op) throw new Error(`megaPgBridge: no PG move for face ${name}`);
      return op;
    });
  },
  moveToStep: (m): WordStep => ({ gi: m.face, inv: m.dir === 1 }),
  stepToMove: (s): MegaMove => ({ face: s.gi, dir: s.inv ? 1 : -1 }),
  parse: parseMegaMoves,
  toString: megaMovesToString,
  reduce: reduceMegaAlg,
};
