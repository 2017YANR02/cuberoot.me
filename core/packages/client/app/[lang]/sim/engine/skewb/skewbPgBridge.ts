/**
 * Skewb ↔ PuzzleGeometry move bridge (PG name `skewb`, a cube vertex-cut through the
 * centre). Shares the corner-turning factory with Dino — see `../cornerPgBridge.ts`.
 * PG tracks both corner orbits (CORNERS + CORNERS2, each Z3) and the 6 centres; the
 * engine's 8 grips map to PG's 8 shallow corner caps by face-letter set.
 */
import { makeCornerPgBridge } from '../cornerPgBridge';
import { CORNER_NAMES, parseSkewbMoves, skewbMovesToString, type SkewbMove } from './skewbState';

export const skewbPgBridge = makeCornerPgBridge<SkewbMove>({
  pgName: 'skewb',
  cornerNames: CORNER_NAMES,
  parse: parseSkewbMoves,
  toString: skewbMovesToString,
});
