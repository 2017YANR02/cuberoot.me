/**
 * Pyraminx state model + notation (self-contained /sim world).
 *
 * The Pyraminx is a vertex-turning tetrahedron: 4 vertex axes, each a ±120° turn.
 * Pieces: 4 tips, 4 corners, 6 edges. Each axis carries THREE move parts:
 *   • tip    (lowercase u/l/r/b) — the tip cap alone;
 *   • corner (uppercase U/L/R/B) — the vertex layer: tip + corner + the 3 adjacent edges;
 *   • face   (Dw/Lw/Rw/Fw; D = Dw) — the complementary far slab (3 corners + 3 tips +
 *     3 edges), i.e. the layer of the FACE opposite the axis vertex. Face letters follow
 *     the WCA tetra opposition: D↔U, L↔R, R↔L, F↔B (face X touches every vertex except
 *     the axis one). Unlike tip/corner turns (which only spin pieces in place), face
 *     turns PERMUTE corners and tips between vertices.
 *
 * Direction: bare = clockwise looking at what you grab from outside — at the VERTEX for
 * tip/corner moves (dir −1 = R(axis, −120°)), at the FACE for face moves (the opposite
 * end of the same axis, so dir +1 = R(axis, +120°)); primed = the inverse. Same
 * convention as Dino, so a single clockwise drag records the bare token. We never feed
 * this to an external solver, so it only has to be internally consistent.
 *
 * No discrete permutation/orientation state: each piece is rendered by a pivot whose
 * quaternion is the source of truth, and `complete` is "every pivot is at identity"
 * (see PyraCube). Which pieces a turn carries is read live from the geometry. So this
 * module is pure notation — no three.js.
 */

/** Vertex letters, index 0..3. V0 = the apex (rendered up). */
export const VERTEX_NAMES = ['U', 'L', 'R', 'B'] as const;
export type VertexName = typeof VERTEX_NAMES[number];

export type PyraPart = 'tip' | 'corner' | 'face';

export interface PyraMove {
  /** Axis vertex index 0..3 (VERTEX_NAMES). A face move turns about the axis of the
   *  vertex OPPOSITE the named face (Dw → U's axis, Lw → R's, Rw → L's, Fw → B's). */
  vertex: number;
  part: PyraPart;
  /** Rotation sign about the vertex axis: angle = dir·120°. Bare tip/corner = −1
   *  (clockwise seen from the vertex); bare face = +1 (clockwise seen from the face —
   *  the opposite end of the axis). Primed = the negation. */
  dir: 1 | -1;
}

const TOKEN_RE = /^([ULRB])('?)$/i;
/** Face-layer tokens (case-sensitive — lowercase stays tip-only): D or Dw, Lw, Rw, Fw. */
const FACE_RE = /^(Dw?|Lw|Rw|Fw)(')?$/;
/** Face token → axis vertex (the vertex opposite that face). */
const FACE_TO_VERTEX: Record<string, number> = { D: 0, Dw: 0, Lw: 2, Rw: 1, Fw: 3 };
/** Canonical face token per axis vertex 0..3 (w-form; bare D accepted on input). */
const FACE_NAMES = ['Dw', 'Rw', 'Lw', 'Fw'] as const;

/** Parse a scramble / alg string into moves. Unknown tokens are skipped. */
export function parsePyraMoves(text: string): PyraMove[] {
  const index = new Map<string, number>(VERTEX_NAMES.map((n, i) => [n, i]));
  const out: PyraMove[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    if (!raw) continue;
    const f = FACE_RE.exec(raw);
    if (f) {
      out.push({ vertex: FACE_TO_VERTEX[f[1]], part: 'face', dir: f[2] ? -1 : 1 });
      continue;
    }
    const m = TOKEN_RE.exec(raw);
    if (!m) continue;
    const letter = m[1];
    const vertex = index.get(letter.toUpperCase());
    if (vertex === undefined) continue;
    out.push({
      vertex,
      part: letter === letter.toLowerCase() ? 'tip' : 'corner',
      dir: m[2] ? 1 : -1,
    });
  }
  return out;
}

/** Render one move to its canonical token: uppercase=corner / lowercase=tip / w=face;
 *  bare = clockwise (from the grabbed end), primed = its inverse. Exact inverse of
 *  parsePyraMoves (modulo the D → Dw alias). */
export function pyraMoveToString(move: PyraMove): string {
  if (move.part === 'face') return FACE_NAMES[move.vertex] + (move.dir === -1 ? "'" : '');
  const letter = VERTEX_NAMES[move.vertex];
  return (move.part === 'tip' ? letter.toLowerCase() : letter) + (move.dir === 1 ? "'" : '');
}

export function pyraMovesToString(moves: PyraMove[]): string {
  return moves.map(pyraMoveToString).join(' ');
}

export function invertPyraMoves(moves: PyraMove[]): PyraMove[] {
  return moves.slice().reverse().map((m) => ({ ...m, dir: (m.dir === 1 ? -1 : 1) as 1 | -1 }));
}

/** Collapse a same-axis same-part run (each turn is order-3): fold consecutive
 *  tokens on the same (vertex, part) into a net 0/1/2 turns. */
export function reducePyraAlg(text: string): string {
  const moves = parsePyraMoves(text);
  const out: PyraMove[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last.vertex === m.vertex && last.part === m.part) {
      // Net rotation in thirds mod 3 (each dir ±1 = ±120°). 1 → +120°, 2 → +240° ≡
      // −120°, 0 → cancels. e.g. U U (−240°) ≡ +120° = U'; Dw Dw (+240°) ≡ −120° = Dw'.
      const net = (((last.dir + m.dir) % 3) + 3) % 3;
      out.pop();
      if (net === 1) out.push({ vertex: m.vertex, part: m.part, dir: 1 });
      else if (net === 2) out.push({ vertex: m.vertex, part: m.part, dir: -1 });
      // net 0 → cancels, push nothing
    } else {
      out.push(m);
    }
  }
  return pyraMovesToString(out);
}

/**
 * Random scramble: `n` corner (big) turns over the 4 vertices, never the same vertex
 * twice in a row, followed by a random tip turn (0/1/2) on each vertex — the standard
 * pyraminx scramble shape (WCA scrambles never use face turns).
 */
export function randomPyraScramble(n = 10): PyraMove[] {
  const out: PyraMove[] = [];
  let last = -1;
  for (let i = 0; i < n; i++) {
    let v: number;
    do { v = Math.floor(Math.random() * 4); } while (v === last);
    last = v;
    out.push({ vertex: v, part: 'corner', dir: Math.random() < 0.5 ? 1 : -1 });
  }
  for (let v = 0; v < 4; v++) {
    const turns = Math.floor(Math.random() * 3); // 0,1,2
    for (let i = 0; i < turns; i++) out.push({ vertex: v, part: 'tip', dir: 1 });
  }
  return out;
}

export function randomPyraScrambleString(n = 10): string {
  return pyraMovesToString(randomPyraScramble(n));
}
