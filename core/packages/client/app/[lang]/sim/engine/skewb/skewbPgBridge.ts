/**
 * Skewb ↔ PuzzleGeometry move bridge (PG name `skewb`, a cube vertex-cut through the
 * centre). Shares the corner-turning factory with Dino — see `../cornerPgBridge.ts`.
 * PG tracks both corner orbits (CORNERS + CORNERS2, each Z3) and the 6 centres; the
 * engine's 8 grips map to PG's 8 shallow corner caps by face-letter set.
 */
import { makeCornerPgBridge } from '../cornerPgBridge';
import { CORNER_NAMES, parseSkewbMoves, skewbMovesToString, isSkewbRot } from './skewbState';
import type { CornerMove } from '../cornerNotation';

// PG tracks the fixed-in-space corner group; whole-cube rotations (x/y/z) reorient it
// without an exposed PG rotation op, so — as the old grip-only parser already did — we
// drop them here. The group-theory panel therefore ignores reorientations (rare outside
// Sarah algs; WCA scrambles have none); the engine renderer applies them for real.
export const skewbPgBridge = makeCornerPgBridge<CornerMove>({
  pgName: 'skewb',
  cornerNames: CORNER_NAMES,
  parse: (text) => parseSkewbMoves(text).filter((m): m is CornerMove => !isSkewbRot(m)),
  toString: skewbMovesToString,
});
