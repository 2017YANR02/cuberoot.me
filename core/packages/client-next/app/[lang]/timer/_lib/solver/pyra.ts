/**
 * Pyraminx solver — facelet-string state of length 24 (6 stickers × 4 faces),
 * order F R L D. Ported from cstimer `gsolver.js` `pyraCube` block.
 *
 * Per-face indices (each face has 6 small-triangle stickers, 9 incl. centers
 * but cstimer stores only 6 — apparently grouping the visible sticker pieces
 * around the 3 corners and the center patch).
 *
 * Layout per face (cstimer comment, kept verbatim):
 *
 *   x504x x x504x
 *    132 231 132
 *     x x405x x
 *
 *      x504x
 *       132
 *        x
 *
 * Move convention: R U L B are the four corner moves (120° around a corner).
 * Tips (lower-case r u l b) act independently of the body and don't affect
 * the body solve — we strip them and append separately.
 *
 * Move suffix is just " " (CW, 120°) and "'" (CCW, 240°) — there is no
 * "2" amount because 2× a 120° move equals "'".
 */

import { GSolver, matches } from './gsolver';
import { parseScramble } from '../cube/moves';

// 24-char state: F R L D, 6 stickers each.
export const SOLVED_PYRA = 'FFFFFFRRRRRRLLLLLLDDDDDD';

const F0 = 0, F1 = 1, F2 = 2, F3 = 3, F4 = 4, F5 = 5;
const R0 = 6, R1 = 7, R2 = 8, R3 = 9, R4 = 10, R5 = 11;
const L0 = 12, L1 = 13, L2 = 14, L3 = 15, L4 = 16, L5 = 17;
const D0 = 18, D1 = 19, D2 = 20, D3 = 21, D4 = 22, D5 = 23;

