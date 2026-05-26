/** Megaminx state — physically-correct port of cstimer's mathlib.minx.doMove.
 *
 * Internal model (matches cstimer src/js/lib/mathlib.js lines 850-922):
 *
 *   12 faces × 11 stickers = 132 ints. state[face*11 + i].
 *   Per-face layout: i = 0..4  → 5 corner stickers
 *                    i = 5..9  → 5 edge stickers
 *                    i = 10    → center
 *   Face indices:    U=0  R=1  F=2  L=3  BL=4  BR=5
 *                    DR=6 DL=7 DBL=8 B=9  DBR=10 D=11
 *
 * Scramble notation we accept (WCA Pochmann + cstimer extensions):
 *   U / U' / U2                — single-face U turns (wide=0)
 *   R++ / R-- / D++ / D--      — Pochmann two-layer turns (wide=2)
 *
 * Per cstimer/src/js/twisty/qcubeminx.js line 130-132 + 192-194:
 *   The token symbols D, L, R use 'D?L??R'.indexOf(c) → 0/2/5, then
 *   axis2move = [U, F, R, BR, BL, L, D, ...] picks the actual rotation axis.
 *   So R++ rotates axis L (=3), D++ rotates axis U (=0), L++ rotates axis R (=1).
 *   pow sign flips: '++' yields pow = -2, '--' yields pow = +2 (multiplied
 *   by token length, which is always 2 for double-plus/double-minus).
 *
 * Public API exported here:
 *   - applyMegaScramble(scramble) → MegaState
 *   - megaSolved() → MegaState
 *   - MegaFace, MegaSticker types
 *   - __megaSelfCheck() for tests
 *
 * MegaState is a Record<MegaFace, MegaSticker[]> where MegaFace uses cstimer's
 * 12 names. Per face: array of length 11 indexed [0..4]=corners, [5..9]=edges,
 * [10]=center, exactly as the internal flat array. (Originally consumed by a
 * homemade MegaminxNet renderer — now only used by solver/mega.ts; the live
 * scramble preview goes through cubing.js's TwistyPlayer.)
 */

export type MegaFace =
  | 'U' | 'R' | 'F' | 'L' | 'BL' | 'BR'
  | 'DR' | 'DL' | 'DBL' | 'B' | 'DBR' | 'D';
export type MegaSticker = MegaFace;
export type MegaState = Record<MegaFace, MegaSticker[]>;

// Face index assignment (must match cstimer mathlib.js line 851).
const U = 0, R = 1, F = 2, L = 3, BL = 4, BR = 5;
const DR = 6, DL = 7, DBL = 8, B = 9, DBR = 10, D = 11;

const FACES: readonly MegaFace[] = ['U', 'R', 'F', 'L', 'BL', 'BR', 'DR', 'DL', 'DBL', 'B', 'DBR', 'D'];

// mathlib.js line 852.
const oppFace: readonly number[] = [D, DBL, B, DBR, DR, DL, BL, BR, R, F, L, U];

// mathlib.js line 853-866. Each entry is the 5 faces adjacent to that face,
// in a fixed cyclic order (cstimer's CCW-when-looking-at-face convention).
const adjFaces: readonly (readonly number[])[] = [
  [BR, R, F, L, BL],   // U
  [DBR, DR, F, U, BR], // R
  [DR, DL, L, U, R],   // F
  [DL, DBL, BL, U, F], // L
  [DBL, B, BR, U, L],  // BL
  [B, DBR, R, U, BL],  // BR
  [D, DL, F, R, DBR],  // DR
  [D, DBL, L, F, DR],  // DL
  [D, B, BL, L, DL],   // DBL
  [D, DBR, BR, BL, DBL], // B
  [D, DR, R, BR, B],   // DBR
  [DR, DBR, B, DBL, DL], // D
];

// Cyclic shift: arr[perm[(i + pow) mod plen]] = old arr[perm[i]].
// Mirrors mathlib.js function acycle (line 58).
function acycle(arr: number[], perm: number[], pow: number): void {
  const plen = perm.length;
  const tmp = new Array<number>(plen);
  for (let i = 0; i < plen; i++) tmp[i] = arr[perm[i]];
  for (let i = 0; i < plen; i++) {
    const j = (i + pow) % plen;
    arr[perm[j]] = tmp[i];
  }
}

