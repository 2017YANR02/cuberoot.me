/**
 * Megaminx ↔ PuzzleGeometry move bridge (PG name `megaminx`, a dodecahedron face cut at
 * 0.7). The engine's 12 face turns map 1:1 to PG's 12 shallow face moves BY NAME — the
 * engine's face indexing is defined to equal PG's `get3d()` face order
 * (["U","F","L","BL","BR","R","C","A","I","BF","E","D"]), so no fuzzy geometric matching
 * is needed (see megaState.ts FACE_NAME / FACE_NORMAL).
 *
 * `solvable: false` — |G| ≈ 1.01×10⁶⁸. Schreier-Sims FACTS (over the 12 face turns) and
 * live state (including WCA `R++/D++` deep turns), current element order, and group-solved
 * test come for free; a constructive
 * BSGS-with-words is hopeless in-browser (and any solution would be astronomically long),
 * so solve/scramble are not offered.
 *
 * `factsOverEngineGens` — PG's `megaminx` also exposes 6 middle slices (`2U`, `2F`,
 * …) on top of the 12 face turns; those permute centers and inflate |G| 60× to 6.04×10⁶⁹.
 * We compute the displayed |G| over the 12 face turns alone → the canonical 1.01×10⁶⁸ with
 * a clean integer constraint index 24. Two trailing generators combine that middle slice
 * with the opposite outer face to mirror WCA `2-3L` / `2-3U` without changing the facts.
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
  factsGeneratorCount: FACE_NAME.length,
  factsMoveNames: FACE_NAME,
  engineGens(od: PGOrbitsDef): PGTransform[] {
    const byName = new Map<string, PGTransform>();
    od.movenames.forEach((n, i) => byName.set(n, od.moveops[i]));
    const shallow = FACE_NAME.map((name) => {
      const op = byName.get(name);
      if (!op) throw new Error(`megaPgBridge: no PG move for face ${name}`);
      return op;
    });
    const deepDouble = (sliceName: '2L' | '2U', oppositeName: 'R' | 'D') => {
      const slice = byName.get(sliceName);
      const opposite = byName.get(oppositeName);
      if (!slice || !opposite) {
        throw new Error(`megaPgBridge: no PG move for ${sliceName}/${oppositeName}`);
      }
      // PG uppercase `2L` is the middle slice only. `2-3L` also includes the
      // opposite R face, whose positive physical rotation is R'. The two disjoint
      // layers commute, so squaring their product gives the WCA 144-degree turn.
      const deep = slice.mul(opposite.inv());
      return deep.mul(deep);
    };
    return [...shallow, deepDouble('2L', 'R'), deepDouble('2U', 'D')];
  },
  moveToStep(m): WordStep {
    if (!m.deep) return { gi: m.face, inv: m.dir === 1 };
    if (m.face === 2) return { gi: FACE_NAME.length, inv: m.dir === 1 };
    if (m.face === 0) return { gi: FACE_NAME.length + 1, inv: m.dir === 1 };
    throw new Error(`megaPgBridge: unsupported deep face ${m.face}`);
  },
  stepToMove(s): MegaMove {
    if (s.gi < FACE_NAME.length) return { face: s.gi, dir: s.inv ? 1 : -1 };
    if (s.gi === FACE_NAME.length) return { face: 2, dir: s.inv ? 1 : -1, deep: true };
    if (s.gi === FACE_NAME.length + 1) return { face: 0, dir: s.inv ? 1 : -1, deep: true };
    throw new Error(`megaPgBridge: unsupported generator ${s.gi}`);
  },
  parse: parseMegaMoves,
  toString: megaMovesToString,
  reduce: reduceMegaAlg,
};
