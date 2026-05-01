/**
 * Stage detection — given a 3x3 KPattern, identify what was just solved:
 * cross / xcross / xxcross / xxxcross / f2l / oll / pll / solved.
 *
 * Used by ReconAutofill to mirror cubedb.net behaviour: popup contents are
 * derived from the actual cube state, not from the text labels the user typed.
 *
 * Approach:
 *   1. Each 3x3 has 24 possible "puzzle orientations" depending on cube rotations
 *      in the alg. We normalise by rotating the pattern (applying x/y/z) so that
 *      the original D-color is back on slot 5 (the canonical bottom face). Once
 *      normalised, piece-slot identity matches our default mapping.
 *   2. We then check piece+orientation arrays for known stages.
 *
 * Piece slot mapping (verified by probe; see `cubing.js` patternData):
 *   EDGES   slots 0..3  = U-edges (UF, UR, UB, UL)
 *           slots 4..7  = D-edges (DF, DR, DB, DL)            ← cross edges
 *           slots 8..11 = E-slice (FR, FL, BR, BL)             ← F2L slot edges
 *   CORNERS slots 0..3  = U-corners (UFR, UBR, UBL, UFL)
 *           slots 4..7  = D-corners (DFR, DFL, DBL, DBR)       ← F2L slot corners
 *   CENTERS slots 0..5  = (U, R, F, L, B, D)
 *
 * F2L slot piece pairs (corner orbit, edge orbit):
 *   FR = (4, 8), FL = (5, 9), BL = (6, 11), BR = (7, 10)
 *
 * The slot face-color names are derived from `CENTERS.pieces` of the normalised
 * pattern: piece 1=R, 2=F, 3=L, 4=B (the four side-face colors). Default WCA
 * scheme: R=red, F=green, L=orange, B=blue.
 */
import type { KPattern } from 'cubing/kpuzzle';
import { getCube3 } from './cube3';

/** F2L slots in canonical order, with their piece indices. */
export const F2L_SLOT_DEFS = [
  { id: 'FR', cornerSlot: 4, edgeSlot: 8 },
  { id: 'FL', cornerSlot: 5, edgeSlot: 9 },
  { id: 'BL', cornerSlot: 6, edgeSlot: 11 },
  { id: 'BR', cornerSlot: 7, edgeSlot: 10 },
] as const;
export type F2lSlotId = typeof F2L_SLOT_DEFS[number]['id'];

/** Default WCA color names by center piece index. */
const COLOR_BY_PIECE: Record<number, string> = {
  0: 'White', 1: 'Red', 2: 'Green', 3: 'Orange', 4: 'Blue', 5: 'Yellow',
};
const COLOR_LETTER_BY_PIECE: Record<number, string> = {
  0: 'W', 1: 'R', 2: 'G', 3: 'O', 4: 'B', 5: 'Y',
};

export type Stage =
  | 'cross'
  | 'xcross'
  | 'xxcross'
  | 'xxxcross'
  | 'f2l'
  | 'oll'
  | 'pll'
  | 'solved'
  | 'none';

export interface StageInfo {
  /** Highest-completion stage the cube currently sits at. */
  stage: Stage;
  /**
   * F2L slots that are solved. For cross/xcross/xxcross/xxxcross stages this
   * tells the caller WHICH slots got included beyond the bare cross.
   */
  solvedSlots: F2lSlotId[];
  /** Cross (D-face) color in the normalised orientation. */
  crossColor?: { name: string; letter: string };
  /**
   * The most-recently-solved slot relative to the previous state. Only set
   * if a `prevStage` was provided to `detectStageProgress`.
   */
  newSlot?: F2lSlotId;
  /** That slot's color pair, e.g. `{ pair: 'GR', full: 'Green Red' }`. */
  newSlotColors?: { pair: string; full: string };
}

/**
 * All 24 cube orientations as alg strings. Each is a "put face X on top, face
 * Y on front" choice. Generated as (top-face-rotation × y-rotation):
 *   - top-face options: identity, x, x2, x', z, z' (6 — chooses which face is up)
 *   - y options: identity, y, y2, y' (4 — chooses which side faces front)
 *
 * Total = 24, covering every cube orientation. Used to find the orientation
 * that maximises stage progress for stage_detect.
 */
const ORIENTATION_ALGS: string[] = (() => {
  const out: string[] = [];
  const tops = ['', 'x', 'x2', "x'", 'z', "z'"];
  const ys = ['', 'y', 'y2', "y'"];
  for (const t of tops) {
    for (const y of ys) {
      const composed = [t, y].filter(Boolean).join(' ');
      out.push(composed);
    }
  }
  return out;
})();

