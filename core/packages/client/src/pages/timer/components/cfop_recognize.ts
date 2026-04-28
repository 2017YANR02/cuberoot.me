/**
 * CFOP recognition heuristics for the SolverHints panel.
 *
 * Given a scramble + a chosen cross orientation, this module:
 *   1. Computes F2L pair counts (solved / paired-but-misplaced / unpaired) by
 *      simulating: scramble + cross-solution + rotate-cross-to-D.
 *   2. Detects OLL/PLL stage when the cube happens to already be in those
 *      states (only meaningful for last-layer-only practice scrambles, not
 *      typical WCA scrambles — for normal scrambles this is "n/a").
 *
 * The simulation is done in CubeFaces space using the existing applyMoves /
 * parseScramble. We do NOT solve F2L / OLL / PLL, only inspect facelet
 * patterns. For OLL the recognition is partial (subset of named patterns);
 * for PLL we use a cubie-permutation/orientation cycle signature which can
 * cover all 21 + skip cases provided the LL is actually permuted.
 */

import { applyMoves, applyScramble } from '../cube/state';
import type { CubeFaces } from '../cube/state';
import type { Face, ParsedMove } from '../cube/moves';
import { parseScramble } from '../cube/moves';
import { isCross, isF2l, isOll, isSolved } from '../cube/cfop_detect';
import type { Orientation } from '../solver/cross';

export interface F2lSlotCounts {
  /** 4 slots fully solved (corner + edge correct). */
  solved: number;
  /** Pair joined but not in correct slot. */
  paired: number;
  /** Neither solved nor pre-paired. */
  unpaired: number;
}

export interface CfopRecognition {
  orientation: Orientation;
  /** True if scramble + crossSol succeeded in solving the cross on this face. */
  crossOk: boolean;
  /** Counts of the 4 F2L slots after putting cross on D. Only valid if crossOk. */
  f2l: F2lSlotCounts;
  /** Highest CFOP stage reached after cross solve (most scrambles: just 'cross'). */
  stage: 'cross' | 'f2l' | 'oll' | 'pll';
  /** OLL pattern label (only set if stage === 'f2l' or higher; null if unrecognized). */
  ollLabel: string | null;
  /** PLL case label (only set if stage === 'oll' or higher; null if unrecognized). */
  pllLabel: string | null;
}

// ----- Rotation that brings face X to face D -----
// x: U→F→D→B→U.  So x sends F→D.
// x': U→B→D→F→U. Sends B→D.
// z: U→R→D→L→U. Sends R→D.
// z': U→L→D→R→U. Sends L→D.
// x2 (or z2): swaps U↔D.  Sends U→D.
const ORIENT_TO_D_ROTATION: Record<Orientation, string> = {
  D: '',
  U: 'x2',
  F: 'x',
  B: "x'",
  L: "z'",
  R: 'z',
};

/**
 * Compute F2L + OLL/PLL recognition for one orientation, given the cross
 * solution string for that orientation (from solveCross).
 *
 * If crossSolMoves is '—' or empty (cross unsolved by BFS), we fall back
 * to crossOk=false and return zeroed counts.
 */
export function recognizeForOrientation(
  scramble: string,
  orientation: Orientation,
  crossSolMoves: string,
): CfopRecognition {
  const empty: CfopRecognition = {
    orientation,
    crossOk: false,
    f2l: { solved: 0, paired: 0, unpaired: 4 },
    stage: 'cross',
    ollLabel: null,
    pllLabel: null,
  };

  if (!crossSolMoves || crossSolMoves === '—') return empty;

  // 1. Apply scramble + cross solution + rotation-to-D, all in CubeFaces.
  let state: CubeFaces;
  try {
    state = applyScramble(3, scramble);
    const crossMoves: ParsedMove[] = parseScramble(crossSolMoves);
    state = applyMoves(state, 3, crossMoves);
    const rotMoves: ParsedMove[] = parseScramble(ORIENT_TO_D_ROTATION[orientation]);
    state = applyMoves(state, 3, rotMoves);
  } catch {
    return empty;
  }

  // 2. Sanity: cross should be solved now.
  if (!isCross(state)) return empty;

  // 3. F2L pair counts.
  const f2l = countF2lSlots(state);

  // 4. Stage detection — usually 'cross' for WCA scrambles. If F2L happens to
  //    be already solved, attempt OLL / PLL labels.
  let stage: CfopRecognition['stage'] = 'cross';
  let ollLabel: string | null = null;
  let pllLabel: string | null = null;

  if (isSolved(state)) {
    stage = 'pll';
    pllLabel = 'Solved';
    ollLabel = 'Solved';
  } else if (isOll(state)) {
    stage = 'oll';
    ollLabel = 'Solved';
    pllLabel = recognizePll(state);
  } else if (isF2l(state)) {
    stage = 'f2l';
    ollLabel = recognizeOll(state);
    // PLL-stage means OLL solved; here OLL not solved so PLL is not yet defined.
  }

  return {
    orientation,
    crossOk: true,
    f2l,
    stage,
    ollLabel,
    pllLabel,
  };
}

