/**
 * Pyraminx state model + notation (self-contained /sim world).
 *
 * The Pyraminx is a vertex-turning tetrahedron: 4 vertex axes, each a ±120° turn.
 * Pieces: 4 tips, 4 corners (both spin in place — they never leave their vertex),
 * 6 edges (3-cycled around a vertex, like a tetrahedral Dino). A big turn (uppercase)
 * rotates the corner + its tip + the 3 adjacent edges; a tip turn (lowercase) rotates
 * only the tip.
 *
 * Notation (WCA): vertices U / L / R / B; uppercase = the corner layer, lowercase =
 * the tip only, optional `'`. Bare = the CLOCKWISE −120° twist (dir −1), primed = its
 * CCW inverse (dir +1) — same convention as Dino, so a single clockwise drag records
 * the bare letter. We never feed this to an external solver, so it only has to be
 * internally consistent (bare and primed are inverses).
 *
 * No discrete permutation/orientation state: each piece is rendered by a pivot whose
 * quaternion is the source of truth, and `complete` is "every pivot is at identity"
 * (see PyraCube). The vertex a big turn affects is fixed; which edges it carries is
 * read live from the geometry. So this module is pure notation — no three.js.
 */

/** Vertex letters, index 0..3. V0 = the apex (rendered up). */
export const VERTEX_NAMES = ['U', 'L', 'R', 'B'] as const;
export type VertexName = typeof VERTEX_NAMES[number];

export interface PyraMove {
  /** Vertex index 0..3 (VERTEX_NAMES). */
  vertex: number;
  /** true = tip-only turn (lowercase), false = corner layer (uppercase). */
  tip: boolean;
  /** +1 = +120° (CCW from outside → primed token); -1 = −120° (clockwise → bare). */
  dir: 1 | -1;
}

const TOKEN_RE = /^([ULRB])('?)$/i;

/** Parse a scramble / alg string into moves. Unknown tokens are skipped. */
export function parsePyraMoves(text: string): PyraMove[] {
  const index = new Map<string, number>(VERTEX_NAMES.map((n, i) => [n, i]));
  const out: PyraMove[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    if (!raw) continue;
    const m = TOKEN_RE.exec(raw);
    if (!m) continue;
    const letter = m[1];
    const vertex = index.get(letter.toUpperCase());
    if (vertex === undefined) continue;
    out.push({ vertex, tip: letter === letter.toLowerCase(), dir: m[2] ? 1 : -1 });
  }
  return out;
}

/** Render one move to its canonical token: uppercase=corner / lowercase=tip; bare =
 *  clockwise (dir −1), primed = CCW inverse (dir +1). Exact inverse of parsePyraMoves. */
export function pyraMoveToString(move: PyraMove): string {
  const letter = VERTEX_NAMES[move.vertex];
  return (move.tip ? letter.toLowerCase() : letter) + (move.dir === 1 ? "'" : '');
}

export function pyraMovesToString(moves: PyraMove[]): string {
  return moves.map(pyraMoveToString).join(' ');
}

export function invertPyraMoves(moves: PyraMove[]): PyraMove[] {
  return moves.slice().reverse().map((m) => ({ ...m, dir: (m.dir === 1 ? -1 : 1) as 1 | -1 }));
}

/** Collapse a same-vertex same-layer run (each turn is order-3): fold consecutive
 *  tokens on the same (vertex, tip) into a net 0/1/2 turns. */
export function reducePyraAlg(text: string): string {
  const moves = parsePyraMoves(text);
  const out: PyraMove[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last.vertex === m.vertex && last.tip === m.tip) {
      // Net rotation in thirds mod 3 (each dir ±1 = ±120°). 1 → +120° (primed),
      // 2 → +240° ≡ −120° (bare), 0 → cancels. e.g. U U = −240° ≡ +120° = U'.
      const net = (((last.dir + m.dir) % 3) + 3) % 3;
      out.pop();
      if (net === 1) out.push({ vertex: m.vertex, tip: m.tip, dir: 1 });
      else if (net === 2) out.push({ vertex: m.vertex, tip: m.tip, dir: -1 });
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
 * pyraminx scramble shape.
 */
export function randomPyraScramble(n = 10): PyraMove[] {
  const out: PyraMove[] = [];
  let last = -1;
  for (let i = 0; i < n; i++) {
    let v: number;
    do { v = Math.floor(Math.random() * 4); } while (v === last);
    last = v;
    out.push({ vertex: v, tip: false, dir: Math.random() < 0.5 ? 1 : -1 });
  }
  for (let v = 0; v < 4; v++) {
    const turns = Math.floor(Math.random() * 3); // 0,1,2
    for (let i = 0; i < turns; i++) out.push({ vertex: v, tip: true, dir: 1 });
  }
  return out;
}

export function randomPyraScrambleString(n = 10): string {
  return pyraMovesToString(randomPyraScramble(n));
}
