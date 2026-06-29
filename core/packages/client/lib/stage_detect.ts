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
import type { KPattern, KTransformation } from 'cubing/kpuzzle';
import { getCube3 } from './cube3';
import {
  EDGE_STICKERS, CORNER_STICKERS,
  edgeStickerOnFace, cornerStickerOnFace,
} from './sticker_tables';

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

// ── Geometry derived purely from the sticker tables (frame-independent) ──────
/** The 4 cross edges adjacent to each face (face index = CENTERS slot 0..5). */
const CROSS_EDGES_BY_FACE: number[][] = (() => {
  const out: number[][] = [];
  for (let f = 0; f < 6; f++) out.push(EDGE_STICKERS.flatMap((faces, e) => (faces.includes(f) ? [e] : [])));
  return out;
})();

interface SlotGeom { corner: number; edge: number; sides: [number, number]; }
/** For each face F: its 4 F2L slots (corner+edge home-piece ids) and the slot's
 *  two lateral faces (the non-F faces it touches). */
const F2L_SLOTS_BY_FACE: SlotGeom[][] = (() => {
  const out: SlotGeom[][] = [];
  for (let f = 0; f < 6; f++) {
    const slots: SlotGeom[] = [];
    for (let c = 0; c < 8; c++) {
      const cf = CORNER_STICKERS[c];
      if (!cf.includes(f)) continue;
      const sides = cf.filter(x => x !== f);
      const edge = EDGE_STICKERS.findIndex(ef => ef.includes(sides[0]) && ef.includes(sides[1]));
      slots.push({ corner: c, edge, sides: [sides[0], sides[1]] });
    }
    out.push(slots);
  }
  return out;
})();

/** Whole-cube rotation that brings each face onto D (face order U,R,F,L,B,D).
 *  Verified against cubing.js center tracking: R needs z' (not z) and L needs z
 *  (not z') — cubing.js's z sends R→U, so the naive z/z' assignment was swapped,
 *  which broke every R/L-colour (z/z' inspection) cross. */
const FACE_TO_D_ROT = ['x2', "z'", "x'", 'z', 'x', ''] as const;
/** Same-face quarter turn per face (for pseudo-cross alignment test). */
const FACE_MOVE = ['U', 'R', 'F', 'L', 'B', 'D'] as const;
/** Canonical lateral face-pair (sorted) → F2L slot id (F=2,R=1,B=4,L=3). */
const SIDES_TO_SLOT_ID: Record<string, F2lSlotId> = {
  '1,2': 'FR', '2,3': 'FL', '3,4': 'BL', '1,4': 'BR',
};
const slotIdForCanonicalSides = (a: number, b: number): F2lSlotId | null =>
  SIDES_TO_SLOT_ID[a < b ? `${a},${b}` : `${b},${a}`] ?? null;