// Direct port of mathlib.js doMove (line 870-915).
// state: number[132]; face: 0..11; pow: integer (will be reduced mod 5);
// wide: 0=single layer, 1=all (wide_x), 2=all-but-single (Pochmann ++/--).
function doMinxMove(state: number[], face: number, pow: number, wide: number): void {
  pow = ((pow % 5) + 5) % 5;
  if (pow === 0) return;
  const base = face * 11;
  const swaps: number[][] = [[], [], [], [], []];
  for (let i = 0; i < 5; i++) {
    const aface = adjFaces[face][i];
    const ridx = adjFaces[aface].indexOf(face);
    if (wide === 0 || wide === 1) {
      swaps[i].push(
        base + i,
        base + i + 5,
        aface * 11 + (ridx % 5) + 5,
        aface * 11 + (ridx % 5),
        aface * 11 + ((ridx + 1) % 5),
      );
    }
    if (wide === 1 || wide === 2) {
      swaps[i].push(aface * 11 + 10);
      for (let j = 1; j < 5; j++) {
        swaps[i].push(aface * 11 + ((ridx + j) % 5) + 5);
      }
      for (let j = 2; j < 5; j++) {
        swaps[i].push(aface * 11 + ((ridx + j) % 5));
      }
      const ii = 4 - i;
      const opp = oppFace[face];
      const oaface = adjFaces[opp][ii];
      const oridx = adjFaces[oaface].indexOf(opp);
      swaps[i].push(
        opp * 11 + ii,
        opp * 11 + ii + 5,
        oaface * 11 + 10,
      );
      for (let j = 0; j < 5; j++) {
        swaps[i].push(
          oaface * 11 + ((oridx + j) % 5) + 5,
          oaface * 11 + ((oridx + j) % 5),
        );
      }
    }
  }
  for (let k = 0; k < swaps[0].length; k++) {
    acycle(state, [swaps[0][k], swaps[1][k], swaps[2][k], swaps[3][k], swaps[4][k]], pow);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function makeSolvedFlat(): number[] {
  const s = new Array<number>(132);
  for (let f = 0; f < 12; f++) for (let i = 0; i < 11; i++) s[f * 11 + i] = f;
  return s;
}

function flatToState(flat: number[]): MegaState {
  const out = {} as MegaState;
  for (let f = 0; f < 12; f++) {
    const arr: MegaSticker[] = new Array<MegaSticker>(11);
    for (let i = 0; i < 11; i++) arr[i] = FACES[flat[f * 11 + i]];
    out[FACES[f]] = arr;
  }
  return out;
}

/** Solved state. */
export function megaSolved(): MegaState {
  return flatToState(makeSolvedFlat());
}

/** Apply one Pochmann-notation token to a flat state. */
function applyTokenFlat(state: number[], raw: string): void {
  if (!raw) return;
  // Single-face U.
  if (raw === 'U') return doMinxMove(state, U, -1, 0);
  if (raw === "U'") return doMinxMove(state, U, 1, 0);
  if (raw === 'U2') return doMinxMove(state, U, -2, 0);
  if (raw === "U2'") return doMinxMove(state, U, 2, 0);
  // Pochmann two-layer turns. Mapping per qcubeminx.js parser:
  //   prefix → axis2move index : D→0, L→2, R→5
  //   axis2move = [U, F, R, BR, BL, L, D, ...] → applied face: D→U, L→R, R→L
  //   pow: '++' → -1 * 2 = -2;  '--' → +1 * 2 = +2
  // We accept R++/R--/D++/D-- and (for completeness) L++/L-- as well.
  const m = /^([DLR])(\+\+|--)$/.exec(raw);
  if (m) {
    const prefix = m[1];
    const sign = m[2][0] === '+' ? -1 : 1;
    const pow = sign * 2;
    let axisFace: number;
    if (prefix === 'D') axisFace = U;
    else if (prefix === 'L') axisFace = R;
    else axisFace = L; // 'R'
    return doMinxMove(state, axisFace, pow, 2);
  }
  // Unknown token: ignore (keeps line breaks etc. harmless).
}

export function applyMegaScramble(scramble: string): MegaState {
  const flat = makeSolvedFlat();
  if (scramble) {
    for (const t of scramble.split(/\s+/).filter(Boolean)) applyTokenFlat(flat, t);
  }
  return flatToState(flat);
}

// ---------------------------------------------------------------------------
// Self-check
// ---------------------------------------------------------------------------

function flatEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function applyScrambleFlat(s: number[], scramble: string): void {
  for (const t of scramble.split(/\s+/).filter(Boolean)) applyTokenFlat(s, t);
}

function invertScramble(scramble: string): string {
  const out: string[] = [];
  for (const t of scramble.split(/\s+/).filter(Boolean)) {
    if (t === 'U') out.unshift("U'");
    else if (t === "U'") out.unshift('U');
    else if (t === 'U2' || t === "U2'") out.unshift(t);
    else {
      const m = /^([DLR])(\+\+|--)$/.exec(t);
      if (m) out.unshift(m[1] + (m[2] === '++' ? '--' : '++'));
      else out.unshift(t);
    }
  }
  return out.join(' ');
}

function randomScramble(rng: () => number, n: number): string {
  const tokens: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = rng();
    if (r < 0.25) tokens.push('R++');
    else if (r < 0.5) tokens.push('R--');
    else if (r < 0.75) tokens.push('D++');
    else tokens.push('D--');
    if (rng() < 0.2) tokens.push(rng() < 0.5 ? 'U' : "U'");
  }
  return tokens.join(' ');
}

function megaSelfCheck(): boolean {
  const checks: Array<[string, () => boolean]> = [
    ['solved is solved', () => {
      const s = makeSolvedFlat();
      return flatEqual(s, makeSolvedFlat());
    }],
    ['U U\' = id', () => {
      const s = makeSolvedFlat();
      applyScrambleFlat(s, "U U'");
      return flatEqual(s, makeSolvedFlat());
    }],
    ['U^5 = id', () => {
      const s = makeSolvedFlat();
      applyScrambleFlat(s, 'U U U U U');
      return flatEqual(s, makeSolvedFlat());
    }],
    ['R++ R-- = id', () => {
      const s = makeSolvedFlat();
      applyScrambleFlat(s, 'R++ R--');
      return flatEqual(s, makeSolvedFlat());
    }],
    ['D++ D-- = id', () => {
      const s = makeSolvedFlat();
      applyScrambleFlat(s, 'D++ D--');
      return flatEqual(s, makeSolvedFlat());
    }],
    ['(R++)^5 = id', () => {
      const s = makeSolvedFlat();
      applyScrambleFlat(s, 'R++ R++ R++ R++ R++');
      return flatEqual(s, makeSolvedFlat());
    }],
    ['(D++)^5 = id', () => {
      const s = makeSolvedFlat();
      applyScrambleFlat(s, 'D++ D++ D++ D++ D++');
      return flatEqual(s, makeSolvedFlat());
    }],
    ['R++ scramble non-trivial', () => {
      const s = makeSolvedFlat();
      applyScrambleFlat(s, 'R++');
      return !flatEqual(s, makeSolvedFlat());
    }],
    ['D++ scramble non-trivial', () => {
      const s = makeSolvedFlat();
      applyScrambleFlat(s, 'D++');
      return !flatEqual(s, makeSolvedFlat());
    }],
    ['random scramble + inverse = id', () => {
      // Deterministic LCG so the assertion is reproducible.
      let seed = 1234567;
      const rng = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let trial = 0; trial < 5; trial++) {
        const scr = randomScramble(rng, 30);
        const inv = invertScramble(scr);
        const s = makeSolvedFlat();
        applyScrambleFlat(s, scr);
        applyScrambleFlat(s, inv);
        if (!flatEqual(s, makeSolvedFlat())) return false;
      }
      return true;
    }],
    ['adjFaces is involutive (each adjacency appears in opposite face\'s list)', () => {
      for (let f = 0; f < 12; f++) {
        for (const a of adjFaces[f]) {
          if (adjFaces[a].indexOf(f) < 0) return false;
        }
      }
      return true;
    }],
    ['oppFace is involutive', () => {
      for (let f = 0; f < 12; f++) {
        if (oppFace[oppFace[f]] !== f) return false;
      }
      return true;
    }],
  ];
  let allOk = true;
  for (const [name, fn] of checks) {
    const ok = fn();
    if (!ok) {
      allOk = false;
      // eslint-disable-next-line no-console
      console.assert(false, `[megaminx_state] invariant failed: ${name}`);
    }
  }
  return allOk;
}

// Run once at module load.
megaSelfCheck();

/** Exported for explicit test harness use. Returns true iff all invariants hold. */
export function __megaSelfCheck(): boolean {
  return megaSelfCheck();
}
