/**
 * Skewb solver — facelet-string state of length 30 (5 stickers × 6 faces),
 * order URFDLB. Ported from cstimer `gsolver.js` `skewbCube` block.
 *
 * Per-face indices (5 stickers each):
 *
 *     1 2     U
 *      0    LFRB
 *     3 4     D
 *
 *   0 = center, 1 = TL corner, 2 = TR, 3 = BL, 4 = BR
 *
 * Per-face start offsets:
 *   U:  0..4   R:  5..9   F: 10..14
 *   D: 15..19  L: 20..24  B: 25..29
 *
 * Move set: R U L B (4 axes; each is a 120° corner rotation). Skewb only has
 * 1 and ' (no 2× — "R2" reduces to "R'"). cstimer also defines r b x y
 * variants for the face solver; we don't need them for the full solve.
 */

import { GSolver, matches } from './gsolver';

export const SOLVED_SKEWB = 'UUUUURRRRRFFFFFDDDDDLLLLLBBBBB';

// Sticker indices kept for readability of the cycle tables below; the
// trailing `void` statements satisfy noUnusedLocals.
const U0=0, U1=1, U2=2, U3=3, U4=4, R0=5, R1=6, R2=7, R3=8, R4=9,
      F0=10, F1=11, F2=12, F3=13, F4=14, D0=15, D1=16, D2=17, D3=18, D4=19,
      L0=20, L1=21, L2=22, L3=23, L4=24, B0=25, B1=26, B2=27, B3=28, B4=29;
void U0; void U1; void U2; void U3; void U4; void R0; void R1; void R2; void R3; void R4;
void F0; void F1; void F2; void F3; void F4; void D0; void D1; void D2; void D3; void D4;
void L0; void L1; void L2; void L3; void L4; void B0; void B1; void B2; void B3; void B4;