export type Stage =
  | 'pscross'
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
   * Home-frame face index (0..5) of the working cross — equivalently the cross
   * COLOUR code (colour c's centre homes to face c). Frame-invariant. `5`
   * (yellow/D) for `solved`; the pscross/cross face otherwise.
   */
  crossFaceHome: number;
  /**
   * F2L slots that are solved. For cross/xcross/xxcross/xxxcross stages this
   * tells the caller WHICH slots got included beyond the bare cross.
   */
  solvedSlots: F2lSlotId[];
  /**
   * Frame-invariant identity of solved F2L pairs: `[cornerPieceId, edgePieceId]`.
   * Cubies are identified by their HOME slot (cubing.js piece numbering), so
   * this set survives canonical-frame shifts caused by user rotations between
   * lines (otherwise comparing solvedSlots across two patterns would falsely
   * report the same cubie as "newly solved" after a `y2` etc.).
   */
  solvedPairs: Array<[number, number]>;
  /** Cross (D-face) color in the normalised orientation. */
  crossColor?: { name: string; letter: string };
  /**
   * The most-recently-solved slot relative to the previous state. Only set
   * if a `prevStage` was provided to `detectStageProgress`.
   */
  newSlot?: F2lSlotId;
  /** That slot's color pair, e.g. `{ pair: 'GR', full: 'Green Red' }`. */
  newSlotColors?: { pair: string; full: string };
  /**
   * The pattern after bestOrientation has rotated it to canonical frame
   * (cross on D, max F2L visible). slot ids in `solvedSlots` reference
   * THIS pattern, not the raw input. Callers that want to do further
   * sticker-level analysis on the cube state should use this.
   */
  canonicalPattern: KPattern;
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

/** Color (= KPattern face index) shown by the center at face F. */
function centerColorAtFace(p: KPattern, face: number): number {
  return p.patternData.CENTERS.pieces[face];
}

/** True iff the edge at slot `s` shows the matching center colors on both
 *  of its visible faces (i.e., the edge "looks solved" at this slot). */
function edgeFaceSolved(p: KPattern, slot: number): boolean {
  const [fA, fB] = EDGE_STICKERS[slot];
  return edgeStickerOnFace(p, slot, fA) === centerColorAtFace(p, fA)
      && edgeStickerOnFace(p, slot, fB) === centerColorAtFace(p, fB);
}

/** True iff the corner at slot `s` shows matching colors on all 3 visible faces. */
function cornerFaceSolved(p: KPattern, slot: number): boolean {
  const [fA, fB, fC] = CORNER_STICKERS[slot];
  return cornerStickerOnFace(p, slot, fA) === centerColorAtFace(p, fA)
      && cornerStickerOnFace(p, slot, fB) === centerColorAtFace(p, fB)
      && cornerStickerOnFace(p, slot, fC) === centerColorAtFace(p, fC);
}

/**
 * Cross "solved on D" = all 4 D-edge slots (4,5,6,7) show D-color on D and
 * the matching side color on their side face. Sticker-color check, not piece
 * identity — so any rotation/scramble that visually presents a cross on D is
 * accepted (matches cubedb's lenient rule).
 */
function crossSolved(p: KPattern): boolean {
  return edgeFaceSolved(p, 4) && edgeFaceSolved(p, 5)
      && edgeFaceSolved(p, 6) && edgeFaceSolved(p, 7);
}

/**
 * Pseudo-cross: cross-solved-up-to-a-D-rotation. The 4 D-edges all show
 * D-color on the D-face but the side stickers are off by D / D' / D2 from
 * the centers. Common in solves where the user puts cross down without
 * aligning to centers (then fixes with a single D move later or absorbs
 * into F2L).
 */
function pscrossSolved(p: KPattern): boolean {
  if (crossSolved(p)) return false;
  for (const d of ['D', "D'", 'D2']) {
    if (crossSolved(p.applyAlg(d))) return true;
  }
  return false;
}

/**
 * Find a 24-orientation rotation that puts the cube's cross onto the D face.
 * For yellow-cross solves this matches `defaultCentersRotation`. For
 * color-neutral solves (white/red/etc. cross), centers will NOT be in default
 * order after this rotation — but the cross IS on D, which is what F2L /
 * fingerprint code requires.
 *
 * Falls back to `defaultCentersRotation` when no cross is solved (so callers
 * still get a sensible canonical pattern for stage='none' states).
 */
export async function crossOnDRotation(pattern: KPattern): Promise<string> {
  const r0 = await defaultCentersRotation(pattern);
  const home = r0 ? pattern.applyAlg(r0) : pattern;
  // Deterministic canonical frame: bring centers home, then rotate the cross
  // face onto D via the fixed FACE_TO_D_ROT. Piece-identity cross detection is
  // frame-invariant (works for every cross colour incl. L/R that z/z' produces),
  // and a fixed y alignment keeps per-AUF fingerprint lookups in step with the
  // DB. (The old "first frame whose sticker-cross looks solved" relied on the
  // sticker checker REJECTING tilted frames — it couldn't see L/R crosses at all
  // and let a y-rotated frame slip through, breaking the lookups.)
  let raw = r0;
  let found = false;
  for (let f = 0; f < 6; f++) {
    if (crossEdgesSolved(home, f)) { raw = [r0, FACE_TO_D_ROT[f]].filter(Boolean).join(' '); found = true; break; }
  }
  if (!found) {
    for (let f = 0; f < 6; f++) {
      const m = FACE_MOVE[f];
      if ([m, `${m}2`, `${m}'`].some(mv => crossEdgesSolved(home.applyAlg(mv), f))) {
        raw = [r0, FACE_TO_D_ROT[f]].filter(Boolean).join(' ');
        break;
      }
    }
  }
  // Canonicalise to the minimal equivalent rotation so suggestions don't carry
  // ugly compound prefixes (e.g. `x2 y x2`, which is just `y'` written long).
  if (!raw) return '';
  const kp = await getCube3();
  const solved = kp.defaultPattern();
  const min = await rotationBetween(solved, solved.applyAlg(raw));
  return min ?? raw;
}

/** F2L slot solved = its edge AND corner both look solved (sticker-wise). */
function slotSolved(p: KPattern, slot: typeof F2L_SLOT_DEFS[number]): boolean {
  return edgeFaceSolved(p, slot.edgeSlot) && cornerFaceSolved(p, slot.cornerSlot);
}

/** OLL solved = all 4 U-layer edges and corners show U-color on U face. */
function ollSolved(p: KPattern): boolean {
  const uColor = centerColorAtFace(p, 0);
  for (let slot = 0; slot < 4; slot++) {
    if (edgeStickerOnFace(p, slot, 0) !== uColor) return false;
    if (cornerStickerOnFace(p, slot, 0) !== uColor) return false;
  }
  return true;
}

/** Top-layer edges all show U-color on U face (EO of last layer is done). */
export function topEdgesOriented(p: KPattern): boolean {
  const uColor = centerColorAtFace(p, 0);
  for (let slot = 0; slot < 4; slot++) {
    if (edgeStickerOnFace(p, slot, 0) !== uColor) return false;
  }
  return true;
}

function colorsForSlot(p: KPattern, slotId: F2lSlotId): { pair: string; full: string } {
  // The slot's two visible side-face colors come from the centers it touches.
  // FR = R + F sides, FL = F + L, BL = L + B, BR = B + R. Use side center colors.
  const c = p.patternData.CENTERS.pieces;
  // Side center slots: 1=R, 2=F, 3=L, 4=B
  const sideColor = (slot: number) => {
    // Colour shown on physical face `slot`. cube3x3x3 CENTERS are SOURCE-indexed
    // (`pieces[k]` is the centre sitting at face k), so the colour on face `slot`
    // is `pieces[slot]` directly — correct in every orientation (centres are a
    // rigid rotation).
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

// ── Frame-invariant (piece-identity) detection ──────────────────────────────
// In the centers-solved frame a cubie is solved iff it's in its home slot with
// orientation 0 — pure piece+orientation equality, no sticker-orientation
// geometry. This reads correctly in ALL 24 orientations, unlike the sticker
// checkers above which only work in ~8 frames and can't see an L/R-colour cross
// (the red/orange cross a z/z' inspection produces).
const edgeHome = (p: KPattern, i: number): boolean =>
  p.patternData.EDGES.pieces[i] === i && (p.patternData.EDGES.orientation?.[i] ?? 0) === 0;
const cornerHome = (p: KPattern, i: number): boolean =>
  p.patternData.CORNERS.pieces[i] === i && (p.patternData.CORNERS.orientation?.[i] ?? 0) === 0;
const crossEdgesSolved = (p: KPattern, f: number): boolean =>
  CROSS_EDGES_BY_FACE[f].every(e => edgeHome(p, e));
const colorInfo = (face: number) => ({
  name: COLOR_BY_PIECE[face] ?? '?', letter: COLOR_LETTER_BY_PIECE[face] ?? '?',
});
/** Physical face → where it lands after a whole-cube rotation alg. */
async function facePermAfter(rotAlg: string): Promise<number[]> {
  if (!rotAlg) return [0, 1, 2, 3, 4, 5];
  const kp = await getCube3();
  const c = kp.defaultPattern().applyAlg(rotAlg).patternData.CENTERS.pieces;
  return [c[0], c[1], c[2], c[3], c[4], c[5]];
}

/**
 * Detect the highest-completion stage of the given pattern (the alg-applied
 * state). Returns stage + slot details + cross color name.
 *
 * Stages are computed in order: solved > oll > f2l > xxxcross > xxcross
 *  > xcross > cross > pscross > none. (PLL is classified downstream from the
 *  prev→curr stage transition, not here.)
 *
 * Detection runs in the centers-solved frame via pure piece identity, so it is
 * correct for every cube orientation and every cross colour. OLL reuses the
 * sticker checker in the cross-on-D canonical frame; now that the sticker
 * readers are frame-invariant it is accurate for every cross colour too
 * (including the L/R-colour cross a z/z' inspection produces).
 */
export async function detectStage(pattern: KPattern): Promise<StageInfo> {
  const r0 = await defaultCentersRotation(pattern);
  const home = r0 ? pattern.applyAlg(r0) : pattern;

  const allEdges = CROSS_EDGES_BY_FACE.length > 0
    && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every(i => edgeHome(home, i));
  const allCorners = [0, 1, 2, 3, 4, 5, 6, 7].every(i => cornerHome(home, i));
  if (allEdges && allCorners) {
    const allPairs = F2L_SLOT_DEFS.map(s => [s.cornerSlot, s.edgeSlot] as [number, number]);
    return { stage: 'solved', crossFaceHome: 5, solvedSlots: ['FR', 'FL', 'BL', 'BR'], solvedPairs: allPairs, crossColor: colorInfo(5), canonicalPattern: home };
  }

  // Pick the face whose cross is solved (preferring the one with the most F2L
  // pairs). For any partial solve exactly one face carries the working cross.
  let bestF = -1;
  let bestSlots: SlotGeom[] = [];
  for (let f = 0; f < 6; f++) {
    if (!crossEdgesSolved(home, f)) continue;
    const slots = F2L_SLOTS_BY_FACE[f].filter(sl => cornerHome(home, sl.corner) && edgeHome(home, sl.edge));
    if (bestF < 0 || slots.length > bestSlots.length) { bestF = f; bestSlots = slots; }
  }

  if (bestF < 0) {
    // Pseudo-cross: cross forms after a single same-face turn (mis-aligned to centers).
    for (let f = 0; f < 6; f++) {
      const m = FACE_MOVE[f];
      if ([m, `${m}2`, `${m}'`].some(mv => crossEdgesSolved(home.applyAlg(mv), f))) {
        const canonical = FACE_TO_D_ROT[f] ? home.applyAlg(FACE_TO_D_ROT[f]) : home;
        return { stage: 'pscross', crossFaceHome: f, solvedSlots: [], solvedPairs: [], crossColor: colorInfo(f), canonicalPattern: canonical };
      }
    }
    return { stage: 'none', crossFaceHome: 5, solvedSlots: [], solvedPairs: [], crossColor: colorInfo(5), canonicalPattern: home };
  }

  const rotToD = FACE_TO_D_ROT[bestF];
  const canonical = rotToD ? home.applyAlg(rotToD) : home;
  const crossColor = colorInfo(bestF);
  const pi = await facePermAfter(rotToD);
  const solvedSlots: F2lSlotId[] = [];
  const solvedPairs: Array<[number, number]> = [];
  for (const sl of bestSlots) {
    const id = slotIdForCanonicalSides(pi[sl.sides[0]], pi[sl.sides[1]]);
    if (id) solvedSlots.push(id);
    solvedPairs.push([sl.corner, sl.edge]);
  }

  if (bestSlots.length === 4) {
    if (ollSolved(canonical)) {
      return { stage: 'oll', crossFaceHome: bestF, solvedSlots, solvedPairs, crossColor, canonicalPattern: canonical };
    }
    return { stage: 'f2l', crossFaceHome: bestF, solvedSlots, solvedPairs, crossColor, canonicalPattern: canonical };
  }
  const stage: Stage = bestSlots.length === 3 ? 'xxxcross'
    : bestSlots.length === 2 ? 'xxcross'
    : bestSlots.length === 1 ? 'xcross' : 'cross';
  return { stage, crossFaceHome: bestF, solvedSlots, solvedPairs, crossColor, canonicalPattern: canonical };
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
    info.newSlotColors = colorsForSlot(info.canonicalPattern, newSlots[0]);
  }
  return info;
}

/** Convenience: detect stage from an alg string (applies to solved cube). */
export async function detectStageFromAlg(alg: string): Promise<StageInfo> {
  const kp = await getCube3();
  const p = alg ? kp.defaultPattern().applyAlg(alg) : kp.defaultPattern();
  return detectStage(p);
}

/**
 * Find the rotation alg (one of `ORIENTATION_ALGS`) that puts `pattern` into
 * canonical frame. The expensive 24-iteration is run once; callers can then
 * apply this rotation cheaply to other patterns (e.g. post-alg states during
 * scoring) without re-canonicalising.
 *
 * Assumes the cross color is stable across the calls (e.g. during F2L), so
 * the same rotation works for both pre and post states.
 */
export async function bestOrientationAlg(pattern: KPattern): Promise<string> {
  await getCube3();
  let bestRot = '';
  let bestScore = -Infinity;
  for (const rot of ORIENTATION_ALGS) {
    const t = rot ? pattern.applyAlg(rot) : pattern;
    let score = 0;
    if (crossSolved(t)) score += 100;
    else if (pscrossSolved(t)) score += 50;
    for (const s of F2L_SLOT_DEFS) {
      if (slotSolved(t, s)) score += 5;
    }
    if (score >= 100 && ollSolved(t)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestRot = rot;
    }
  }
  return bestRot;
}

/**
 * Find the cube rotation that puts CENTERS in default order
 * (U=0, R=1, F=2, L=3, B=4, D=5). Every valid 3×3 state's centers correspond
 * to exactly one of the 24 cube rotations, so this always succeeds for valid
 * inputs. For invalid/unreachable states, returns `""` as a fallback.
 *
 * Used for autofill canonicalisation: the F2L/OLL/PLL fingerprints are
 * color-based and assume default centers; a state with shifted centers
 * (from inspection rotations or slice/wide moves in earlier solve lines)
 * needs to be re-rotated to default centers before lookup.
 */
export async function defaultCentersRotation(pattern: KPattern): Promise<string> {
  await getCube3();
  for (const rot of ORIENTATION_ALGS) {
    const t = rot ? pattern.applyAlg(rot) : pattern;
    const c = t.patternData.CENTERS.pieces;
    if (c[0] === 0 && c[1] === 1 && c[2] === 2 && c[3] === 3 && c[4] === 4 && c[5] === 5) {
      return rot;
    }
  }
  return '';
}

// ── Fast frame-invariant primitives (for tight brute-force loops) ────────────
// The 24 orientation rotations as KTransformations (no per-call alg parsing).
let _orientTransforms: KTransformation[] | null = null;
async function orientTransforms(): Promise<KTransformation[]> {
  if (_orientTransforms) return _orientTransforms;
  const kp = await getCube3();
  _orientTransforms = ORIENTATION_ALGS.map(a => a ? kp.algToTransformation(a) : kp.identityTransformation());
  return _orientTransforms;
}

// Centers-arrangement → the rotation transformation that brings centers home.
// There are only 24 distinct arrangements, so this fills in O(1) after warmup.
const _centersTransformCache = new Map<string, KTransformation | null>();
/**
 * Like `defaultCentersRotation` but returns a cached KTransformation, so callers
 * normalising thousands of post-move patterns to the centres-home frame pay one
 * `applyTransformation` each (no alg re-parse, no 24-search). Returns null for
 * invalid/unreachable centre arrangements.
 */
export async function defaultCentersTransform(pattern: KPattern): Promise<KTransformation | null> {
  const key = pattern.patternData.CENTERS.pieces.join(',');
  const hit = _centersTransformCache.get(key);
  if (hit !== undefined) return hit;
  const ts = await orientTransforms();
  let found: KTransformation | null = null;
  for (const t of ts) {
    const c = pattern.applyTransformation(t).patternData.CENTERS.pieces;
    if (c[0] === 0 && c[1] === 1 && c[2] === 2 && c[3] === 3 && c[4] === 4 && c[5] === 5) { found = t; break; }
  }
  _centersTransformCache.set(key, found);
  return found;
}

/** Frame-invariant: home id of the cubie sitting at each F2L slot of cross face
 *  `f`, plus the slot's two lateral faces — re-exported geometry for callers. */
export { CROSS_EDGES_BY_FACE, F2L_SLOTS_BY_FACE, edgeHome, cornerHome };
export type { SlotGeom };

/** Deep sticker-level equality of two patterns (pieces + orientation across all orbits). */
function sameCells(a: KPattern, b: KPattern): boolean {
  const pa = a.patternData, pb = b.patternData;
  for (const orbit of ['EDGES', 'CORNERS', 'CENTERS'] as const) {
    const oa = pa[orbit], ob = pb[orbit];
    const n = oa.pieces.length;
    for (let i = 0; i < n; i++) {
      if (oa.pieces[i] !== ob.pieces[i]) return false;
      if ((oa.orientation?.[i] ?? 0) !== (ob.orientation?.[i] ?? 0)) return false;
    }
  }
  return true;
}

/**
 * Find the cube rotation alg (one of the 24 `ORIENTATION_ALGS`) `g` such that
 * `from.applyAlg(g)` is sticker-identical to `to`. Returns `''` when they're
 * already identical, or `null` if no single rotation relates them (i.e. they
 * differ by more than a whole-cube reorientation).
 *
 * Used by first-stage autofill: the rust-cross engine solves in a normalized
 * (white-top/green-front) frame, but the recon textarea applies moves after the
 * RAW scramble. Raw and normalized states differ by exactly one rotation `g`
 * (raw = norm·g), so a normalized-frame solution `S` maps to the recon frame as
 * `g⁻¹·S`.
 */
export async function rotationBetween(from: KPattern, to: KPattern): Promise<string | null> {
  await getCube3();
  for (const rot of ORIENTATION_ALGS) {
    const t = rot ? from.applyAlg(rot) : from;
    if (sameCells(t, to)) return rot;
  }
  return null;
}

/**
 * Like `bestOrientationAlg` but returns ONLY the x/z rotation part — the y
 * (AUF-axis) rotation is left for the caller to absorb via per-AUF lookup
 * entries. Used by OLL/PLL autofill so the suggested alg doesn't carry an
 * unnecessary `y` prefix when the user did a y inspection (the case lookup
 * table already stores all 4 AUF variants and matches the rotated state
 * directly).
 */
export async function bestTopRotationAlg(pattern: KPattern): Promise<string> {
  await getCube3();
  const TOPS = ['', 'x', 'x2', "x'", 'z', "z'"];
  const YS = ['', 'y', 'y2', "y'"];
  let bestRot = '';
  let bestScore = -Infinity;
  for (const top of TOPS) {
    const tTop = top ? pattern.applyAlg(top) : pattern;
    let maxScore = 0;
    for (const y of YS) {
      const ty = y ? tTop.applyAlg(y) : tTop;
      let s = 0;
      if (crossSolved(ty)) s += 100;
      for (const slot of F2L_SLOT_DEFS) {
        if (slotSolved(ty, slot)) s += 5;
      }
      if (s > maxScore) maxScore = s;
    }
    if (maxScore > bestScore) {
      bestScore = maxScore;
      bestRot = top;
    }
  }
  return bestRot;
}

/**
 * Quickly evaluate the F2L slot status of a pattern that's already in
 * canonical frame (or rotated into it via a known rotation). Skips the
 * 24-iteration of `bestOrientation`. For use in tight loops where the
 * canonical rotation has been pre-computed.
 */
export function evaluateCanonical(canonicalPattern: KPattern): { crossOk: boolean; solvedSlots: F2lSlotId[] } {
  const crossOk = crossSolved(canonicalPattern);
  const solvedSlots: F2lSlotId[] = [];
  if (crossOk) {
    for (const s of F2L_SLOT_DEFS) {
      if (slotSolved(canonicalPattern, s)) solvedSlots.push(s.id);
    }
  }
  return { crossOk, solvedSlots };
}
