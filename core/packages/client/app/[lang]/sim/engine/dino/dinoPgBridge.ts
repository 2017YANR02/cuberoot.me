/**
 * Dino Cube ↔ PuzzleGeometry move bridge (PG name `dino`, a cube vertex-cut at 1/√3).
 * Shares the corner-turning factory with Skewb — see `../cornerPgBridge.ts` for the
 * letter-set match (engine corner ↔ PG shallow cap) and the chirality, both pinned by
 * the closed-loop probe.
 */
import { makeCornerPgBridge } from '../cornerPgBridge';
import { CORNER_NAMES, parseDinoMoves, dinoMovesToString, type DinoMove } from './dinoState';

export const dinoPgBridge = makeCornerPgBridge<DinoMove>({
  pgName: 'dino',
  cornerNames: CORNER_NAMES,
  parse: parseDinoMoves,
  toString: dinoMovesToString,
});
