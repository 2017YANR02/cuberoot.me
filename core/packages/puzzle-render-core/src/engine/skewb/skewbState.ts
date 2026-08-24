/**
 * Skewb (斜转) state model + notation.
 *
 * The Skewb is a DEEP-cut corner-turning puzzle: a cube whose 4 cut planes pass
 * through the centre, each ⊥ a body diagonal. Pieces: 8 corners + 6 face centres.
 * There are 8 turning grips (one per cube corner); a twist is a ±120° rotation of
 * the cap on that corner's side of its plane — 4 corners (the grip corner spins in
 * place, 3 others 3-cycle) + 3 centres (3-cycle). The 8 corners split into two
 * orbits of 4 that never mix ({UFR,UBL,DFL,DBR} and {UFL,UBR,DFR,DBL}); the grip
 * corner is the one that spins, the 3 cycling corners come from the opposite orbit.
 *
 * All tables below are derived offline from the geometry (rot(axis,+120°) applied
 * to piece positions / sticker frames) by .tmp/skewb/derive.mjs and re-derived
 * independently in tests/skewb_state.test.ts — the runtime needs no rotation math.
 *
 * Notation — WCA / cubing.js. The 4 WCA scramble letters name one corner per body
 * diagonal (R=DRB, U=UBL, L=DLF, B=DBL); cubing.js's remaining families label the
 * opposite four (F=UFR, D=DFR, UL=ULF, UR=URB) so all 8 turnable grips have a token.
 * A bare token = a CLOCKWISE 120° twist viewed from outside (dir −1, −120° about the
 * outward diagonal) matching the WCA "bare letter = 120° clockwise"; a primed token
 * (R') = the CCW inverse (dir +1). This is the same corner frame + chirality as the
 * cubing.js skewb renderer, so the engine and cubing.js views agree move-for-move.
 * (CORNER_NAMES below stays the 3-face grip list; it drives the PG cap match + geometry,
 * separate from the WCA display tokens in SKEWB_WCA_TOKENS.)
 */
import { cornerMoveToString, type CornerMove } from '../cornerNotation';

/** Corner slot order (index 0..7), face order U/D, F/B, L/R. Doubles as the grip list.
 *  Drives geometry + the PG cap letter-set match — NOT the user-facing notation (that's
 *  SKEWB_WCA_TOKENS, same index order). */
export const CORNER_NAMES = [
  'UFR', 'UFL', 'UBR', 'UBL', 'DFR', 'DFL', 'DBR', 'DBL',
] as const;
export type CornerName = typeof CORNER_NAMES[number];

/** Centre slot order (index 0..5). */
export const CENTER_NAMES = ['U', 'D', 'F', 'B', 'R', 'L'] as const;
export type CenterName = typeof CENTER_NAMES[number];

/** Outward body diagonal (sign of x,y,z) for each corner/grip, same index as CORNER_NAMES. */
export const CORNER_AXIS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1],    // UFR
  [-1, 1, 1],   // UFL
  [1, 1, -1],   // UBR
  [-1, 1, -1],  // UBL
  [1, -1, 1],   // DFR
  [-1, -1, 1],  // DFL
  [1, -1, -1],  // DBR
  [-1, -1, -1], // DBL
];

/** Outward normal (sign of x,y,z) for each centre, same index as CENTER_NAMES. */
export const CENTER_AXIS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0],  // U
  [0, -1, 0], // D
  [0, 0, 1],  // F
  [0, 0, -1], // B
  [1, 0, 0],  // R
  [-1, 0, 0], // L
];

/**
 * For each grip g, the 3 OTHER corner slots it 3-cycles (in +120° flow order:
 * content of a→b, b→c, c→a). The grip corner g itself spins in place (CORNER_SPIN).
 */
export const CORNER_CYCLE: ReadonlyArray<readonly [number, number, number]> = [
  [1, 4, 2], // UFR
  [0, 3, 5], // UFL
  [0, 6, 3], // UBR
  [1, 2, 7], // UBL
  [0, 5, 6], // DFR
  [1, 7, 4], // DFL
  [2, 4, 7], // DBR
  [3, 6, 5], // DBL
];

/** For each grip g, the 3 centre slots it 3-cycles (+120° flow order a→b→c→a). */
export const CENTER_CYCLE: ReadonlyArray<readonly [number, number, number]> = [
  [0, 2, 4], // UFR: U→F→R
  [0, 5, 2], // UFL: U→L→F
  [0, 4, 3], // UBR: U→R→B
  [0, 3, 5], // UBL: U→B→L
  [1, 4, 2], // DFR: D→R→F
  [1, 2, 5], // DFL: D→F→L
  [1, 3, 4], // DBR: D→B→R
  [1, 5, 3], // DBL: D→L→B
];

/**
 * Orientation twist (mod 3) added to every cap corner — the spin corner AND the 3
 * cycling corners — by one +120° (dir +1) move about grip g. Orbit-A grips ({UFR,
 * UBL,DFL,DBR}) impart +1, orbit-B grips ({UFL,UBR,DFR,DBL}) impart +2. The inverse
 * (dir −1) move adds (3 − delta).
 */