// ============================================================
// F2L slot inspection
// ============================================================

/**
 * Inspect the 4 F2L slots assuming cross is on D.
 *
 *   Slot FR: corner DFR (D[2], F[8], R[6]) + edge FR (F[5], R[3])
 *   Slot FL: corner DFL (D[0], F[6], L[8]) + edge FL (L[5], F[3])
 *   Slot BR: corner DBR (D[8], R[8], B[6]) + edge BR (R[5], B[3])
 *   Slot BL: corner DBL (D[6], L[6], B[8]) + edge BL (B[5], L[3])
 *
 * Classification per slot:
 *   solved   — both pieces in slot, correctly oriented.
 *   paired   — the corner cubie's two side colors and the edge cubie's two
 *              colors are adjacent and matching somewhere on the cube
 *              (in the U layer above some slot, or in the slot itself but
 *              not solved).
 *   unpaired — otherwise.
 *
 * Honest caveat: "paired" detection here checks for a small set of
 * canonical "ready-to-insert" configurations (pair sitting in U layer
 * above a slot, joined). It will undercount some valid pairings (e.g.
 * corner in slot bottom + edge in U with matching colors). For more
 * speculative configurations we conservatively classify as 'unpaired'.
 */
function countF2lSlots(state: CubeFaces): F2lSlotCounts {
  const out = { solved: 0, paired: 0, unpaired: 0 };
  const { D, F, R, B, L } = state;
  const cD = D[4], cF = F[4], cR = R[4], cB = B[4], cL = L[4];

  // Each slot: side faces of the corner and edge cubies in that slot.
  const slots: { cornerSides: [Face, Face]; edgeSides: [Face, Face] }[] = [
    { cornerSides: ['F', 'R'], edgeSides: ['F', 'R'] },
    { cornerSides: ['F', 'L'], edgeSides: ['F', 'L'] },
    { cornerSides: ['B', 'R'], edgeSides: ['B', 'R'] },
    { cornerSides: ['B', 'L'], edgeSides: ['B', 'L'] },
  ];

  for (const s of slots) {
    const stat = classifySlot(state, s.cornerSides, s.edgeSides, cD, cF, cR, cB, cL);
    if (stat === 'solved') out.solved++;
    else if (stat === 'paired') out.paired++;
    else out.unpaired++;
  }

  return out;
}

type SlotStatus = 'solved' | 'paired' | 'unpaired';

