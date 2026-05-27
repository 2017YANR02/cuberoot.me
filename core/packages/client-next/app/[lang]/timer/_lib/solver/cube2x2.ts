/**
 * 2x2x2 solver — facelet-string state of length 24 (4 stickers × 6 faces),
 * order URFDLB. Ported from cstimer `gsolver.js` `pocketCube` block, with an
 * additional "full solve" target.
 *
 * Sticker indices per face (each face is a 2x2 grid):
 *   0 1
 *   2 3
 *
 * Per-face start offsets:
 *   U: 0..3   R: 4..7   F: 8..11
 *   D: 12..15 L: 16..19 B: 20..23
 *
 * Move convention: only U, R, F are needed for canonical solving (fixing the
 * DBL corner). cstimer uses the same.
 */

import { GSolver, matches } from './gsolver';
import { parseScramble } from '../cube/moves';

export const SOLVED_2X2 = 'UUUURRRRFFFFDDDDLLLLBBBB';

// cstimer pocketCube cycles, verbatim.
const moveData: number[][][] = [
  [[0, 1, 3, 2], [4, 8, 16, 20], [5, 9, 17, 21]], // U
  [[4, 5, 7, 6], [1, 22, 13, 9], [3, 20, 15, 11]], // R
  [[8, 9, 11, 10], [2, 4, 13, 19], [3, 6, 12, 17]], // F
];

function acycle(arr: string[], perm: readonly number[], pow: number): void {
  const plen = perm.length;
  const tmp = new Array<string>(plen);
  for (let i = 0; i < plen; i++) tmp[i] = arr[perm[i]];
  for (let i = 0; i < plen; i++) {
    const j = (i + pow) % plen;
    arr[perm[j]] = tmp[i];
  }
}

export function pocketMove(state: string, move: string): string {
  const faceIdx = 'URF'.indexOf(move[0]);
  if (faceIdx < 0) return state;
  const swaps = moveData[faceIdx];
  const suffix = move.length > 1 ? move[1] : ' ';
  const pow = '? 2\''.indexOf(suffix);
  if (pow <= 0) return state;
  const ret = state.split('');
  for (const cyc of swaps) acycle(ret, cyc, pow);
  return ret.join('');
}

function appendSuffix(moves: Record<string, number>): Record<string, number> {
  const ret: Record<string, number> = {};
  for (const m in moves) for (const s of " 2'") ret[m + s] = moves[m];
  return ret;
}

// For 2x2, only 3 axes of moves; we encode them with simple unique low nibbles.
export const MOVES_2X2: Record<string, number> = appendSuffix({
  U: 0x00,
  R: 0x11,
  F: 0x22,
});

// --- Scramble parsing ---

function parsedToToken(face: string, amount: number): string | null {
  if (face !== 'U' && face !== 'R' && face !== 'F') return null;
  if (amount === 1) return face + ' ';
  if (amount === 2 || amount === -2) return face + '2';
  if (amount === -1) return face + "'";
  return null;
}

/** Apply a 2x2 scramble. Accepts U/R/F (and optional Uw/Rw/Fw which map the
 *  same on 2x2). Other faces (D L B) are skipped — for a real 2x2 scramble
 *  these never appear, but we guard against weird inputs. */
export function applyScramble2x2(scramble: string, start: string = SOLVED_2X2): string {
  let state = start;
  for (const mv of parseScramble(scramble)) {
    if (mv.isRotation) continue;
    if (mv.layers !== 1) continue;
    const tok = parsedToToken(mv.face, mv.amount);
    if (tok == null) continue;
    state = pocketMove(state, tok);
  }
  return state;
}

// --- Solvers (lazy singletons) ---

let fullSolver: GSolver | null = null;
function getFullSolver(): GSolver {
  if (!fullSolver) {
    fullSolver = new GSolver([SOLVED_2X2], pocketMove, MOVES_2X2);
  }
  return fullSolver;
}

// One face solver — finds shortest sequence to make a given face all one color.
let faceSolver: GSolver | null = null;
function getFaceSolver(): GSolver {
  if (!faceSolver) {
    // 6 targets (one per face). 'X' = "this face's color"; '?' = don't care.
    faceSolver = new GSolver([
      'XXXX????????????????????',
      '????XXXX????????????????',
      '????????XXXX????????????',
      '????????????XXXX????????',
      '????????????????XXXX????',
      '????????????????????XXXX',
    ], pocketMove, MOVES_2X2);
  }
  return faceSolver;
}

const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];

/** Solve the entire 2x2 cube optimally. Returns moves and length. */
export function solve2x2(scramble: string): { moves: string[]; length: number } {
  const state = applyScramble2x2(scramble);
  if (matches(state, SOLVED_2X2)) return { moves: [], length: 0 };
  const solver = getFullSolver();
  // 2x2 god's number (HTM, with all faces) is 11; with U/R/F only it's 14.
  const sol = solver.search(state, 0, 14);
  const moves = sol ?? [];
  return { moves, length: moves.length };
}

/** Solve each of the 6 faces (make that face one color) — mirrors cstimer's
 *  "2x2 Face" tool. Returns one entry per face. */
export function solve2x2Face(scramble: string): { face: string; moves: string[] }[] {
  const state = applyScramble2x2(scramble);
  const solver = getFaceSolver();
  const out: { face: string; moves: string[] }[] = [];
  for (let face = 0; face < 6; face++) {
    // Build a "partial state" where stickers matching this face's color
    // become 'X' and others become '?'. Search from this masked state to
    // any of the 6 face-solved targets — but cstimer searches FROM the
    // partial state. Using the gSolver convention (state mutates back to
    // a target), we feed the partial state directly.
    const faceColor = FACE_NAMES[face];
    const masked: string[] = [];
    for (let i = 0; i < 24; i++) {
      masked.push(state[i] === faceColor ? 'X' : '?');
    }
    const sol = solver.search(masked.join(''), 0, 11);
    out.push({ face: faceColor, moves: sol ?? [] });
  }
  return out;
}

// --- Self-test ---

export function __cube2x2SelfTest(): string {
  const scramble = "R U R' U' F' U F R2";
  const r = solve2x2(scramble);
  // Verify scramble + solve = solved
  let s = applyScramble2x2(scramble);
  for (const m of r.moves) s = pocketMove(s, m);
  if (!matches(s, SOLVED_2X2)) {
    throw new Error(`2x2 full solve failed: ${s}`);
  }
  const fr = solve2x2Face(scramble);
  if (fr.length !== 6) throw new Error(`expected 6 faces, got ${fr.length}`);
  // Verify each face solver's output makes the chosen color land on *some*
  // face entirely (per cstimer convention: the 6 targets allow placement on
  // any face — we just want all 4 stickers of the chosen color on one face).
  for (const { face, moves } of fr) {
    let st = applyScramble2x2(scramble);
    for (const m of moves) st = pocketMove(st, m);
    let foundFace = false;
    for (let f = 0; f < 6; f++) {
      const offset = f * 4;
      let allMatch = true;
      for (let i = 0; i < 4; i++) {
        if (st[offset + i] !== face) { allMatch = false; break; }
      }
      if (allMatch) { foundFace = true; break; }
    }
    if (!foundFace) {
      throw new Error(`2x2 face ${face} not monochrome on any face: ${st}`);
    }
  }
  return `OK 2x2: full=${r.length}, faces=${fr.map(f => `${f.face}:${f.moves.length}`).join(',')}`;
}
