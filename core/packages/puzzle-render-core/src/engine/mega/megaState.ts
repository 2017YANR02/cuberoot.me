/**
 * Megaminx (megaminx) state model + notation.
 *
 * A face-turning regular dodecahedron: 12 pentagonal faces, 20 corner pieces (ℤ₃ twist),
 * 30 edge pieces (ℤ₂ flip), 12 fixed centers (no visible orientation). One face turn is a
 * 72° rotation of that face's shallow shell — a single 5-cycle of its 5 corners AND a
 * single 5-cycle of its 5 edges (centers fixed). |G| = 30!·20!·2²⁷·3¹⁹ ≈ 1.01×10⁶⁸.
 *
 * Indexing is aligned to the vendored cubing.js puzzle-geometry `megaminx` so the
 * engine-face → PG-move bridge is a trivial 1:1 by index (see megaPgBridge.ts):
 *   • FACE_NORMAL[f] == pg.get3d().axis[f] direction (U on +Y, D on −Y),
 *   • FACE_NAME == pg face order ["U","F","L","BL","BR","R","C","A","I","BF","E","D"].
 *
 * The combinatorial tables (which 5 corners/edges each face cycles, and the per-step
 * twist/flip deltas) were derived offline from the dodecahedron geometry and validated
 * (.tmp/mega/derive.mjs: every face turn⁵ = identity, move·inverse = solved, twist sum
 * ≡0 mod 3 / flip sum ≡0 mod 2 per turn, 200 random sequences round-trip, perms even);
 * locked here so the runtime needs no rotation math to apply a discrete move. A second,
 * independent certification runs against the SOURCE group in tests/mega_pg_bridge.test.ts
 * (engine-solved ⇔ PG-identity across random sequences).
 */

/** PG face order; FACE_NAME[f] is the engine face f's token + PG move name. */
export const FACE_NAME = ['U', 'F', 'L', 'BL', 'BR', 'R', 'C', 'A', 'I', 'BF', 'E', 'D'] as const;
export type FaceName = typeof FACE_NAME[number];

// 12 face normals in PG's orientation: U/D on ±Y, two staggered rings of 5 at y=±1/√5
// (horizontal radius 2/√5), azimuth 72° apart, ring2 offset 36°.
const RT5 = Math.sqrt(5);
const RY = 1 / RT5, RR = 2 / RT5;
const ring = (y: number, azDeg: number): [number, number, number] => {
  const a = (azDeg * Math.PI) / 180;
  return [RR * Math.cos(a), y, RR * Math.sin(a)];
};
export const FACE_NORMAL: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0],            // 0  U
  ring(RY, 90),         // 1  F
  ring(RY, 162),        // 2  L
  ring(RY, 234),        // 3  BL
  ring(RY, 306),        // 4  BR
  ring(RY, 18),         // 5  R
  ring(-RY, 54),        // 6  C
  ring(-RY, 126),       // 7  A
  ring(-RY, 198),       // 8  I
  ring(-RY, 270),       // 9  BF
  ring(-RY, 342),       // 10 E
  [0, -1, 0],           // 11 D
];

/** Each corner's 3 faces (sorted), index 0..19. */
export const CORNER_FACES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [0, 1, 5], [0, 2, 3], [0, 3, 4], [0, 4, 5], [1, 2, 7], [1, 5, 6], [1, 6, 7],
  [2, 3, 8], [2, 7, 8], [3, 4, 9], [3, 8, 9], [4, 5, 10], [4, 9, 10], [5, 6, 10], [6, 7, 11],
  [6, 10, 11], [7, 8, 11], [8, 9, 11], [9, 10, 11],
];

/** Each edge's 2 faces (sorted), index 0..29. */
export const EDGE_FACES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 5], [1, 6], [1, 7], [2, 3], [2, 7], [2, 8],
  [3, 4], [3, 8], [3, 9], [4, 5], [4, 9], [4, 10], [5, 6], [5, 10], [6, 7], [6, 10], [6, 11],
  [7, 8], [7, 11], [8, 9], [8, 11], [9, 10], [9, 11], [10, 11],
];

/** For each face, its 5 corner slots in CCW(-from-outside) ring order. A +1 turn advances
 *  a piece from ring position i to i+1 (mod 5) — so this array IS the corner 5-cycle. */