// cstimer pyraCube cycles, verbatim (corner moves only — no tips).
const moveData: number[][][] = [
  [[F5, R3, D4], [F0, R1, D2], [F1, R2, D0]], // R
  [[F3, L4, R5], [F1, L2, R0], [F2, L0, R1]], // U
  [[F4, D5, L3], [F2, D0, L1], [F0, D1, L2]], // L
  [[R4, L5, D3], [R2, L0, D1], [R0, L1, D2]], // B
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

export function pyraMove(state: string, move: string): string {
  const idx = 'RULB'.indexOf(move[0]);
  if (idx < 0) return state;
  const swaps = moveData[idx];
  const suffix = move.length > 1 ? move[1] : ' ';
  // cstimer pow lookup: "? '"   →   ' '=1, '\''=2
  const pow = '? \''.indexOf(suffix);
  if (pow <= 0) return state;
  const ret = state.split('');
  for (const cyc of swaps) acycle(ret, cyc, pow);
  return ret.join('');
}

function appendPyraSuffix(moves: Record<string, number>): Record<string, number> {
  const ret: Record<string, number> = {};
  for (const m in moves) for (const s of " '") ret[m + s] = moves[m];
  return ret;
}

export const MOVES_PYRA: Record<string, number> = appendPyraSuffix({
  R: 0x00,
  U: 0x11,
  L: 0x22,
  B: 0x33,
});

// --- Tip handling ---
//
// Tips are attached to corners and rotate independently. Each tip has a
// 3-cycle of orientations (matching the body corner). To "fix" tip
// orientation we just emit the inverse rotation needed to bring it back.
//
// State: tip orientation per corner (R U L B), each ∈ {0, 1, 2}.
// Adding a tip move "u" increments tip U by 1; "u'" increments by 2.

type TipState = { R: number; U: number; L: number; B: number };

function fixTips(tips: TipState): string[] {
  const out: string[] = [];
  // Each tip needs to be rotated by (3 - tips[c]) % 3 in CW direction.
  for (const c of ['R', 'U', 'L', 'B'] as const) {
    const t = tips[c] % 3;
    if (t === 0) continue;
    const lc = c.toLowerCase();
    if (t === 1) out.push(lc + "'"); // current = CW1; need CCW1 to fix
    else if (t === 2) out.push(lc + ' '); // current = CW2; need CW1 to fix
  }
  return out;
}

// --- Scramble parsing ---

interface ParsedPyra {
  /** Body moves in cstimer two-char form ("R ", "R'", etc.). */
  body: string[];
  /** Final tip-orientation deltas after the scramble. */
  tips: TipState;
}

function parsePyraScramble(scramble: string): ParsedPyra {
  const body: string[] = [];
  const tips: TipState = { R: 0, U: 0, L: 0, B: 0 };
  // Pyraminx scrambles aren't covered by parseScramble's NxN logic, so we
  // re-tokenize directly. A token is a letter (RULBrulb) optionally followed
  // by an apostrophe. (Pyraminx never uses "2".)
  for (const tok of scramble.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([RULBrulb])('?)$/.exec(tok);
    if (!m) continue;
    const head = m[1];
    const prime = m[2] === "'";
    const isTip = head !== head.toUpperCase();
    if (isTip) {
      const corner = head.toUpperCase() as 'R' | 'U' | 'L' | 'B';
      tips[corner] = (tips[corner] + (prime ? 2 : 1)) % 3;
    } else {
      body.push(head + (prime ? "'" : ' '));
    }
  }
  // Also accept lowercase via parseScramble's tip path? Our parseScramble
  // skips Pyra tokens (returns empty). So the above is the source of truth.
  // But for completeness, run parseScramble too in case the user passed
  // something weird (it'll be a no-op for pyra strings).
  void parseScramble;
  return { body, tips };
}

/** Apply the scramble's body moves to the solved state. */
function applyPyraBody(body: string[]): string {
  let state = SOLVED_PYRA;
  for (const m of body) state = pyraMove(state, m);
  return state;
}

// --- Full solver (lazy singleton) ---

let fullSolver: GSolver | null = null;
function getFullSolver(): GSolver {
  if (!fullSolver) {
    fullSolver = new GSolver([SOLVED_PYRA], pyraMove, MOVES_PYRA);
  }
  return fullSolver;
}

// V-shape solver (cstimer "Pyraminx V") — the target the cstimer block uses
// is one face plus two stripes that form a V around it.
let vSolver: GSolver | null = null;
function getVSolver(): GSolver {
  if (!vSolver) {
    vSolver = new GSolver(
      ['????FF??RRR??L?L?L?DDDDD'],
      pyraMove,
      MOVES_PYRA,
    );
  }
  return vSolver;
}

/** Solve full Pyraminx (corner moves + final tip fixes). */
export function solvePyra(scramble: string): { moves: string[]; length: number } {
  const { body, tips } = parsePyraScramble(scramble);
  const state = applyPyraBody(body);
  let bodyMoves: string[] = [];
  if (!matches(state, SOLVED_PYRA)) {
    const solver = getFullSolver();
    // Pyraminx body god's number is 11; cap a bit higher for safety.
    const sol = solver.search(state, 0, 12);
    bodyMoves = sol ?? [];
  }
  const tipMoves = fixTips(tips);
  return {
    moves: [...bodyMoves, ...tipMoves],
    length: bodyMoves.length + tipMoves.length,
  };
}

/** Solve "Pyraminx V" — make one face's V-shape (around a chosen face)
 *  monochrome. Returns one entry per of the 4 faces (D, L, R, F) — mirrors
 *  cstimer's pyrv tool. */
export function solvePyraV(scramble: string): { face: string; moves: string[] }[] {
  const { body } = parsePyraScramble(scramble);
  const state = applyPyraBody(body);
  const solver = getVSolver();
  const faceStr = ['D', 'L', 'R', 'F'];
  const rawMap = 'RULB';
  const moveMaps = [
    ['RULB', 'LUBR', 'BURL'],
    ['URBL', 'LRUB', 'BRLU'],
    ['RLBU', 'ULRB', 'BLUR'],
    ['RBUL', 'UBLR', 'LBRU'],
  ];
  const out: { face: string; moves: string[] }[] = [];
  for (let i = 0; i < 4; i++) {
    let best: string[] | null = null;
    outer: for (let depth = 0; depth < 12; depth++) {
      for (let j = 0; j < 3; j++) {
        const moveMap = moveMaps[i][j];
        // Remap the body to a coordinate system where the chosen face is at
        // index 0 (D-face position in cstimer's V target).
        const remappedBody: string[] = body.map(b => {
          return rawMap[moveMap.indexOf(b[0])] + b[1];
        });
        let s = '????FF??RRR??L?L?L?DDDDD';
        for (const m of remappedBody) s = pyraMove(s, m);
        const sol = solver.search(s, depth, depth);
        if (sol) {
          // Map solution back to original notation.
          best = sol.map(m => moveMap[rawMap.indexOf(m[0])] + m[1]);
          break outer;
        }
      }
    }
    out.push({ face: faceStr[i], moves: best ?? [] });
    void state; // state computed but cstimer doesn't use it directly here
  }
  return out;
}

// --- Self-test ---

export function __pyraSelfTest(): string {
  const scramble = "R U' L B' R' U L' B u' r";
  const r = solvePyra(scramble);
  // Verify scramble + solve = solved (body part). For verification we need
  // to also apply tip moves to a pyra-state, but our tip handling works at
  // the scramble level — the body solver ignores tips, so verifying the
  // body alone is sufficient for correctness of body moves.
  const { body, tips } = parsePyraScramble(scramble);
  let s = applyPyraBody(body);
  // Apply only the body part of the result.
  const bodyOut = r.moves.filter(m => /^[RULB]/.test(m));
  for (const m of bodyOut) s = pyraMove(s, m);
  if (!matches(s, SOLVED_PYRA)) {
    throw new Error(`pyra body solve failed: ${s}`);
  }
  // Tips: every tip in result should bring orientation to 0.
  const tipOut = r.moves.filter(m => /^[rulb]/.test(m));
  const after = { ...tips };
  for (const t of tipOut) {
    const c = t[0].toUpperCase() as 'R' | 'U' | 'L' | 'B';
    after[c] = (after[c] + (t.includes("'") ? 2 : 1)) % 3;
  }
  if (after.R || after.U || after.L || after.B) {
    throw new Error(`pyra tips not fixed: ${JSON.stringify(after)}`);
  }
  const v = solvePyraV(scramble);
  return `OK Pyra: full=${r.length} (body=${bodyOut.length}+tips=${tipOut.length}); V=${v.map(x => `${x.face}:${x.moves.length}`).join(',')}`;
}
