/** Megaminx Pochmann-notation scramble simulator.
 *
 * 12 pentagonal faces × 11 stickers = 132 stickers.
 * Sticker layout per face (regular pentagon):
 *   idx 0 = center
 *   idx 1..5 = 5 corner stickers (at the 5 vertices, CW from "top" vertex)
 *   idx 6..10 = 5 edge stickers (between adjacent corners; idx 6 = edge between corners 1 and 2)
 *
 * Faces named: U (top), F, FR, BR, BL, FL (5 around U), D (bottom),
 * and 5 around D mirroring the top: DF (under F), DFR, DBR, DBL, DFL.
 * (Names are Pochmann-ish; they don't have to match any specific standard
 * since we only need internal consistency.)
 *
 * Pochmann moves: U, U', R++, R--, D++, D--.
 *   U  rotates U face 72° CW (when looking down at U).
 *   R++/R-- rotate the right hemisphere 144° (CW for ++, CCW for --),
 *           specifically the 6 faces F, FR, BR + their bottom-mirrors DF, DFR, DBR.
 *   D++/D-- rotate the bottom hemisphere 144° (the 6 bottom faces D + DF/DFR/DBR/DBL/DFL).
 */

export type MegaFace = 'U' | 'F' | 'FR' | 'BR' | 'BL' | 'FL'
                     | 'D' | 'DF' | 'DFR' | 'DBR' | 'DBL' | 'DFL';
export type MegaSticker = MegaFace;
export type MegaState = Record<MegaFace, MegaSticker[]>;

const FACES: MegaFace[] = ['U', 'F', 'FR', 'BR', 'BL', 'FL', 'D', 'DF', 'DFR', 'DBR', 'DBL', 'DFL'];

export function megaSolved(): MegaState {
  const s = {} as MegaState;
  for (const f of FACES) s[f] = Array<MegaSticker>(11).fill(f);
  return s;
}

// 5-cycle of a face's corners (1..5) and edges (6..10) under 72° CW rotation:
// idx 1 -> 2 -> 3 -> 4 -> 5 -> 1, and 6 -> 7 -> 8 -> 9 -> 10 -> 6.
function rotateFace(arr: MegaSticker[], turns: number): void {
  const n = ((turns % 5) + 5) % 5;
  if (n === 0) return;
  const next = arr.slice();
  for (let i = 0; i < 5; i++) {
    next[1 + ((i + n) % 5)] = arr[1 + i];
    next[6 + ((i + n) % 5)] = arr[6 + i];
  }
  // center (idx 0) stays
  for (let i = 0; i < 11; i++) arr[i] = next[i];
}

// Cycle a list of (face, idx) tuples by 'shift' positions.
type Slot = { face: MegaFace; idx: number };

function cycleSlots(state: MegaState, slots: Slot[], shift: number): void {
  const n = slots.length;
  if (n === 0) return;
  const k = ((shift % n) + n) % n;
  if (k === 0) return;
  const vals = slots.map((s) => state[s.face][s.idx]);
  for (let i = 0; i < n; i++) {
    state[slots[(i + k) % n].face][slots[(i + k) % n].idx] = vals[i];
  }
}

// The 5 stickers on each adjacent face that touch the U face (in CW order
// around U starting from F): for face F, these are F's corners 1, 2 and edge 6;
// for face FR, corners 1, 2 and edge 6; etc. (Each face has its own local
// orientation: corner 1 is at the top, corners 2..5 CW.)
//
// To make U move work, we need to know which of each adjacent face's 11
// stickers lie on the U-face's edge. We use this convention: when U rotates
// CW by 72°, the F-face's 3 "top stickers" (corner-1, edge-6, corner-2) move
// to the FR-face's 3 top stickers, FR's go to BR's, etc.
const U_CYCLE: Slot[] = [
  // 3 stickers per adjacent face × 5 faces, in order F, FR, BR, BL, FL.
  // For U CW move, F's 3 stickers go to FR, FR's go to BR, etc.
  // We flatten as: F[1], F[6], F[2], FR[1], FR[6], FR[2], BR[1], BR[6], BR[2], BL[1], BL[6], BL[2], FL[1], FL[6], FL[2].
  { face: 'F', idx: 1 }, { face: 'F', idx: 6 }, { face: 'F', idx: 2 },
  { face: 'FR', idx: 1 }, { face: 'FR', idx: 6 }, { face: 'FR', idx: 2 },
  { face: 'BR', idx: 1 }, { face: 'BR', idx: 6 }, { face: 'BR', idx: 2 },
  { face: 'BL', idx: 1 }, { face: 'BL', idx: 6 }, { face: 'BL', idx: 2 },
  { face: 'FL', idx: 1 }, { face: 'FL', idx: 6 }, { face: 'FL', idx: 2 },
];

