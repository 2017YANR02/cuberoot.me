/**
 * FTO ↔ PuzzleGeometry move bridge (PG name `FTO`, an octahedron face cut at 0.333). The
 * engine's 8 face turns map 1:1 to PG's 8 single-face moves BY NAME — the engine face order
 * (FACE_PG = ["U","F","L","R","BB","BL","BR","D"]) is the PG move-name order, so no fuzzy
 * geometric matching is needed.
 *
 * `solvable: false` — |G| ≈ 3.14×10²² (> the helicopter's ~10²⁰ in-browser BSGS cutoff).
 * Schreier-Sims FACTS (over the 8 face turns) and live state mirroring come for free; a
 * constructive BSGS-with-words is impractical in-browser, so solve/scramble are not offered
 * in the group renderer.
 *
 * `factsOverEngineGens` — PG's `o f 0.333` also exposes 4 deep middle-layer slices
 * (`2U`/`2F`/…) on top of the 8 face turns; those permute the inner pieces and inflate |G|.
 * We compute the displayed |G| over the 8 face turns alone → the canonical FTO group.
 *
 * The `inv` sense (engine dir → PG move direction) is pinned by tests/fto_pg_bridge.test.ts
 * (engine-solved ⇔ PG-identity across random sequences).
 */
import type { MoveBridge } from '../pgBinding';
import type { PGOrbitsDef, PGTransform, PuzzleName } from '@/lib/puzzle-geometry';
import type { WordStep } from '../pgGroup';
import {
  FACE_PG, parseFtoMoves, ftoMovesToString, reduceFtoAlg, type FtoMove,
} from './ftoState';

export const ftoPgBridge: MoveBridge<FtoMove> = {
  pgName: 'FTO' as PuzzleName,
  solvable: false,
  factsOverEngineGens: true,
  factsMoveNames: FACE_PG,
  engineGens(od: PGOrbitsDef): PGTransform[] {
    const byName = new Map<string, PGTransform>();
    od.movenames.forEach((n, i) => byName.set(n, od.moveops[i]));
    return FACE_PG.map((name) => {
      const op = byName.get(name);
      if (!op) throw new Error(`ftoPgBridge: no PG move for face ${name}`);
      return op;
    });
  },
  moveToStep: (m): WordStep => ({ gi: m.face, inv: m.dir === 1 }),
  stepToMove: (s): FtoMove => ({ face: s.gi, dir: s.inv ? 1 : -1 }),
  parse: parseFtoMoves,
  toString: ftoMovesToString,
  reduce: reduceFtoAlg,
};