export const CORNER_ORI_DELTA: ReadonlyArray<number> = [1, 2, 2, 1, 2, 1, 1, 2];

/**
 * A whole-cube reorientation (x / y / z). `rot` 0/1/2 = the x/y/z axis; `dir` 1 = the
 * bare quarter turn, −1 = prime, 2 = half turn. A rotation permutes NO piece — it only
 * re-holds the cube — so the discrete state is untouched; the engine carries the
 * reorientation on its render group's quaternion, exactly matching WCA / Sarah x·y·z.
 */
export interface SkewbRotMove { rot: 0 | 1 | 2; dir: 1 | -1 | 2; }

/** A Skewb move: a corner grip twist, or a whole-cube rotation. */
export type SkewbMove = CornerMove | SkewbRotMove;

/** Narrow a Skewb move to a whole-cube rotation. */
export function isSkewbRot(move: SkewbMove): move is SkewbRotMove {
  return 'rot' in move;
}

/**
 * Quarter-turn (bare, −90°) grip permutation for x / y / z: ROT_GRIP_TAU[axis][ℓ] = the
 * grip a WORLD-fixed letter ℓ drives after one bare rotation about that axis. Derived
 * offline (.tmp/skewb/derive_skewb_rot.mjs) by replicating SkewbCube.remapGrip's argmax
 * geometry — tau(ℓ) = argmax_g A_g·(R⁻¹·A_ℓ) over CORNER_AXIS — so this pure table cannot
 * drift from the engine's live geometric remap. The closed-loop bridge test re-certifies
 * table ≡ engine every run (a mismatch desyncs the PG mirror and the BSGS solve fails).
 * Each is order 4 (τ⁴ = id) and swaps the two corner orbits, as a 90° cube turn must.
 */
export const ROT_GRIP_TAU: ReadonlyArray<ReadonlyArray<number>> = [
  [4, 5, 0, 1, 6, 7, 2, 3], // x
  [2, 0, 3, 1, 6, 4, 7, 5], // y
  [1, 5, 3, 7, 0, 4, 2, 6], // z
];

/**
 * Advance a world-letter → physical-grip map across one whole-cube rotation. A bare turn
 * composes τ once, a prime three times (τ has order 4, so τ³ = τ⁻¹), a double twice; each
 * application is g2p'[ℓ] = g2p[τ[ℓ]]. This is the skewb analogue of the pyraminx's
 * rotateLetterMap — the PG bridge folds rotations through it so the group mirror stays
 * faithful across reorientations (`y R y' R'` correctly stays scrambled), instead of the
 * old shortcut that dropped rotations and falsely cancelled such sequences to solved.
 */
export function rotateGripMap(
  g2p: ReadonlyArray<number>, rot: 0 | 1 | 2, dir: 1 | -1 | 2,
): number[] {
  const t = ROT_GRIP_TAU[rot];
  const n = dir === 1 ? 1 : dir === -1 ? 3 : 2;
  let m = g2p.slice();
  for (let i = 0; i < n; i++) { const prev = m; m = prev.map((_, l) => prev[t[l]]); }
  return m;
}

export interface SkewbState {
  /** cornerPerm[slot] = corner pieceId currently in that slot. */
  cornerPerm: number[];
  /** cornerOri[slot] = orientation (0/1/2) of the corner piece in that slot. */
  cornerOri: number[];
  /** centerPerm[slot] = centre pieceId currently in that slot. */
  centerPerm: number[];
}

export function solvedSkewb(): SkewbState {
  return {
    cornerPerm: Array.from({ length: 8 }, (_, i) => i),
    cornerOri: new Array(8).fill(0),
    centerPerm: Array.from({ length: 6 }, (_, i) => i),
  };
}

/**
 * Apply one move, returning a new state. dir +1 = +120° about the grip's outward
 * diagonal (tables as derived); dir −1 = the inverse (reverse 3-cycles, delta 3−d).
 */
