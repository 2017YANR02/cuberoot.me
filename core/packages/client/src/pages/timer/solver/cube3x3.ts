/**
 * 3x3 facelet state + move tables, ported from cstimer's
 * `tools/gsolver.js` `rubiksCube` block (URFDLB face order, 9 stickers per
 * face, 54-char string).
 *
 * Index layout (matches cstimer mathlib.SOLVED_FACELET):
 *   U:  0..8     R:  9..17    F: 18..26
 *   D: 27..35    L: 36..44    B: 45..53
 *
 * Within each face, stickers are numbered row-major (1..9) where 1 is the
 * top-left corner of the face when looking straight at it (cstimer
 * convention).
 */

import { parseScramble } from '../cube/moves';
import type { ParsedMove } from '../cube/moves';

export const SOLVED_3X3 =
  'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// Sticker indices, copied verbatim from cstimer to match its mask-string
// convention exactly (so our cfmeta entries can be the same strings).
// Centers (U5/R5/F5/D5/L5/B5) are unused — face turns don't move them — but
// kept commented for layout clarity vs the cstimer source.
const U1 = 0, U2 = 1, U3 = 2, U4 = 3, /* U5 = 4, */ U6 = 5, U7 = 6, U8 = 7, U9 = 8;
const R1 = 9, R2 = 10, R3 = 11, R4 = 12, /* R5 = 13, */ R6 = 14, R7 = 15, R8 = 16, R9 = 17;
const F1 = 18, F2 = 19, F3 = 20, F4 = 21, /* F5 = 22, */ F6 = 23, F7 = 24, F8 = 25, F9 = 26;
const D1 = 27, D2 = 28, D3 = 29, D4 = 30, /* D5 = 31, */ D6 = 32, D7 = 33, D8 = 34, D9 = 35;
const L1 = 36, L2 = 37, L3 = 38, L4 = 39, /* L5 = 40, */ L6 = 41, L7 = 42, L8 = 43, L9 = 44;
const B1 = 45, B2 = 46, B3 = 47, B4 = 48, /* B5 = 49, */ B6 = 50, B7 = 51, B8 = 52, B9 = 53;

// Per-move list of cycles. Each cycle is N indices that rotate cyclically by
// `pow` steps when the move power is applied. Order: U R F D L B u r f d l b.
// Verbatim port of cstimer `moveData` (we don't need slices/rotations here).
type Cycle = number[];
const moveData: Cycle[][] = [
  [[U1, U3, U9, U7], [U2, U6, U8, U4], [F1, L1, B1, R1], [F2, L2, B2, R2], [F3, L3, B3, R3]], // U
  [[R1, R3, R9, R7], [R2, R6, R8, R4], [U3, B7, D3, F3], [U6, B4, D6, F6], [U9, B1, D9, F9]], // R
  [[F1, F3, F9, F7], [F2, F6, F8, F4], [U7, R1, D3, L9], [U8, R4, D2, L6], [U9, R7, D1, L3]], // F
  [[D1, D3, D9, D7], [D2, D6, D8, D4], [F7, R7, B7, L7], [F8, R8, B8, L8], [F9, R9, B9, L9]], // D
  [[L1, L3, L9, L7], [L2, L6, L8, L4], [U1, F1, D1, B9], [U4, F4, D4, B6], [U7, F7, D7, B3]], // L
  [[B1, B3, B9, B7], [B2, B6, B8, B4], [U3, L1, D7, R9], [U2, L4, D8, R6], [U1, L7, D9, R3]], // B
];

const FACE_LETTERS = 'URFDLB';

/**
 * Cycle one array of indices by `pow` positions (matches cstimer
 * `mathlib.acycle` with no orientation arg).
 */
function acycle(arr: string[], perm: readonly number[], pow: number): void {
  const plen = perm.length;
  const tmp = new Array<string>(plen);
  for (let i = 0; i < plen; i++) tmp[i] = arr[perm[i]];
  for (let i = 0; i < plen; i++) {
    const j = (i + pow) % plen;
    arr[perm[j]] = tmp[i];
  }
}

/**
 * Apply one move (e.g. "U", "U2", "U'") to a 54-char facelet state. Move
 * format: face letter at [0], suffix at [1] which is one of " ", "2", "'".
 */
export function cubeMove(state: string, move: string): string {
  const faceIdx = FACE_LETTERS.indexOf(move[0]);
  if (faceIdx < 0) return state;
  const swaps = moveData[faceIdx];
  const suffix = move.length > 1 ? move[1] : ' ';
  const pow = '? 2\''.indexOf(suffix); // " "=1, "2"=2, "'"=3
  if (pow <= 0) return state;
  const ret = state.split('');
  for (const cyc of swaps) acycle(ret, cyc, pow);
  return ret.join('');
}

/**
 * Convert ParsedMove to the cstimer-style two-char form ("U ", "U2", "U'").
 * Wide / slice / rotation / non-3x3 moves are skipped (scrambles only use
 * face turns in normal use).
 */
function parsedToCstimer(mv: ParsedMove): string | null {
  if (mv.isRotation) return null;
  if (mv.layers !== 1) return null;
  const f = mv.face;
  if (f !== 'U' && f !== 'R' && f !== 'F' && f !== 'D' && f !== 'L' && f !== 'B') return null;
  if (mv.amount === 1) return f + ' ';
  if (mv.amount === 2 || mv.amount === -2) return f + '2';
  return f + "'";
}

/** Apply a scramble string to the solved 3x3 state and return the result. */
export function applyScramble(scramble: string, start: string = SOLVED_3X3): string {
  let state = start;
  const moves = parseScramble(scramble);
  for (const mv of moves) {
    const tok = parsedToCstimer(mv);
    if (tok == null) continue;
    state = cubeMove(state, tok);
  }
  return state;
}

// --- Move-name → axis/face bitmap (matches cstimer move-skip logic) ---
//
// High nibble = face id (per cstimer 0x00,0x11,0x22,0x30,0x41,0x52).
// Low nibble  = axis id   (U=D=0, R=L=1, F=B=2).
// Two moves can be commuted (skipped in canonical order) iff their low
// nibbles match. Two moves are the same face iff their full byte XOR is 0.

function appendSuffix(moves: Record<string, number>): Record<string, number> {
  const ret: Record<string, number> = {};
  const suffix = " 2'";
  for (const m in moves) {
    for (let i = 0; i < suffix.length; i++) {
      ret[m + suffix[i]] = moves[m];
    }
  }
  return ret;
}

export const MOVES_FULL: Record<string, number> = appendSuffix({
  U: 0x00,
  R: 0x11,
  F: 0x22,
  D: 0x30,
  L: 0x41,
  B: 0x52,
});

export const MOVES_NO_D: Record<string, number> = appendSuffix({
  U: 0x00,
  R: 0x11,
  F: 0x22,
  L: 0x41,
  B: 0x52,
});

export const MOVES_ROUX_SB: Record<string, number> = appendSuffix({
  U: 0x00,
  R: 0x11,
  M: 0x61,
  r: 0x71,
});

export const MOVES_ZZ_F2L: Record<string, number> = appendSuffix({
  U: 0x00,
  R: 0x11,
  L: 0x41,
});