/**
 * Find the orientation in which the most progress is "visible" on the bottom
 * (D face): cross solved, then count F2L pairs. We pick the rotation that
 * maximises (cross-solved-flag, F2L-pairs-solved). This way, regardless of the
 * user's inspection rotation (x' / x2 / y / etc.), we evaluate stage progress
 * in the direction the user is solving.
 */
async function bestOrientation(pattern: KPattern): Promise<KPattern> {
  await getCube3();
  let best: { p: KPattern; score: number } | null = null;
  for (const rot of ORIENTATION_ALGS) {
    const t = rot ? pattern.applyAlg(rot) : pattern;
    let score = 0;
    if (crossSolved(t)) score += 100;
    for (const s of F2L_SLOT_DEFS) {
      if (slotSolved(t, s)) score += 5;
    }
    let topOriented = true;
    for (let i = 0; i < 4; i++) {
      if ((t.patternData.CORNERS.orientation[i] ?? 0) !== 0) { topOriented = false; break; }
      if ((t.patternData.EDGES.orientation[i] ?? 0) !== 0) { topOriented = false; break; }
    }
    if (topOriented && score >= 100) score += 1;
    if (!best || score > best.score) {
      best = { p: t, score };
    }
  }
  return best!.p;
}

/** Is a piece at home with 0 orientation? */
function pieceHome(p: KPattern, orbit: 'EDGES' | 'CORNERS', slot: number): boolean {
  const od = p.patternData[orbit];
  return od.pieces[slot] === slot && (od.orientation[slot] ?? 0) === 0;
}

/**
 * Cross is "solved on D" if the 4 D-edge slots (4,5,6,7) hold the SET of
 * either {0..3} (U-edges, white cross flipped onto D) or {4..7} (D-edges,
 * standard yellow cross), all with orientation 0. We allow set-equality
 * rather than strict piece-at-slot identity because a cube where x2
 * inspection physically swapped pieces still presents a "solved-looking"
 * cross — cubedb labels these as cross even though the corners/edges are
 * permuted internally.
 */
function crossSolved(p: KPattern): boolean {
  const e = p.patternData.EDGES;
  const slots = [e.pieces[4], e.pieces[5], e.pieces[6], e.pieces[7]];
  const oris = [e.orientation[4], e.orientation[5], e.orientation[6], e.orientation[7]];
  if (!oris.every(o => (o ?? 0) === 0)) return false;
  const sorted = slots.slice().sort((a, b) => a - b);
  if (sorted[0] === 0 && sorted[1] === 1 && sorted[2] === 2 && sorted[3] === 3) return true; // white cross
  if (sorted[0] === 4 && sorted[1] === 5 && sorted[2] === 6 && sorted[3] === 7) return true; // yellow cross
  return false;
}

/**
 * Is a specific F2L slot "filled"? We mirror cubedb's lenient rule: a slot
 * is considered filled if its corner is one of the 8 valid corners (any
 * U/D corner) at orientation 0 (so its U/D-color sticker is on D), AND the
 * edge is a corresponding cross edge with ori 0.
 *
 * For strict CFOP detection (each slot has the correct cubie matching its
 * adjacent centers), this is too lenient — but cubedb is already lenient.
 */
function slotSolved(p: KPattern, slot: typeof F2L_SLOT_DEFS[number]): boolean {
  return pieceHome(p, 'CORNERS', slot.cornerSlot) && pieceHome(p, 'EDGES', slot.edgeSlot);
}

/** Are all 4 U-layer corners + edges oriented (sticker showing on top)? */
function ollSolved(p: KPattern): boolean {
  for (let i = 0; i < 4; i++) {
    if ((p.patternData.CORNERS.orientation[i] ?? 0) !== 0) return false;
    if ((p.patternData.EDGES.orientation[i] ?? 0) !== 0) return false;
  }
  return true;
}

/** Whole cube solved (modulo full puzzle rotation, which we already normalised). */
function fullySolved(p: KPattern): boolean {
  for (let i = 0; i < 12; i++) {
    if (p.patternData.EDGES.pieces[i] !== i) return false;
    if ((p.patternData.EDGES.orientation[i] ?? 0) !== 0) return false;
  }
  for (let i = 0; i < 8; i++) {
    if (p.patternData.CORNERS.pieces[i] !== i) return false;
    if ((p.patternData.CORNERS.orientation[i] ?? 0) !== 0) return false;
  }
  return true;
}