export function applySkewbMove(state: SkewbState, move: SkewbMove): SkewbState {
  // A whole-cube rotation re-holds the puzzle without permuting any piece — the engine
  // carries the reorientation on its render group, so the discrete state is unchanged.
  if (isSkewbRot(move)) {
    return {
      cornerPerm: state.cornerPerm.slice(),
      cornerOri: state.cornerOri.slice(),
      centerPerm: state.centerPerm.slice(),
    };
  }
  const g = move.corner;
  const [a, b, c] = CORNER_CYCLE[g];
  const [pa, pb, pc] = CENTER_CYCLE[g];
  const dRaw = CORNER_ORI_DELTA[g];
  const d = move.dir === 1 ? dRaw : (3 - dRaw) % 3;

  const cornerPerm = state.cornerPerm.slice();
  const cornerOri = state.cornerOri.slice();
  const centerPerm = state.centerPerm.slice();

  // grip corner spins in place: same piece, +d orientation.
  cornerOri[g] = (state.cornerOri[g] + d) % 3;

  if (move.dir === 1) {
    // corners: a→b, b→c, c→a, each +d ori
    cornerPerm[b] = state.cornerPerm[a]; cornerOri[b] = (state.cornerOri[a] + d) % 3;
    cornerPerm[c] = state.cornerPerm[b]; cornerOri[c] = (state.cornerOri[b] + d) % 3;
    cornerPerm[a] = state.cornerPerm[c]; cornerOri[a] = (state.cornerOri[c] + d) % 3;
    // centres: a→b, b→c, c→a (no orientation)
    centerPerm[pb] = state.centerPerm[pa];
    centerPerm[pc] = state.centerPerm[pb];
    centerPerm[pa] = state.centerPerm[pc];
  } else {
    // inverse: a←b, b←c, c←a
    cornerPerm[a] = state.cornerPerm[b]; cornerOri[a] = (state.cornerOri[b] + d) % 3;
    cornerPerm[b] = state.cornerPerm[c]; cornerOri[b] = (state.cornerOri[c] + d) % 3;
    cornerPerm[c] = state.cornerPerm[a]; cornerOri[c] = (state.cornerOri[a] + d) % 3;
    centerPerm[pa] = state.centerPerm[pb];
    centerPerm[pb] = state.centerPerm[pc];
    centerPerm[pc] = state.centerPerm[pa];
  }

  return { cornerPerm, cornerOri, centerPerm };
}

export function isSolved(state: SkewbState): boolean {
  for (let i = 0; i < 8; i++) if (state.cornerPerm[i] !== i || state.cornerOri[i] !== 0) return false;
  for (let i = 0; i < 6; i++) if (state.centerPerm[i] !== i) return false;
  return true;
}

/**
 * WCA / cubing.js token per grip, in CORNER_NAMES index order. R/U/L/B are the four
 * WCA scramble letters (one corner per axis); F/D/UL/UR label the opposite four so
 * every draggable grip records a valid cubing.js token.
 *   0 UFR→F  1 UFL→UL  2 UBR→UR  3 UBL→U  4 DFR→D  5 DFL→L  6 DBR→R  7 DBL→B
 */
const SKEWB_WCA_TOKENS = ['F', 'UL', 'UR', 'U', 'D', 'L', 'R', 'B'] as const;

/** The four axis corners a WCA scramble draws from (R U L B = grips 6 3 5 7). */
const WCA_SCRAMBLE_GRIPS = [6, 3, 5, 7] as const;

// Two-letter families (UL/UR) come first so the alternation matches them before U.
const TOKEN_RE = /^(UL|UR|U|F|D|L|R|B)('?)$/;
// Whole-cube rotations x / y / z, optionally primed or doubled.
const ROT_RE = /^([xyz])(['2]?)$/;

/** Parse a scramble/alg string into moves — corner grips (WCA tokens) and whole-cube
 *  rotations (x / x' / x2). Unknown tokens are skipped. */
export function parseSkewbMoves(text: string): SkewbMove[] {
  const out: SkewbMove[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    if (!raw) continue;
    const r = ROT_RE.exec(raw);
    if (r) {
      out.push({
        rot: (r[1] === 'x' ? 0 : r[1] === 'y' ? 1 : 2) as 0 | 1 | 2,
        dir: r[2] === '2' ? 2 : r[2] === "'" ? -1 : 1,
      });
      continue;
    }
    const m = TOKEN_RE.exec(raw);
    if (!m) continue;
    const corner = SKEWB_WCA_TOKENS.indexOf(m[1] as typeof SKEWB_WCA_TOKENS[number]);
    if (corner >= 0) out.push({ corner, dir: m[2] ? 1 : -1 });
  }
  return out;
}

/** Render one move to its canonical token — grip (bare = clockwise dir −1, primed = dir
 *  +1) or rotation (x / x' / x2). Exact inverse of parseSkewbMoves. */
export function skewbMoveToString(move: SkewbMove): string {
  if (isSkewbRot(move)) {
    return 'xyz'[move.rot] + (move.dir === 2 ? '2' : move.dir === -1 ? "'" : '');
  }
  return cornerMoveToString(move, SKEWB_WCA_TOKENS);
}

export function skewbMovesToString(moves: SkewbMove[]): string {
  return moves.map(skewbMoveToString).join(' ');
}

/** Random WCA scramble: `n` twists over the 4 axis corners (R U L B), never the same
 *  corner twice in a row — only the four WCA letters appear, like a real skewb scramble.
 *  (Manual solving can still turn any of the 8 corners; those record F/D/UL/UR.) */
export function randomSkewbScramble(n = 12): CornerMove[] {
  const out: CornerMove[] = [];
  let last = -1;
  for (let i = 0; i < n; i++) {
    let g: number;
    do { g = WCA_SCRAMBLE_GRIPS[Math.floor(Math.random() * WCA_SCRAMBLE_GRIPS.length)]; }
    while (g === last);
    last = g;
    out.push({ corner: g, dir: Math.random() < 0.5 ? 1 : -1 });
  }
  return out;
}

/** Apply a whole scramble to solved and return the resulting state. */
export function applySkewbScramble(moves: SkewbMove[]): SkewbState {
  let state = solvedSkewb();
  for (const m of moves) state = applySkewbMove(state, m);
  return state;
}