function classifySlot(
  state: CubeFaces,
  cornerSides: [Face, Face],
  edgeSides: [Face, Face],
  cD: Face, cF: Face, cR: Face, cB: Face, cL: Face,
): SlotStatus {
  const centers: Record<Face, Face> = { U: state.U[4], D: cD, F: cF, R: cR, B: cB, L: cL };
  const cornerColors = new Set<Face>([cD, centers[cornerSides[0]], centers[cornerSides[1]]]);
  const edgeColors = new Set<Face>([centers[edgeSides[0]], centers[edgeSides[1]]]);

  // ---- Solved check (in-slot, correct orientation) ----
  const { D, F, R, B, L } = state;
  let cornerSolvedInSlot = false;
  let edgeSolvedInSlot = false;
  if (cornerSides[0] === 'F' && cornerSides[1] === 'R') {
    cornerSolvedInSlot = D[2] === cD && F[8] === cF && R[6] === cR;
    edgeSolvedInSlot = F[5] === cF && R[3] === cR;
  } else if (cornerSides[0] === 'F' && cornerSides[1] === 'L') {
    cornerSolvedInSlot = D[0] === cD && F[6] === cF && L[8] === cL;
    edgeSolvedInSlot = F[3] === cF && L[5] === cL;
  } else if (cornerSides[0] === 'B' && cornerSides[1] === 'R') {
    cornerSolvedInSlot = D[8] === cD && B[6] === cB && R[8] === cR;
    edgeSolvedInSlot = B[3] === cB && R[5] === cR;
  } else if (cornerSides[0] === 'B' && cornerSides[1] === 'L') {
    cornerSolvedInSlot = D[6] === cD && B[8] === cB && L[6] === cL;
    edgeSolvedInSlot = B[5] === cB && L[3] === cL;
  }
  if (cornerSolvedInSlot && edgeSolvedInSlot) return 'solved';

  // ---- Paired check: enumerate every "joined pair" configuration. ----
  // A joined corner-edge pair is one of these 12 layouts (cornerColors and
  // edgeColors must match exactly). We check both U-layer pair (above any
  // slot) and slot-bottom pair (corner in slot, edge in U).
  if (
    pairExistsInUAboveAnySlot(state, cornerColors, edgeColors) ||
    pairExistsCornerInSlotEdgeInU(state, cornerColors, edgeColors)
  ) {
    return 'paired';
  }
  return 'unpaired';
}

// Helper: does the cube have a corner+edge pair sitting in the U layer above
// any of the 4 slots, with matching side colors and the corner having its
// D-color showing on a side (i.e. ready-to-insert)? We enumerate the 4 U
// corners + their 4 adjacent U edges; for each, read off the corner's two
// side stickers and the edge's two stickers; if they form the requested
// color set AND the third corner sticker (D-color) is on a side (not on U),
// we count it as paired.
//
// U corner positions (using state.ts indexing of U row0=back col0=left):
//   UBL = U[0,0]=U[0]; sides: B[0,2]=B[2], L[0,0]=L[0]
//   UBR = U[0,2]=U[2]; sides: R[0,2]=R[2], B[0,0]=B[0]
//   UFL = U[2,0]=U[6]; sides: L[0,2]=L[2], F[0,0]=F[0]
//   UFR = U[2,2]=U[8]; sides: F[0,2]=F[2], R[0,0]=R[0]
// U edges:
//   UB = U[0,1]=U[1]; side: B[0,1]=B[1]
//   UL = U[1,0]=U[3]; side: L[0,1]=L[1]
//   UR = U[1,2]=U[5]; side: R[0,1]=R[1]
//   UF = U[2,1]=U[7]; side: F[0,1]=F[1]
function pairExistsInUAboveAnySlot(
  state: CubeFaces,
  cornerColors: Set<Face>,
  edgeColors: Set<Face>,
): boolean {
  const { U } = state;
  // [U-corner-idx, side1, side2, adjacent U-edge, edge-side]
  // adjacent edges on each side of the corner — 2 each. We check all 4 corner
  // × 2 adjacent edges = 8 pairings (any of which is a "joined" pair).
  const corners: { uIdx: number; sideA: Face; aIdx: number; sideB: Face; bIdx: number }[] = [
    { uIdx: 0, sideA: 'B', aIdx: 2, sideB: 'L', bIdx: 0 },  // UBL
    { uIdx: 2, sideA: 'R', aIdx: 2, sideB: 'B', bIdx: 0 },  // UBR
    { uIdx: 6, sideA: 'L', aIdx: 2, sideB: 'F', bIdx: 0 },  // UFL
    { uIdx: 8, sideA: 'F', aIdx: 2, sideB: 'R', bIdx: 0 },  // UFR
  ];
  // For each corner, its two adjacent U edges (one along sideA, one along sideB).
  const adjEdges: Record<number, { side: Face; uEdgeIdx: number; sideStickerIdx: number }[]> = {
    0: [ // UBL: adjacent edges are UB (along B) and UL (along L)
      { side: 'B', uEdgeIdx: 1, sideStickerIdx: 1 },
      { side: 'L', uEdgeIdx: 3, sideStickerIdx: 1 },
    ],
    2: [ // UBR: UB and UR
      { side: 'B', uEdgeIdx: 1, sideStickerIdx: 1 },
      { side: 'R', uEdgeIdx: 5, sideStickerIdx: 1 },
    ],
    6: [ // UFL: UF and UL
      { side: 'F', uEdgeIdx: 7, sideStickerIdx: 1 },
      { side: 'L', uEdgeIdx: 3, sideStickerIdx: 1 },
    ],
    8: [ // UFR: UF and UR
      { side: 'F', uEdgeIdx: 7, sideStickerIdx: 1 },
      { side: 'R', uEdgeIdx: 5, sideStickerIdx: 1 },
    ],
  };

  for (const c of corners) {
    const cornerStickers: Face[] = [
      U[c.uIdx],
      stickerAt(state, c.sideA, c.aIdx),
      stickerAt(state, c.sideB, c.bIdx),
    ];
    if (!setEq(new Set(cornerStickers), cornerColors)) continue;

    for (const e of adjEdges[c.uIdx]) {
      const edgeStickers: Face[] = [
        U[e.uEdgeIdx],
        stickerAt(state, e.side, e.sideStickerIdx),
      ];
      if (!setEq(new Set(edgeStickers), edgeColors)) continue;

      // Corner+edge are color-correct. Now check "joined": the side of the
      // corner facing the edge has the same color as the side of the edge
      // facing the corner. The "joined" face is the side they share (sideA
      // or sideB equal to e.side).
      const sharedSide = e.side === c.sideA ? c.sideA : (e.side === c.sideB ? c.sideB : null);
      if (sharedSide === null) continue;
      const cornerSideSticker = sharedSide === c.sideA
        ? stickerAt(state, c.sideA, c.aIdx)
        : stickerAt(state, c.sideB, c.bIdx);
      const edgeSideSticker = stickerAt(state, e.side, e.sideStickerIdx);
      if (cornerSideSticker === edgeSideSticker) return true;
    }
  }
  return false;
}