function colorsForSlot(p: KPattern, slotId: F2lSlotId): { pair: string; full: string } {
  // The slot's two visible side-face colors come from the centers it touches.
  // FR = R + F sides, FL = F + L, BL = L + B, BR = B + R. Use side center colors.
  const c = p.patternData.CENTERS.pieces;
  // Side center slots: 1=R, 2=F, 3=L, 4=B
  const sideColor = (slot: number) => {
    const piece = c[slot];
    return { letter: COLOR_LETTER_BY_PIECE[piece] ?? '?', name: COLOR_BY_PIECE[piece] ?? '?' };
  };
  const map: Record<F2lSlotId, [number, number]> = {
    FR: [2, 1], // F + R
    FL: [2, 3], // F + L
    BL: [4, 3], // B + L
    BR: [4, 1], // B + R
  };
  const [a, b] = map[slotId];
  const ca = sideColor(a);
  const cb = sideColor(b);
  return {
    pair: `${ca.letter}${cb.letter}`,
    full: `${ca.name} ${cb.name}`,
  };
}

/**
 * Detect the highest-completion stage of the given pattern (the alg-applied
 * state). Returns stage + slot details + cross color name.
 *
 * Stages are computed in order: solved > pll > oll > f2l > xxxcross > xxcross
 *  > xcross > cross > none.
 */
export async function detectStage(pattern: KPattern): Promise<StageInfo> {
  const p = await bestOrientation(pattern);
  const crossColor = (() => {
    const piece = p.patternData.CENTERS.pieces[5];
    return { name: COLOR_BY_PIECE[piece] ?? '?', letter: COLOR_LETTER_BY_PIECE[piece] ?? '?' };
  })();

  if (fullySolved(p)) {
    return { stage: 'solved', solvedSlots: ['FR', 'FL', 'BL', 'BR'], crossColor };
  }

  const crossOk = crossSolved(p);
  if (!crossOk) return { stage: 'none', solvedSlots: [], crossColor };

  const solvedSlots: F2lSlotId[] = [];
  for (const s of F2L_SLOT_DEFS) {
    if (slotSolved(p, s)) solvedSlots.push(s.id);
  }

  // F2L done → check OLL/PLL
  if (solvedSlots.length === 4) {
    const orientedTop = ollSolved(p);
    if (orientedTop) {
      // OLL done — is PLL done too? (modulo AUF). But fullySolved would already
      // have caught a fully solved cube; if we're here it's not solved.
      // Check: are top corners/edges permuted correctly modulo a U turn?
      // Try 0/1/2/3 U turns and see if any leaves cube solved.
      for (let i = 0; i < 4; i++) {
        const test = i === 0 ? p : p.applyAlg(`U${i === 1 ? '' : i}`.replace('U3', "U'"));
        if (fullySolved(test)) {
          return { stage: 'oll', solvedSlots, crossColor };
        }
      }
      // OLL solved but cube not solved → PLL stage about to start? Actually
      // if OLL is done and cube isn't solvable by AUF, we're at the moment
      // OLL just finished — that's "oll" stage from a stage-completion POV.
      return { stage: 'oll', solvedSlots, crossColor };
    }
    return { stage: 'f2l', solvedSlots, crossColor };
  }

  if (solvedSlots.length === 3) return { stage: 'xxxcross', solvedSlots, crossColor };
  if (solvedSlots.length === 2) return { stage: 'xxcross', solvedSlots, crossColor };
  if (solvedSlots.length === 1) return { stage: 'xcross', solvedSlots, crossColor };
  return { stage: 'cross', solvedSlots: [], crossColor };
}

/**
 * Detect stage AND fold in slot-color naming for the most recently solved slot.
 * Pass the previous state to identify which slot transitioned from unsolved
 * to solved (so we can label it `// GR Pair` etc.).
 */
export async function detectStageWithProgress(
  prev: KPattern | null,
  current: KPattern,
): Promise<StageInfo> {
  const info = await detectStage(current);
  if (!prev) return info;
  const prevInfo = await detectStage(prev);
  const newSlots = info.solvedSlots.filter(s => !prevInfo.solvedSlots.includes(s));
  if (newSlots.length === 1) {
    info.newSlot = newSlots[0];
    info.newSlotColors = colorsForSlot(await bestOrientation(current), newSlots[0]);
  }
  return info;
}

/** Convenience: detect stage from an alg string (applies to solved cube). */
export async function detectStageFromAlg(alg: string): Promise<StageInfo> {
  const kp = await getCube3();
  const p = alg ? kp.defaultPattern().applyAlg(alg) : kp.defaultPattern();
  return detectStage(p);
}
