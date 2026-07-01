/**
 * Redi Cube ↔ PuzzleGeometry move bridge (PG name `compy cube`, a cube vertex-cut at
 * ~0.9156 — the Redi/Compy shell). Shares the corner-turning factory with Dino/Skewb
 * (see `../cornerPgBridge.ts`): the engine's 8 corner twists map to PG's 8 shallow
 * single-corner caps by face-letter set, chirality pinned as engine dir+1 = PG inverse.
 *
 * Redi's own CORNER_NAMES are single letters (F L B R f l b r) which won't letter-set-
 * match; we pass the 3-face names in redi corner INDEX order instead (rediState
 * CORNER_AXIS: 0 UFR · 1 UFL · 2 UBL · 3 UBR · 4 DFR · 5 DFL · 6 DBL · 7 DBR).
 *
 * `factsOverEngineGens` — PG's compy cut also exposes 4 deep 2-layer slices (`2DRF`, …)
 * on top of the 8 shallow corner caps; those reorient the whole cube (permute centers)
 * and inflate |G| 12× to 1.886×10¹³. Over the 8 real corner twists alone you get the
 * physical Redi group 12!/2·3⁸ = 1,571,364,748,800 with a clean integer constraint index
 * — the same deep-slice pollution fix as megaminx / FTO.
 */
import { makeCornerPgBridge } from '../cornerPgBridge';
import type { MoveBridge } from '../pgBinding';
import { parseRediMoves, rediMovesToString, type RediMove } from './rediState';

const CORNER_3FACE = ['UFR', 'UFL', 'UBL', 'UBR', 'DFR', 'DFL', 'DBL', 'DBR'] as const;

export const rediPgBridge: MoveBridge<RediMove> = {
  ...makeCornerPgBridge<RediMove>({
    pgName: 'compy cube',
    cornerNames: CORNER_3FACE,
    parse: parseRediMoves,
    toString: rediMovesToString,
  }),
  factsOverEngineGens: true,
  factsMoveNames: CORNER_3FACE,
};