// cstimer skewbCube cycles, verbatim. Order: R U L B (then r b x y variants
// which we keep but don't use in the move-tables list below).
const moveData: number[][][] = [
  [[R0, B0, D0], [R4, B3, D2], [R2, B4, D1], [R3, B1, D4], [L3, F4, U4]], // R
  [[U0, L0, B0], [U2, L1, B2], [U4, L2, B4], [U1, L3, B1], [D4, R2, F1]], // U
  [[F0, D0, L0], [F3, D3, L4], [F1, D1, L3], [F4, D4, L2], [B4, U1, R3]], // L
  [[B0, L0, D0], [B4, L3, D4], [B3, L1, D3], [B2, L4, D2], [F3, R4, U2]], // B
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

export function skewbMove(state: string, move: string): string {
  const idx = 'RULB'.indexOf(move[0]);
  if (idx < 0) return state;
  const swaps = moveData[idx];
  const suffix = move.length > 1 ? move[1] : ' ';
  // Skewb 120° rotations: pow lookup "? '" → ' '=1, '\''=2.
  const pow = '? \''.indexOf(suffix);
  if (pow <= 0) return state;
  const ret = state.split('');
  for (const cyc of swaps) acycle(ret, cyc, pow);
  return ret.join('');
}

function appendSkewbSuffix(moves: Record<string, number>): Record<string, number> {
  const ret: Record<string, number> = {};
  for (const m in moves) for (const s of " '") ret[m + s] = moves[m];
  return ret;
}

export const MOVES_SKEWB: Record<string, number> = appendSkewbSuffix({
  R: 0x00,
  U: 0x11,
  L: 0x22,
  B: 0x33,
});

// --- Scramble parsing ---
//
// WCA Skewb scrambles use R U L B with optional ' (and rarely 2 which we
// reduce to '). They're whitespace-separated tokens.

function parseSkewbScramble(scramble: string): string[] {
  const out: string[] = [];
  for (const tok of scramble.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([RULB])(2|'?)$/.exec(tok);
    if (!m) continue;
    const head = m[1];
    const amt = m[2];
    if (amt === '2' || amt === '') {
      // "R2" reduces to "R'" since 2× a 120° = 240° = 120° opposite.
      // But a literal "R" is just CW. If amt was "2" we map to "'".
      if (amt === '2') out.push(head + "'");
      else out.push(head + ' ');
    } else if (amt === "'") {
      out.push(head + "'");
    }
  }
  return out;
}

export function applySkewbScramble(scramble: string, start: string = SOLVED_SKEWB): string {
  let state = start;
  for (const m of parseSkewbScramble(scramble)) state = skewbMove(state, m);
  return state;
}

// --- Solvers (lazy singletons) ---

let fullSolver: GSolver | null = null;
function getFullSolver(): GSolver {
  if (!fullSolver) {
    fullSolver = new GSolver([SOLVED_SKEWB], skewbMove, MOVES_SKEWB);
  }
  return fullSolver;
}

// Face solver: for each face, the cstimer "Skewb Face" target asks for that
// face fully solved + the 4 adjacent face's two-corner stripes that face it.
// Targets verbatim from cstimer (face order U R F D L B):
const FACE_TARGETS = [
  'UUUUU?RR???FF????????LL???BB??',
  '???BBUUUUU??L?L?FF????????R?R?',
  '?B?B??R?R?UUUUU?F?F???L?L?????',
  '????????RR???BBUUUUU???LL???FF',
  '?BB????????R?R????FFUUUUU??L?L',
  '??F?F??R?R???????B?B?L?L?UUUUU',
];
const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];

let faceSolver: GSolver | null = null;
function getFaceSolver(): GSolver {
  if (!faceSolver) {
    // cstimer's face solver uses 4 oriented targets (with U-face up). We use
    // the per-face targets directly, one solver per target. Since each
    // search() call reuses pruning tables, we use a single GSolver with all
    // 6 targets so its pruning table covers all faces.
    faceSolver = new GSolver(FACE_TARGETS, skewbMove, MOVES_SKEWB);
  }
  return faceSolver;
}

/** Optimal full Skewb solve. */
export function solveSkewb(scramble: string): { moves: string[]; length: number } {
  const state = applySkewbScramble(scramble);
  if (matches(state, SOLVED_SKEWB)) return { moves: [], length: 0 };
  const solver = getFullSolver();
  // Skewb god's number is 11 in HTM (with 4 axes & 2 directions = 8 moves).
  const sol = solver.search(state, 0, 12);
  const moves = sol ?? [];
  return { moves, length: moves.length };
}

/** Solve each of the 6 faces (Skewb Face — make face + adjacent stripes
 *  match the cstimer target). Returns one entry per face. */
export function solveSkewbFace(scramble: string): { face: string; moves: string[] }[] {
  const state = applySkewbScramble(scramble);
  const solver = getFaceSolver();
  const out: { face: string; moves: string[] }[] = [];
  for (let i = 0; i < 6; i++) {
    // Per cstimer's convention, the solver state is the *target string*
    // permuted by the scramble — i.e., we apply the same scramble moves to
    // the target template and search for an inverse sequence.
    let templated = FACE_TARGETS[i];
    for (const m of parseSkewbScramble(scramble)) {
      templated = skewbMove(templated, m);
    }
    const sol = solver.search(templated, 0, 11);
    out.push({ face: FACE_NAMES[i], moves: sol ?? [] });
    void state;
  }
  return out;
}

// --- Self-test ---

export function __skewbSelfTest(): string {
  const scramble = "R U' L' B R' L U' B'";
  const r = solveSkewb(scramble);
  let s = applySkewbScramble(scramble);
  for (const m of r.moves) s = skewbMove(s, m);
  if (!matches(s, SOLVED_SKEWB)) {
    throw new Error(`skewb full solve failed: ${s}`);
  }
  const fr = solveSkewbFace(scramble);
  if (fr.length !== 6) throw new Error(`expected 6 faces, got ${fr.length}`);
  return `OK Skewb: full=${r.length}, faces=${fr.map(f => `${f.face}:${f.moves.length}`).join(',')}`;
}
