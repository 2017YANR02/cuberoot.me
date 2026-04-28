/**
 * CFOP recognition for the SolverHints panel.
 *
 * Given a scramble + a chosen cross orientation, this module:
 *   1. Computes F2L pair counts (solved / paired-but-misplaced / unpaired) by
 *      simulating: scramble + cross-solution + rotate-cross-to-D.
 *   2. Identifies the OLL/PLL case (when the cube happens to already be in
 *      those states — last-layer-only practice scrambles) by exact lookup
 *      against signature tables built from oll.json / pll.json.
 *
 * The simulation is done in CubeFaces space using the existing applyMoves /
 * parseScramble. Recognition is done by precomputing, for each of the 57
 * OLL and 21 PLL cases, the cube state produced by applying the inverse of
 * its solving algorithm to a solved cube; from that state we read a
 * canonical sticker signature; the resulting `signature -> caseName` map
 * is consulted at recognition time, trying all 4 AUF rotations.
 */

import { applyMoves, applyScramble, solved as solvedCube } from '../cube/state';
import type { CubeFaces } from '../cube/state';
import type { Face, ParsedMove } from '../cube/moves';
import { parseScramble } from '../cube/moves';
import { isCross, isF2l, isOll, isSolved } from '../cube/cfop_detect';
import type { Orientation } from '../solver/cross';
import { invertAlg } from '../scramble/invert';
import ollData from '@cuberoot/shared/data/oll.json';
import pllData from '@cuberoot/shared/data/pll.json';

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

  if (!isCross(state)) return empty;

  const f2l = countF2lSlots(state);

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
    pllLabel = recognizePllLabel(state);
  } else if (isF2l(state)) {
    stage = 'f2l';
    ollLabel = recognizeOllLabel(state);
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

function countF2lSlots(state: CubeFaces): F2lSlotCounts {
  const out = { solved: 0, paired: 0, unpaired: 0 };
  const { D, F, R, B, L } = state;
  const cD = D[4], cF = F[4], cR = R[4], cB = B[4], cL = L[4];

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

  if (
    pairExistsInUAboveAnySlot(state, cornerColors, edgeColors) ||
    pairExistsCornerInSlotEdgeInU(state, cornerColors, edgeColors)
  ) {
    return 'paired';
  }
  return 'unpaired';
}

function pairExistsInUAboveAnySlot(
  state: CubeFaces,
  cornerColors: Set<Face>,
  edgeColors: Set<Face>,
): boolean {
  const { U } = state;
  const corners: { uIdx: number; sideA: Face; aIdx: number; sideB: Face; bIdx: number }[] = [
    { uIdx: 0, sideA: 'B', aIdx: 2, sideB: 'L', bIdx: 0 },
    { uIdx: 2, sideA: 'R', aIdx: 2, sideB: 'B', bIdx: 0 },
    { uIdx: 6, sideA: 'L', aIdx: 2, sideB: 'F', bIdx: 0 },
    { uIdx: 8, sideA: 'F', aIdx: 2, sideB: 'R', bIdx: 0 },
  ];
  const adjEdges: Record<number, { side: Face; uEdgeIdx: number; sideStickerIdx: number }[]> = {
    0: [
      { side: 'B', uEdgeIdx: 1, sideStickerIdx: 1 },
      { side: 'L', uEdgeIdx: 3, sideStickerIdx: 1 },
    ],
    2: [
      { side: 'B', uEdgeIdx: 1, sideStickerIdx: 1 },
      { side: 'R', uEdgeIdx: 5, sideStickerIdx: 1 },
    ],
    6: [
      { side: 'F', uEdgeIdx: 7, sideStickerIdx: 1 },
      { side: 'L', uEdgeIdx: 3, sideStickerIdx: 1 },
    ],
    8: [
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

function pairExistsCornerInSlotEdgeInU(
  state: CubeFaces,
  cornerColors: Set<Face>,
  edgeColors: Set<Face>,
): boolean {
  const { U, D } = state;
  const dCorners: { D: number; sa: Face; saIdx: number; sb: Face; sbIdx: number }[] = [
    { D: 0, sa: 'F', saIdx: 6, sb: 'L', sbIdx: 8 },
    { D: 2, sa: 'F', saIdx: 8, sb: 'R', sbIdx: 6 },
    { D: 6, sa: 'B', saIdx: 8, sb: 'L', sbIdx: 6 },
    { D: 8, sa: 'B', saIdx: 6, sb: 'R', sbIdx: 8 },
  ];
  const uEdges: { u: number; side: Face; sIdx: number }[] = [
    { u: 1, side: 'B', sIdx: 1 },
    { u: 3, side: 'L', sIdx: 1 },
    { u: 5, side: 'R', sIdx: 1 },
    { u: 7, side: 'F', sIdx: 1 },
  ];

  for (const c of dCorners) {
    const cs: Face[] = [D[c.D], stickerAt(state, c.sa, c.saIdx), stickerAt(state, c.sb, c.sbIdx)];
    if (!setEq(new Set(cs), cornerColors)) continue;
    for (const e of uEdges) {
      const es: Face[] = [U[e.u], stickerAt(state, e.side, e.sIdx)];
      if (!setEq(new Set(es), edgeColors)) continue;
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
// OLL exact recognition (all 57 cases)
// ============================================================

/**
 * OLL signature: 21 bits over the top-layer stickers, each bit is 1 iff the
 * sticker is U-color.
 *
 * Bit layout (positions 0..20):
 *   0..8   : U[0..8] (the 9 U-face stickers; center U[4] is always 1)
 *   9..11  : F[0], F[1], F[2] (top row of F)
 *   12..14 : R[0], R[1], R[2]
 *   15..17 : B[0], B[1], B[2]
 *   18..20 : L[0], L[1], L[2]
 *
 * This covers every facelet visible on the top layer that an OLL pattern
 * could distinguish. 21 bits fit comfortably in a JS number.
 */
function ollSignature(state: CubeFaces): number {
  const cU = state.U[4];
  let sig = 0;
  let bit = 0;
  for (let i = 0; i < 9; i++) {
    if (state.U[i] === cU) sig |= (1 << bit);
    bit++;
  }
  for (const face of ['F', 'R', 'B', 'L'] as const) {
    for (let i = 0; i < 3; i++) {
      if (state[face][i] === cU) sig |= (1 << bit);
      bit++;
    }
  }
  return sig;
}

/**
 * PLL signature: U is solved (all U-color), so we encode the 12 side-top
 * stickers, each labeled by which side-color it shows (F=0, R=1, B=2, L=3).
 *
 * Bit layout (24 bits, 2 bits per sticker, positions 0..11):
 *   0  : F[0]      1 : F[1]      2 : F[2]
 *   3  : R[0]      4 : R[1]      5 : R[2]
 *   6  : B[0]      7 : B[1]      8 : B[2]
 *   9  : L[0]     10 : L[1]     11 : L[2]
 */
function pllSignature(state: CubeFaces): number {
  const cF = state.F[4], cR = state.R[4], cB = state.B[4], cL = state.L[4];
  const labelOf = (c: Face): number => {
    if (c === cF) return 0;
    if (c === cR) return 1;
    if (c === cB) return 2;
    if (c === cL) return 3;
    // U / D / unknown — shouldn't occur on side-top after PLL setup.
    return -1;
  };
  let sig = 0;
  let pos = 0;
  for (const face of ['F', 'R', 'B', 'L'] as const) {
    for (let i = 0; i < 3; i++) {
      const lbl = labelOf(state[face][i]);
      if (lbl < 0) return -1;
      sig |= (lbl << (pos * 2));
      pos++;
    }
  }
  return sig;
}

// ----- Build signature tables once at module load -----

interface OllEntry { case: string; auf: 0 | 1 | 2 | 3; }
interface PllEntry { case: string; auf: 0 | 1 | 2 | 3; }

const OLL_TABLE: Map<number, OllEntry> = new Map();
const PLL_TABLE: Map<number, PllEntry> = new Map();
const OLL_SOLVED_SIG = ollSignature(solvedCube(3));
const PLL_SOLVED_SIG = pllSignature(solvedCube(3));

let OLL_BUILD_ERRORS: string[] = [];
let PLL_BUILD_ERRORS: string[] = [];

function buildOllTable(): void {
  // OLL keys "OLL 1" .. "OLL 57". Process in order; if a signature collision
  // appears, keep the first. (All 57 should produce distinct signatures.)
  const ollMap = ollData as Record<string, { name: string; alg: string; alg2?: string; group?: string }>;
  for (let i = 1; i <= 57; i++) {
    const key = `OLL ${i}`;
    const entry = ollMap[key];
    if (!entry) { OLL_BUILD_ERRORS.push(`${key}: missing`); continue; }
    const alg = entry.alg;
    if (!alg) { OLL_BUILD_ERRORS.push(`${key}: empty alg`); continue; }
    let setupMoves: ParsedMove[];
    try {
      setupMoves = parseScramble(invertAlg(alg));
    } catch (e) {
      OLL_BUILD_ERRORS.push(`${key}: parse failed (${(e as Error).message})`);
      continue;
    }
    let st: CubeFaces;
    try {
      st = applyMoves(solvedCube(3), 3, setupMoves);
    } catch (e) {
      OLL_BUILD_ERRORS.push(`${key}: apply failed (${(e as Error).message})`);
      continue;
    }
    // Try all 4 AUFs of the setup state — register the canonical (smallest
    // AUF) form, but record all 4. Since recognition rotates the input, we
    // really only need to register the AUF=0 form. Other AUFs are handled
    // by the recognizer rotating the input.
    // Register only the canonical (AUF=0) signature. Recognizer rotates
    // the input cube up to 3 times to find a match; that rotation count
    // is the reported `auf`.
    const sig = ollSignature(st);
    if (!OLL_TABLE.has(sig)) {
      OLL_TABLE.set(sig, { case: key, auf: 0 });
    } else {
      const prev = OLL_TABLE.get(sig)!;
      OLL_BUILD_ERRORS.push(`${key}: signature collision with ${prev.case}`);
    }
  }
}

function buildPllTable(): void {
  const pllMap = pllData as Record<string, { noAuf: string }>;
  const keys = Object.keys(pllMap);
  for (const key of keys) {
    const entry = pllMap[key];
    if (!entry || !entry.noAuf) {
      PLL_BUILD_ERRORS.push(`${key}: missing noAuf`);
      continue;
    }
    let setupMoves: ParsedMove[];
    try {
      setupMoves = parseScramble(invertAlg(entry.noAuf));
    } catch (e) {
      PLL_BUILD_ERRORS.push(`${key}: parse failed (${(e as Error).message})`);
      continue;
    }
    let st: CubeFaces;
    try {
      st = applyMoves(solvedCube(3), 3, setupMoves);
    } catch (e) {
      PLL_BUILD_ERRORS.push(`${key}: apply failed (${(e as Error).message})`);
      continue;
    }
    const sig = pllSignature(st);
    if (sig < 0) {
      PLL_BUILD_ERRORS.push(`${key}: invalid signature (non-side color on side-top)`);
      continue;
    }
    if (!PLL_TABLE.has(sig)) {
      PLL_TABLE.set(sig, { case: key, auf: 0 });
    } else {
      const prev = PLL_TABLE.get(sig)!;
      PLL_BUILD_ERRORS.push(`${key}: signature collision with ${prev.case}`);
    }
  }
}

buildOllTable();
buildPllTable();

/**
 * Exact OLL recognition by signature lookup. Tries 4 AUFs of the input
 * state. Returns the case name and the AUF that aligned the input to a
 * canonical (AUF=0) entry, or null if no signature matched.
 *
 * The returned `auf` is the number of U turns (0..3) that, applied to the
 * input, produced the canonical entry. So to align input → canonical, do
 * `U^auf` first; equivalently, the "AUF needed before alg" is `(4-auf) % 4`.
 */
export function recognizeOllExact(faces: CubeFaces): { case: string; auf: 0 | 1 | 2 | 3 } | null {
  const cU = faces.U[4];
  // Skip = solved on U face + side-tops all U-color (i.e. fully oriented).
  // OLL skip is "no case to apply" — return explicit skip.
  let cur = faces;
  let allUOriented = true;
  for (let i = 0; i < 9; i++) if (cur.U[i] !== cU) { allUOriented = false; break; }
  if (allUOriented) {
    return { case: 'skip', auf: 0 };
  }
  for (let i = 0; i < 4; i++) {
    const sig = ollSignature(cur);
    const hit = OLL_TABLE.get(sig);
    if (hit) return { case: hit.case, auf: i as 0 | 1 | 2 | 3 };
    cur = applyMoves(cur, 3, parseScramble('U'));
  }
  return null;
}

/**
 * Exact PLL recognition. Requires the U face to already be oriented (OLL
 * solved); otherwise returns null. Tries 4 AUFs of the input state.
 */
export function recognizePllExact(faces: CubeFaces): { case: string; auf: 0 | 1 | 2 | 3 } | null {
  const cU = faces.U[4];
  for (let i = 0; i < 9; i++) if (faces.U[i] !== cU) return null;
  if (pllSignature(faces) === PLL_SOLVED_SIG) {
    return { case: 'skip', auf: 0 };
  }
  let cur = faces;
  for (let i = 0; i < 4; i++) {
    const sig = pllSignature(cur);
    if (sig >= 0) {
      const hit = PLL_TABLE.get(sig);
      if (hit) return { case: hit.case, auf: i as 0 | 1 | 2 | 3 };
    }
    cur = applyMoves(cur, 3, parseScramble('U'));
  }
  return null;
}

// ----- Friendly label wrappers used by recognizeForOrientation -----

function recognizeOllLabel(state: CubeFaces): string | null {
  const r = recognizeOllExact(state);
  if (!r) return null;
  if (r.case === 'skip') return 'OLL skip';
  const meta = (ollData as Record<string, { name?: string }>)[r.case];
  const name = meta?.name ? ` (${meta.name})` : '';
  return `${r.case}${name}`;
}

function recognizePllLabel(state: CubeFaces): string | null {
  const r = recognizePllExact(state);
  if (!r) return null;
  if (r.case === 'skip') return 'PLL skip';
  return `PLL: ${r.case}`;
}

// ============================================================
// Self-test
// ============================================================

/**
 * Verifies that all 57 OLL cases and all 21 PLL cases (in noAuf form)
 * round-trip through the recognition tables: applying the inverse of
 * each case's algorithm to a solved cube, then running the matching
 * exact recognizer, must return the same case key with auf=0.
 *
 * Returns null on success or an error message otherwise.
 */
export function __cfopRecognizeSelfTest(): string | null {
  const errs: string[] = [];

  if (OLL_BUILD_ERRORS.length) {
    errs.push(`OLL table build errors: ${OLL_BUILD_ERRORS.join('; ')}`);
  }
  if (PLL_BUILD_ERRORS.length) {
    errs.push(`PLL table build errors: ${PLL_BUILD_ERRORS.join('; ')}`);
  }

  // OLL round trip
  const ollMap = ollData as Record<string, { alg: string }>;
  let ollOk = 0;
  for (let i = 1; i <= 57; i++) {
    const key = `OLL ${i}`;
    const entry = ollMap[key];
    if (!entry?.alg) { errs.push(`${key}: missing alg`); continue; }
    let st: CubeFaces;
    try {
      st = applyMoves(solvedCube(3), 3, parseScramble(invertAlg(entry.alg)));
    } catch (e) {
      errs.push(`${key}: setup apply failed: ${(e as Error).message}`);
      continue;
    }
    const r = recognizeOllExact(st);
    if (!r) {
      errs.push(`${key}: not recognized (sig=${ollSignature(st)})`);
      continue;
    }
    if (r.case !== key || r.auf !== 0) {
      errs.push(`${key}: recognized as ${r.case} auf=${r.auf}`);
      continue;
    }
    ollOk++;
  }

  // PLL round trip
  const pllMap = pllData as Record<string, { noAuf: string }>;
  let pllOk = 0;
  const pllKeys = Object.keys(pllMap);
  for (const key of pllKeys) {
    const entry = pllMap[key];
    if (!entry?.noAuf) { errs.push(`${key}: missing noAuf`); continue; }
    let st: CubeFaces;
    try {
      st = applyMoves(solvedCube(3), 3, parseScramble(invertAlg(entry.noAuf)));
    } catch (e) {
      errs.push(`${key}: setup apply failed: ${(e as Error).message}`);
      continue;
    }
    const r = recognizePllExact(st);
    if (!r) {
      errs.push(`${key}: not recognized`);
      continue;
    }
    if (r.case !== key || r.auf !== 0) {
      errs.push(`${key}: recognized as ${r.case} auf=${r.auf}`);
      continue;
    }
    pllOk++;
  }

  // AUF normalization sanity check: pick OLL 27 (Sune), apply U2 after the
  // setup, and confirm recognizer reports auf=2.
  try {
    const sune = (ollData as Record<string, { alg: string }>)['OLL 27']?.alg;
    if (sune) {
      let st = applyMoves(solvedCube(3), 3, parseScramble(invertAlg(sune)));
      st = applyMoves(st, 3, parseScramble('U2'));
      const r = recognizeOllExact(st);
      if (!r || r.case !== 'OLL 27' || r.auf !== 2) {
        errs.push(`AUF check (Sune+U2): got ${r ? r.case + ' auf=' + r.auf : 'null'}`);
      }
    }
  } catch (e) {
    errs.push(`AUF check failed: ${(e as Error).message}`);
  }

  if (errs.length) return `OLL ${ollOk}/57, PLL ${pllOk}/${pllKeys.length}; errors: ${errs.join(' | ')}`;
  return null;
}

// Suppress "_unused" noise — these solved-sig constants are kept for clarity
// and used inside recognizers.
void OLL_SOLVED_SIG;