export const FACE_CORNERS: ReadonlyArray<readonly number[]> = [
  [0, 2, 3, 4, 1], [6, 7, 5, 0, 1], [5, 9, 8, 2, 0], [8, 11, 10, 3, 2], [10, 13, 12, 4, 3],
  [12, 14, 6, 1, 4], [16, 15, 7, 6, 14], [15, 17, 9, 5, 7], [17, 18, 11, 8, 9],
  [18, 19, 13, 10, 11], [19, 16, 14, 12, 13], [18, 17, 15, 16, 19],
];

/** Per-step corner twist delta (ℤ₃) applied as a corner advances one ring step under a
 *  +1 turn. CORNER_TWIST[f][i] is added when ring i → ring i+1 on face f. */
export const CORNER_TWIST: ReadonlyArray<readonly number[]> = [
  [0, 0, 0, 0, 0], [0, 0, 2, 2, 2], [2, 0, 2, 2, 0], [2, 0, 2, 2, 0], [2, 0, 2, 2, 0],
  [2, 2, 0, 2, 0], [0, 2, 2, 0, 2], [2, 2, 0, 2, 0], [2, 2, 0, 2, 0], [2, 2, 0, 2, 0],
  [1, 0, 0, 2, 0], [0, 0, 2, 1, 0],
];

/** For each face, its 5 edge slots in CCW ring order (= the edge 5-cycle). */
export const FACE_EDGES: ReadonlyArray<readonly number[]> = [
  [0, 1, 2, 3, 4], [7, 8, 5, 0, 6], [10, 11, 9, 1, 5], [13, 14, 12, 2, 9], [16, 17, 15, 3, 12],
  [19, 18, 6, 4, 15], [21, 22, 20, 7, 18], [20, 24, 23, 10, 8], [23, 26, 25, 13, 11],
  [25, 28, 27, 16, 14], [27, 29, 21, 19, 17], [28, 26, 24, 22, 29],
];

/** Per-step edge flip delta (ℤ₂) applied as an edge advances one ring step under a +1 turn. */
export const EDGE_FLIP: ReadonlyArray<readonly number[]> = [
  [0, 0, 0, 0, 0], [0, 0, 1, 1, 0], [0, 0, 1, 0, 1], [0, 0, 1, 0, 1], [0, 0, 1, 0, 1],
  [0, 1, 0, 0, 1], [0, 0, 1, 0, 1], [1, 0, 1, 0, 0], [1, 0, 1, 0, 0], [1, 0, 1, 0, 0],
  [1, 1, 0, 0, 0], [0, 0, 0, 0, 0],
];