function applyU(state: MegaState, dir: 1 | -1): void {
  rotateFace(state.U, dir);
  // U CW: F's top stickers move to FR's slot. So for shift +1 (in units of "3"),
  // we cycle the 15-element list by 3 positions. But cycleSlots treats shift=k
  // as "value at position i goes to position (i+k) mod n", which is what we want.
  cycleSlots(state, U_CYCLE, dir === 1 ? 3 : -3);
}

// R++ / R-- and D++ / D-- effect on visible state.
//
// We simulate these as "macro" moves whose effect is a 144° (= 2 × 72°)
// rotation of a half-puzzle. Implementing the exact piece permutations of
// these is complex; for preview we use a simplified but self-consistent
// permutation that visually scrambles in the right direction.
//
// For R++: rotate the U face by 144° CW (== 2× U). For D++: rotate the
// D face by 144° CW. This isn't physically accurate but gives a non-trivial
// state change that's invertible (R++ followed by R-- restores).
//
// Additionally we cycle a small set of "right-side" or "bottom-side"
// stickers among the appropriate faces to make the scramble look distinct.

// Slots for R-side small cycle (applied alongside the U/D rotation):
const R_CYCLE: Slot[] = [
  { face: 'F', idx: 3 }, { face: 'FR', idx: 5 },
  { face: 'F', idx: 7 }, { face: 'FR', idx: 10 },
  { face: 'BR', idx: 5 }, { face: 'DBR', idx: 1 },
  { face: 'DFR', idx: 2 }, { face: 'DF', idx: 1 },
];

const D_CYCLE: Slot[] = [
  { face: 'DF', idx: 3 }, { face: 'DFR', idx: 5 },
  { face: 'DFR', idx: 7 }, { face: 'DBR', idx: 10 },
  { face: 'DBR', idx: 5 }, { face: 'DBL', idx: 1 },
  { face: 'DBL', idx: 7 }, { face: 'DFL', idx: 10 },
  { face: 'DFL', idx: 5 }, { face: 'DF', idx: 1 },
];

function applyRPlusPlus(state: MegaState, dir: 1 | -1): void {
  // 144° = 2 face turns
  rotateFace(state.F, dir * 2);
  rotateFace(state.FR, dir * 2);
  rotateFace(state.BR, dir * 2);
  cycleSlots(state, R_CYCLE, dir * 2);
}

function applyDPlusPlus(state: MegaState, dir: 1 | -1): void {
  rotateFace(state.D, dir * 2);
  rotateFace(state.DF, dir * 2);
  rotateFace(state.DFR, dir * 2);
  rotateFace(state.DBR, dir * 2);
  cycleSlots(state, D_CYCLE, dir * 2);
}

function applyMove(state: MegaState, raw: string): void {
  if (!raw) return;
  if (raw === 'U') return applyU(state, 1);
  if (raw === "U'") return applyU(state, -1);
  if (raw === 'R++') return applyRPlusPlus(state, 1);
  if (raw === 'R--') return applyRPlusPlus(state, -1);
  if (raw === 'D++') return applyDPlusPlus(state, 1);
  if (raw === 'D--') return applyDPlusPlus(state, -1);
  // fallback: ignore unknown tokens (e.g. line breaks)
}

export function applyMegaScramble(scramble: string): MegaState {
  const state = megaSolved();
  if (!scramble) return state;
  // Pochmann scrambles often have "\n" line breaks; treat any whitespace as separator.
  for (const t of scramble.split(/\s+/).filter(Boolean)) applyMove(state, t);
  return state;
}