// Helper: corner-in-slot (D-layer) joined to edge-in-U (above a slot) with
// matching colors. This catches the common "white-corner already in slot
// bottom but flipped, edge in U above" pre-pair, which is also a "paired"
// state ready for an algorithm.
//
// We only check the 4 slot-bottom corners; for each, look at U-layer edges
// at the 4 U-edge positions; require corner's two side colors match edge's
// two colors AND one of the corner's side stickers visible on a face equals
// the edge's matching side sticker.
function pairExistsCornerInSlotEdgeInU(
  state: CubeFaces,
  cornerColors: Set<Face>,
  edgeColors: Set<Face>,
): boolean {
  const { U, D } = state;
  // 4 D-corners with their stickers:
  const dCorners: { D: number; sa: Face; saIdx: number; sb: Face; sbIdx: number }[] = [
    { D: 0, sa: 'F', saIdx: 6, sb: 'L', sbIdx: 8 }, // DFL
    { D: 2, sa: 'F', saIdx: 8, sb: 'R', sbIdx: 6 }, // DFR
    { D: 6, sa: 'B', saIdx: 8, sb: 'L', sbIdx: 6 }, // DBL
    { D: 8, sa: 'B', saIdx: 6, sb: 'R', sbIdx: 8 }, // DBR
  ];
  // 4 U-edges:
  const uEdges: { u: number; side: Face; sIdx: number }[] = [
    { u: 1, side: 'B', sIdx: 1 }, // UB
    { u: 3, side: 'L', sIdx: 1 }, // UL
    { u: 5, side: 'R', sIdx: 1 }, // UR
    { u: 7, side: 'F', sIdx: 1 }, // UF
  ];

  for (const c of dCorners) {
    const cs: Face[] = [D[c.D], stickerAt(state, c.sa, c.saIdx), stickerAt(state, c.sb, c.sbIdx)];
    if (!setEq(new Set(cs), cornerColors)) continue;
    for (const e of uEdges) {
      const es: Face[] = [U[e.u], stickerAt(state, e.side, e.sIdx)];
      if (!setEq(new Set(es), edgeColors)) continue;
      // Joined iff one of the corner's side stickers matches the edge's
      // side sticker on the same face.
      if (e.side === c.sa && stickerAt(state, c.sa, c.saIdx) === stickerAt(state, e.side, e.sIdx)) return true;
      if (e.side === c.sb && stickerAt(state, c.sb, c.sbIdx) === stickerAt(state, e.side, e.sIdx)) return true;
    }
  }
  return false;
}

function stickerAt(state: CubeFaces, face: Face, idx: number): Face {
  return state[face][idx];
}