// ── piece directions (unit), derived from the face normals (norm of incident sum) ──
const vsum = (faces: readonly number[]): [number, number, number] => {
  let x = 0, y = 0, z = 0;
  for (const f of faces) { x += FACE_NORMAL[f][0]; y += FACE_NORMAL[f][1]; z += FACE_NORMAL[f][2]; }
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
/** Unit direction toward each corner (dodeca vertex), index 0..19. */
export const CORNER_DIR: ReadonlyArray<readonly [number, number, number]> = CORNER_FACES.map(vsum);
/** Unit direction toward each edge midpoint, index 0..29. */
export const EDGE_DIR: ReadonlyArray<readonly [number, number, number]> = EDGE_FACES.map(vsum);

// ── state ──────────────────────────────────────────────────────────────────────
export interface MegaMove {
  /** Face index 0..11 (FACE_NORMAL / FACE_NAME). */
  face: number;
  /** +1 = the bare token's 72° turn; -1 = its primed inverse. (Which physical sense is
   *  +1 is fixed by the engine's rotation in MegaminxCube; the bridge pins how it maps to
   *  PG's move direction.) */
  dir: 1 | -1;
}

/** Full discrete state: corner perm+twist (20), edge perm+flip (30). */
export interface MegaState {
  cp: number[]; co: number[]; ep: number[]; eo: number[];
}

export function solvedMega(): MegaState {
  return {
    cp: Array.from({ length: 20 }, (_, i) => i), co: new Array(20).fill(0),
    ep: Array.from({ length: 30 }, (_, i) => i), eo: new Array(30).fill(0),
  };
}

/** Apply one face turn, returning a new state. dir +1 advances each ring i→i+1. */
export function applyMegaMove(s: MegaState, m: MegaMove): MegaState {
  const o: MegaState = { cp: s.cp.slice(), co: s.co.slice(), ep: s.ep.slice(), eo: s.eo.slice() };
  const cc = FACE_CORNERS[m.face], tw = CORNER_TWIST[m.face];
  const ec = FACE_EDGES[m.face], fl = EDGE_FLIP[m.face];
  if (m.dir === 1) {
    for (let i = 0; i < 5; i++) {
      const a = cc[i], b = cc[(i + 1) % 5];
      o.cp[b] = s.cp[a]; o.co[b] = (s.co[a] + tw[i]) % 3;
    }
    for (let i = 0; i < 5; i++) {
      const a = ec[i], b = ec[(i + 1) % 5];
      o.ep[b] = s.ep[a]; o.eo[b] = (s.eo[a] + fl[i]) % 2;
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const a = cc[i], b = cc[(i + 1) % 5];
      o.cp[a] = s.cp[b]; o.co[a] = (s.co[b] - tw[i] + 3) % 3;
    }
    for (let i = 0; i < 5; i++) {
      const a = ec[i], b = ec[(i + 1) % 5];
      o.ep[a] = s.ep[b]; o.eo[a] = (s.eo[b] - fl[i] + 2) % 2;
    }
  }
  return o;
}

export function isSolved(s: MegaState): boolean {
  for (let i = 0; i < 20; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 0; i < 30; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

export function applyMegaScramble(moves: MegaMove[]): MegaState {
  let s = solvedMega();
  for (const m of moves) s = applyMegaMove(s, m);
  return s;
}

/**
 * Random scramble: `n` face turns, never the same face twice in a row (a repeat would
 * just compose). Each turn picks a random face + random direction.
 */
export function randomMegaScramble(n = 30): MegaMove[] {
  const out: MegaMove[] = [];
  let prev = -1;
  for (let i = 0; i < n; i++) {
    let f = Math.floor(Math.random() * 12);
    while (f === prev) f = Math.floor(Math.random() * 12);
    prev = f;
    out.push({ face: f, dir: Math.random() < 0.5 ? 1 : -1 });
  }
  return out;
}

// ── notation (PG face names + optional prime; self-contained /sim world) ──────────
// Longest names first so BL/BR/BF match before single letters.
const TOKEN_RE = /^(BL|BR|BF|U|F|L|R|C|A|I|E|D)('?)$/;
const NAME_INDEX = new Map<string, number>(FACE_NAME.map((n, i) => [n, i]));

/** Parse a scramble/alg string into moves. Unknown tokens are skipped. */
export function parseMegaMoves(text: string): MegaMove[] {
  const out: MegaMove[] = [];
  for (const tok of text.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = TOKEN_RE.exec(tok);
    if (!m) continue;
    const face = NAME_INDEX.get(m[1]);
    if (face === undefined) continue;
    out.push({ face, dir: m[2] === "'" ? -1 : 1 });
  }
  return out;
}

/** One move → its canonical token (bare = dir +1, primed = dir −1). Inverse of parse. */
export function megaMoveToString(m: MegaMove): string {
  return FACE_NAME[m.face] + (m.dir === -1 ? "'" : '');
}

export function megaMovesToString(moves: MegaMove[]): string {
  return moves.map(megaMoveToString).join(' ');
}

/** Collapse consecutive same-face turns mod 5 (order-5). Net 0 cancels; 1→bare, 4→prime,
 *  2→bare bare, 3→prime prime. Shortens a typed alg before replay. */
export function reduceMegaMoves(moves: MegaMove[]): MegaMove[] {
  const out: MegaMove[] = [];
  let i = 0;
  while (i < moves.length) {
    let j = i;
    let net = 0;
    while (j < moves.length && moves[j].face === moves[i].face) { net = (net + (moves[j].dir === 1 ? 1 : 4)) % 5; j++; }
    const f = moves[i].face;
    if (net === 1) out.push({ face: f, dir: 1 });
    else if (net === 4) out.push({ face: f, dir: -1 });
    else if (net === 2) { out.push({ face: f, dir: 1 }, { face: f, dir: 1 }); }
    else if (net === 3) { out.push({ face: f, dir: -1 }, { face: f, dir: -1 }); }
    i = j;
  }
  return out;
}

export function reduceMegaAlg(text: string): string {
  return megaMovesToString(reduceMegaMoves(parseMegaMoves(text)));
}

export function invertMegaMoves(moves: MegaMove[]): MegaMove[] {
  return moves.slice().reverse().map((m) => ({ face: m.face, dir: (m.dir === 1 ? -1 : 1) as 1 | -1 }));
}
