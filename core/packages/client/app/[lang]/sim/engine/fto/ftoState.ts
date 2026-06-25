/**
 * FTO (Face-Turning Octahedron) state model + notation — a self-contained /sim world.
 *
 * A regular octahedron, 8 triangular faces, every face a ±120° turn. Deep cut: the cut
 * planes meet at each face's centre (cubing.js `o f 0.333` → cut at R_IN/3 along each face
 * normal). 42 visible pieces: 6 corners (octahedron vertices, 4 stickers each), 12 edges
 * (2 stickers), 24 centres (1 sticker, two orbits of 12). |G| ≈ 3.14×10²².
 *
 * NO discrete permutation/orientation state: each piece is a pivot whose quaternion is the
 * source of truth (geometry baked in home coords, turns are pure SO(3)). Which pieces a
 * face turn carries is read live from the geometry (a piece is in face f's cap iff
 * n_f · centre > CUT). `complete` is colour-aware (every sticker shows its face's colour),
 * which handles the indistinguishable centres. So this module is pure notation — no three.js.
 *
 * Face indexing/orientation matches the vendored PuzzleGeometry `FTO` (`get3d()` orientation:
 * U on +Y, D on −Y), so the cubing.js renderer and the in-house engine show the same pose and
 * the PG move bridge (ftoPgBridge.ts) is a trivial 1:1 by name. PG names the back face `BB`;
 * the engine displays the standard single letter `B` (FACE_TOKEN), mapping to `BB` only in the
 * bridge/colour lookup (FACE_PG).
 *
 * Notation: face letters U / F / L / R / B / BL / BR / D, optional `'`. Bare = the CLOCKWISE
 * 120° turn viewed from outside (dir −1), primed = its CCW inverse (dir +1) — same convention
 * as Dino/Rex so a single clockwise drag records the bare letter. Never fed to an external
 * solver, so it only has to be internally consistent (bare and primed are exact inverses).
 */

// ── 8 faces (index 0..7) ─────────────────────────────────────────────────────────
/** Engine display/parse tokens (standard FTO single letters; back = `B`). */
export const FACE_TOKEN = ['U', 'F', 'L', 'R', 'B', 'BL', 'BR', 'D'] as const;
/** PG face names (= colour-scheme keys + PG move names); back = `BB`. */
export const FACE_PG = ['U', 'F', 'L', 'R', 'BB', 'BL', 'BR', 'D'] as const;
export type FaceToken = typeof FACE_TOKEN[number];

const A = 1 / 3;
const B = (2 * Math.SQRT2) / 3;          // 0.942809
const C = Math.sqrt(2 / 3);              // 0.816497
const D = Math.SQRT2 / 3;                // 0.471405

/** Unit face normals in cubing.js's FTO orientation (U up +Y, D down −Y). Index ==
 *  FACE_TOKEN / FACE_PG. The 8 octahedron faces, rotated so U/D point along ±Y. */
export const FACE_NORMAL: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0],         // 0  U
  [0, -A, B],        // 1  F
  [-C, A, D],        // 2  L
  [C, A, D],         // 3  R
  [0, A, -B],        // 4  B  (PG: BB)
  [-C, -A, -D],      // 5  BL
  [C, -A, -D],       // 6  BR
  [0, -1, 0],        // 7  D
];

export interface FtoMove {
  /** Face index 0..7 (FACE_NORMAL / FACE_TOKEN / FACE_PG). */
  face: number;
  /** Physical twist about the OUTWARD face normal: −1 = −120° (clockwise from outside →
   *  the BARE token); +1 = +120° (CCW → the PRIMED token). */
  dir: 1 | -1;
}

// Longest tokens first so BL/BR match before the single letters.
const TOKEN_RE = /^(BL|BR|U|F|L|R|B|D)('?)$/;
const TOKEN_INDEX = new Map<string, number>(FACE_TOKEN.map((n, i) => [n, i]));

/** Parse a scramble/alg string into moves. Unknown tokens are skipped. */
export function parseFtoMoves(text: string): FtoMove[] {
  const out: FtoMove[] = [];
  for (const tok of text.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = TOKEN_RE.exec(tok);
    if (!m) continue;
    const face = TOKEN_INDEX.get(m[1]);
    if (face === undefined) continue;
    out.push({ face, dir: m[2] === "'" ? 1 : -1 });
  }
  return out;
}

/** One move → its canonical token (bare = clockwise dir −1; primed = CCW dir +1). Inverse
 *  of parseFtoMoves. */
export function ftoMoveToString(m: FtoMove): string {
  return FACE_TOKEN[m.face] + (m.dir === 1 ? "'" : '');
}

export function ftoMovesToString(moves: FtoMove[]): string {
  return moves.map(ftoMoveToString).join(' ');
}

export function invertFtoMoves(moves: FtoMove[]): FtoMove[] {
  return moves.slice().reverse().map((m) => ({ face: m.face, dir: (m.dir === 1 ? -1 : 1) as 1 | -1 }));
}

/** Collapse consecutive same-face turns (order-3) into a net 0/1/2 turns. */
export function reduceFtoMoves(moves: FtoMove[]): FtoMove[] {
  const out: FtoMove[] = [];
  let i = 0;
  while (i < moves.length) {
    let j = i;
    let net = 0;
    while (j < moves.length && moves[j].face === moves[i].face) {
      net = (net + (moves[j].dir === 1 ? 1 : 2)) % 3; // +1 = primed, −1 ≡ +2
      j++;
    }
    const f = moves[i].face;
    if (net === 1) out.push({ face: f, dir: 1 });
    else if (net === 2) out.push({ face: f, dir: -1 });
    // net 0 → cancels
    i = j;
  }
  return out;
}

export function reduceFtoAlg(text: string): string {
  return ftoMovesToString(reduceFtoMoves(parseFtoMoves(text)));
}

/** Random scramble: `n` face turns, never the same face twice in a row (a repeat would just
 *  compose). Each turn picks a random face + random direction. */
export function randomFtoScramble(n = 30): FtoMove[] {
  const out: FtoMove[] = [];
  let prev = -1;
  for (let i = 0; i < n; i++) {
    let f = Math.floor(Math.random() * 8);
    while (f === prev) f = Math.floor(Math.random() * 8);
    prev = f;
    out.push({ face: f, dir: Math.random() < 0.5 ? 1 : -1 });
  }
  return out;
}

export function randomFtoScrambleString(n = 30): string {
  return ftoMovesToString(randomFtoScramble(n));
}