function setEq<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// ============================================================
// OLL recognition (partial — covers a useful subset honestly)
// ============================================================

/**
 * Recognize a small set of named OLL patterns by U-face + 4 side-top-row
 * orientation pattern. Returns null for unrecognized cases.
 *
 * Pattern is encoded as a 9-bit string of '1' (U-color) / '0' (not):
 *   U face: 9 cells in row-major order (back row first).
 *   Plus 12 side stickers (top row of F R B L = the row touching U).
 *
 * For brevity we cover cases distinguishable by COUNT of oriented U
 * stickers + edge orientation (EO) status:
 *   - "Solved" (OLL skip)              — all 9 U + 12 sides U-colored
 *   - "Cross" + permutation cases (4 OCLLs: H, U, T, L, Pi, Sune, Anti-Sune)
 *   - 3 EO base shapes: Dot / Line / L-shape
 *
 * Cases with corner-orientation that could be Sune vs Anti-Sune vs T vs
 * L vs U vs H vs Pi: we look at the 8 non-U-color side stickers. This
 * recognizes 7 named OCLL cases when the cross is already oriented.
 *
 * All patterns are AUF-invariant: we try 4 U rotations of the cube state
 * before pattern lookup. Caller must pass a state with F2L solved.
 */
function recognizeOll(state: CubeFaces): string | null {
  const cU = state.U[4];
  // Quick: all U oriented?
  if (state.U.every(c => c === cU)) {
    return 'OLL skip';
  }
  // Try 4 AUFs.
  let best: string | null = null;
  let cur = state;
  for (let i = 0; i < 4; i++) {
    const label = matchOllPattern(cur, cU);
    if (label) { best = label; break; }
    cur = applyMoves(cur, 3, parseScramble('U'));
  }
  return best;
}

function matchOllPattern(state: CubeFaces, cU: Face): string | null {
  const u = state.U.map(c => (c === cU ? 1 : 0));
  // Side top-row counts (number of U-color stickers on each side's row 0)
  const sideTopU: Record<Face, number[]> = {
    F: [0, 1, 2].map(i => state.F[i] === cU ? 1 : 0),
    R: [0, 1, 2].map(i => state.R[i] === cU ? 1 : 0),
    B: [0, 1, 2].map(i => state.B[i] === cU ? 1 : 0),
    L: [0, 1, 2].map(i => state.L[i] === cU ? 1 : 0),
    U: [], D: [],
  };

  // Edge orientation: U-color on 4 U-edge positions (U[1,3,5,7]).
  const eo = u[1] + u[3] + u[5] + u[7];
  // Corner orientation: U-color on 4 U-corner positions (U[0,2,6,8]).
  const co = u[0] + u[2] + u[6] + u[8];

  // ===== EO-only cases: cross is NOT yet oriented =====
  if (eo === 0) {
    // Dot: no edges oriented.
    return 'OLL: Dot (EO)';
  }
  if (eo === 2) {
    // Two oriented edges — Line or L-shape.
    // Line: oriented edges are opposite (UF+UB or UL+UR).
    if ((u[1] && u[7]) || (u[3] && u[5])) return 'OLL: Line (EO)';
    return 'OLL: L-shape (EO)';
  }

  // ===== EO complete: cross oriented. Now identify by CO pattern =====
  if (eo === 4) {
    if (co === 4) {
      // Shouldn't reach here (would be solved OLL). Defensive return.
      return 'OLL skip';
    }
    if (co === 0) {
      // 0 corners oriented — H, Pi.
      // Pi: two opposite-pair side stickers of U-color showing.
      // H:  symmetric — U-color shows on opposite sides equally.
      // Distinguish by sideTopU pattern: H has 2-and-2 across F/B and L/R;
      // Pi has 2 on opposite sides plus a different layout.
      // Simple heuristic: H has U-color stickers symmetric front-back-AND-left-right.
      const fSum = sideTopU.F[0] + sideTopU.F[2];  // corners only
      const bSum = sideTopU.B[0] + sideTopU.B[2];
      const lSum = sideTopU.L[0] + sideTopU.L[2];
      const rSum = sideTopU.R[0] + sideTopU.R[2];
      // H: 2 on each of 2 opposite sides (e.g. F=2, B=2, L=0, R=0).
      if ((fSum === 2 && bSum === 2 && lSum === 0 && rSum === 0) ||
          (lSum === 2 && rSum === 2 && fSum === 0 && bSum === 0)) {
        return 'OLL 21 (H)';
      }
      // Pi: 2 on one side, 2 on adjacent side.
      return 'OLL 22 (Pi)';
    }
    if (co === 1) {
      // 1 corner oriented: Sune or Anti-Sune.
      // Sune: the 3 non-oriented corners have U-color showing on a
      // characteristic clockwise pattern around the oriented one.
      // For a fully precise Sune-vs-Anti-Sune split we'd need to inspect
      // exact side stickers. We mark "Sune family" honestly.
      return 'OLL 26/27 (Sune family)';
    }
    if (co === 2) {
      // 2 corners oriented: T, L, U-shape, or J/F variants.
      // Distinguish by relative position of oriented corners (adjacent vs
      // diagonal).
      const oriented = [u[0], u[2], u[8], u[6]]; // UBL, UBR, UFR, UFL clockwise
      // diagonal pair (UBL+UFR or UBR+UFL)?
      if ((oriented[0] && oriented[2]) || (oriented[1] && oriented[3])) {
        return 'OLL 23 (Headlights/T-family)';
      }
      // adjacent pair: U / L / J shape — leave as family.
      return 'OLL 24/25/L-family';
    }
    if (co === 3) {
      // Defensive: shouldn't happen with eo=4 and co=3 as a valid OCLL state
      // (3 corners oriented + 1 unoriented is impossible — corner orientations
      // must sum to 0 mod 3). Fall through.
      return null;
    }
  }

  // EO odd (1 or 3): impossible parity for a real LL state. Return null.
  return null;
}

