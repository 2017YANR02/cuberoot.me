/**
 * Skewb ↔ PuzzleGeometry move bridge (PG name `skewb`, a cube vertex-cut through the
 * centre). Shares the corner-turning factory with Dino — see `../cornerPgBridge.ts`.
 * PG tracks both corner orbits (CORNERS + CORNERS2, each Z3) and the 6 centres; the
 * engine's 8 grips map to PG's 8 shallow corner caps by face-letter set.
 */
import { makeCornerPgBridge } from '../cornerPgBridge';
import {
  CORNER_NAMES, parseSkewbMoves, skewbMovesToString, isSkewbRot, rotateGripMap,
} from './skewbState';
import type { CornerMove } from '../cornerNotation';

// PG tracks the fixed-in-space corner group; whole-cube rotations (x/y/z) have no exposed
// PG rotation op, so we FOLD them into a world-letter → physical-grip map (rotateGripMap,
// the same table the engine's remap is derived from) rather than dropping them: after a
// rotation each subsequent grip letter is emitted on the physical grip it now points at,
// exactly like a WCA / Sarah alg. This keeps the group mirror faithful across reholds —
// `y R y' R'` stays scrambled (the two R's hit different grips), where the old drop-the-
// rotations shortcut wrongly cancelled it to solved. Certified by the closed-loop engine
// test (mirror ⇔ engine) with rotations mixed in.
function parseFolded(text: string): CornerMove[] {
  let g2p: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6, 7];
  const out: CornerMove[] = [];
  for (const m of parseSkewbMoves(text)) {
    if (isSkewbRot(m)) { g2p = rotateGripMap(g2p, m.rot, m.dir); continue; }
    const phys = g2p[m.corner];
    out.push(phys === m.corner ? m : { ...m, corner: phys });
  }
  return out;
}

export const skewbPgBridge = makeCornerPgBridge<CornerMove>({
  pgName: 'skewb',
  cornerNames: CORNER_NAMES,
  parse: parseFolded,
  toString: skewbMovesToString,
});