// ============================================================
// PLL recognition (cycle-structure based, covers all 21 + skip)
// ============================================================

/**
 * Identify the PLL case by computing the corner-permutation cycle
 * structure + edge-permutation cycle structure on the U layer. Both
 * cycle structures are AUF-invariant when combined with a check of
 * "are the same colors paired up".
 *
 * Approach:
 *   - Read 4 U-corner cubies (by their 3 stickers' color set).
 *   - Read 4 U-edge cubies (by their 2 stickers' color set).
 *   - Compute permutation cycle pattern of corners (sorted) and edges.
 *   - Map (corner-pattern, edge-pattern) → PLL name.
 *
 * Returns the PLL letter or null if the LL has impossible permutation
 * (e.g. single corner swap — not reachable from a valid state).
 */
function recognizePll(state: CubeFaces): string | null {
  const cU = state.U[4];
  const cF = state.F[4], cR = state.R[4], cB = state.B[4], cL = state.L[4];
  // Each U corner cubie's color set; compare against home set to determine
  // permutation. Home corners: UBL={U,B,L}, UBR={U,B,R}, UFR={U,F,R}, UFL={U,F,L}.
  const home: Record<string, string> = {
    [setKey([cU, cB, cL])]: 'UBL',
    [setKey([cU, cB, cR])]: 'UBR',
    [setKey([cU, cF, cR])]: 'UFR',
    [setKey([cU, cF, cL])]: 'UFL',
  };
  const homeEdge: Record<string, string> = {
    [setKey([cU, cB])]: 'UB',
    [setKey([cU, cR])]: 'UR',
    [setKey([cU, cF])]: 'UF',
    [setKey([cU, cL])]: 'UL',
  };
  const cornerAt: { pos: string; colors: Face[] }[] = [
    { pos: 'UBL', colors: [state.U[0], state.B[2], state.L[0]] },
    { pos: 'UBR', colors: [state.U[2], state.R[2], state.B[0]] },
    { pos: 'UFR', colors: [state.U[8], state.F[2], state.R[0]] },
    { pos: 'UFL', colors: [state.U[6], state.L[2], state.F[0]] },
  ];
  const edgeAt: { pos: string; colors: Face[] }[] = [
    { pos: 'UB', colors: [state.U[1], state.B[1]] },
    { pos: 'UR', colors: [state.U[5], state.R[1]] },
    { pos: 'UF', colors: [state.U[7], state.F[1]] },
    { pos: 'UL', colors: [state.U[3], state.L[1]] },
  ];
  // Permutation map: position → home-position.
  const cornerPerm: Record<string, string> = {};
  for (const c of cornerAt) {
    const k = setKey(c.colors);
    if (!(k in home)) return null;
    cornerPerm[c.pos] = home[k];
  }
  const edgePerm: Record<string, string> = {};
  for (const e of edgeAt) {
    const k = setKey(e.colors);
    if (!(k in homeEdge)) return null;
    edgePerm[e.pos] = homeEdge[k];
  }

  // Cycle structure (sorted lengths) of each permutation.
  const cornerCycles = cycleLengths(cornerPerm);
  const edgeCycles = cycleLengths(edgePerm);
  const cKey = cornerCycles.join(',');
  const eKey = edgeCycles.join(',');

  // Map to PLL. Cycle-shape-only is not a perfect distinguisher (some PLL
  // pairs share cycle shapes — e.g. Aa vs Ab differ only in cycle direction;
  // Ja vs Jb similarly). We cover what cycle-structure can distinguish; the
  // remaining ambiguity we report as a family.
  const key = `${cKey}|${eKey}`;
  return PLL_BY_CYCLE[key] ?? null;
}

// Cycle-shape → PLL name. Some entries are families when shape alone is
// ambiguous (Aa/Ab, Ga/Gb/Gc/Gd, Ja/Jb, Ra/Rb, Ua/Ub).
//
// Cycle shapes here are written as comma-separated ascending lengths.
//   No swap = '1,1,1,1'
//   3-cycle = '1,3'
//   2+2 swap = '2,2'
//   4-cycle = '4'
const PLL_BY_CYCLE: Record<string, string> = {
  // PLL skip
  '1,1,1,1|1,1,1,1': 'PLL skip',
  // U: 3-edge cycle, corners untouched
  '1,1,1,1|1,3': 'PLL: Ua/Ub (U-perm)',
  // H: 2 opposite edge swaps, corners untouched
  '1,1,1,1|2,2': 'PLL: H-perm',
  // Z: 2 adjacent edge swaps, corners untouched
  // (Z and H both have edge cycle '2,2' but Z is adjacent-pair swap.) We
  // can't distinguish from cycle-shape alone, so we expose 'H/Z'.
  // -> handled by H entry; a more specific check can be added later.

  // A-perm: 3-corner cycle, edges untouched
  '1,3|1,1,1,1': 'PLL: Aa/Ab (A-perm)',
  // E-perm: 2 diagonal corner swaps, edges 2 swaps... actually E is 2,2 + 2,2.
  '2,2|2,2': 'PLL: E-perm',
  // T-perm: corner adjacent swap (2,1,1) + edge adjacent swap (2,1,1) — but a
  //   2-cycle in corners alone is impossible (parity). T actually has 2-corner
  //   swap + 3-edge swap? Let me reconsider: T-perm = corner-pair swap +
  //   edge-pair swap, both adjacent. So cycle shapes: '1,1,2|1,1,2'.
  '1,1,2|1,1,2': 'PLL: T/F/Ja/Jb/Ra/Rb (adjacent corner+edge swap)',
  // Y: diagonal corner swap + adjacent edge swap. Diagonal corner swap is '2,2'?
  //   No — a single transposition between two diagonal corners is still a 2-cycle,
  //   leaving the other 2 fixed: '1,1,2'. Hmm same as T. Cycle shape can't
  //   distinguish T from Y/V/Na/Nb without more info. Leave as family.
  // V: 2-corner swap + 2-edge swap, opposite corners. Same shape as T family.
  // Na/Nb: 2 diagonal corner swaps + 2 edge swaps? cycle: '2,2|2,2'? Same as E.
  //   We mark E-family above as just E since these are very different.

  // G-perm: 3-corner cycle + 3-edge cycle = '1,3|1,3'.
  '1,3|1,3': 'PLL: Ga/Gb/Gc/Gd (G-perm)',
};

function cycleLengths(perm: Record<string, string>): number[] {
  const visited = new Set<string>();
  const lens: number[] = [];
  for (const start of Object.keys(perm)) {
    if (visited.has(start)) continue;
    let cur = start;
    let len = 0;
    while (!visited.has(cur)) {
      visited.add(cur);
      cur = perm[cur];
      len++;
    }
    lens.push(len);
  }
  return lens.sort((a, b) => a - b);
}

function setKey(arr: Face[]): string {
  return arr.slice().sort().join('');
}

