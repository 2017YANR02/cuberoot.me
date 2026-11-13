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
 * Whole-puzzle rotations (y = Uv, Lv, Rv, Bv — cubing.js's pyraminx rotation set) use
 * part 'rot': a ±120° re-hold about a vertex axis. Site aliases: x := Rv, z := Bv' (cubing.js's own
 * def has no z/x — a tetra has no 90° axis — these names denote vertex re-holds,
 * expanded to Rv and Bv tokens on output). A rotation permutes NO piece — the
 * engine bakes it into the render group's quaternion — and, like WCA algs, it makes the
 * letters WORLD-fixed: after `y`, a typed `L` turns whatever vertex now sits at the L
 * position. The letter→physical remap both the engine and the PG bridge apply is driven
 * by ROT_SIGMA / rotateLetterMap below (one shared table).
 *
 * Direction: bare = clockwise looking at what you grab from outside — at the VERTEX for
 * tip/corner/rot moves (dir −1 = R(axis, −120°)), at the FACE for face moves (the
 * opposite end of the same axis, so dir +1 = R(axis, +120°)); primed = the inverse.
 * Same convention as Dino, so a single clockwise drag records the bare token.
 *
 * No discrete permutation/orientation state: each piece is rendered by a pivot whose
 * quaternion is the source of truth, and `complete` is "every pivot carries the same
 * rotation" (see PyraCube) — solved up to a whole-puzzle reorientation, so a rotation
 * IS its two-layer expansion (y ≡ U Dw', Lv ≡ L Rw', Rv ≡ R Lw', Bv ≡ B Fw') and both
 * forms leave a solved puzzle solved. Which pieces a turn carries is read live from the
 * geometry. So this module is pure notation — no three.js.
 */
import { lexCornerNotation, cornerTurnAmount } from './corner_notation';

/** Vertex letters, index 0..3. V0 = the apex (rendered up). */
export const VERTEX_NAMES = ['U', 'L', 'R', 'B'] as const;
export type VertexName = typeof VERTEX_NAMES[number];

export type PyraPart = 'tip' | 'corner' | 'face' | 'rot';

export interface PyraMove {
  /** Axis vertex index 0..3 (VERTEX_NAMES). A face move turns about the axis of the
   *  vertex OPPOSITE the named face (Dw → U's axis, Lw → R's, Rw → L's, Fw → B's).
   *  For letter-space moves (typed algs) this is the WORLD-fixed letter; the engine
   *  remaps it to the physical vertex under the accumulated rotations. */
  vertex: number;
  part: PyraPart;
  /** Rotation sign about the vertex axis: angle = dir·120°. Bare tip/corner/rot = −1
   *  (clockwise seen from the vertex); bare face = +1 (clockwise seen from the face —
   *  the opposite end of the axis). Primed = the negation. */
  dir: 1 | -1;
}

const TOKEN_RE = /^([ULRB])(\d*)('?)$/i;
/** Face-layer tokens (case-sensitive — lowercase stays tip-only): D or Dw, Lw, Rw, Fw. */
const FACE_RE = /^(Dw?|Lw|Rw|Fw)(\d*)(')?$/;
/** Face token → axis vertex (the vertex opposite that face). */
const FACE_TO_VERTEX: Record<string, number> = { D: 0, Dw: 0, Lw: 2, Rw: 1, Fw: 3 };
/** Canonical face token per axis vertex 0..3 (w-form; bare D accepted on input). */
const FACE_NAMES = ['Dw', 'Rw', 'Lw', 'Fw'] as const;
/** Whole-puzzle rotation tokens: y (= Uv) about the U axis, plus Lv / Rv / Bv. */
const ROT_RE = /^(x|y|Uv|Lv|Rv|Bv|z)(\d*)(')?$/;
const ROT_TO_VERTEX: Record<string, number> = { x: 2, y: 0, Uv: 0, Lv: 1, Rv: 2, Bv: 3, z: 3 };
/** Rotation tokens whose BARE form is the PRIME of their vertex re-hold. `z` is defined
 *  (site alias) as Bv', so bare `z` = R(B axis, +120°) and `z'` = Bv. Every other token's
 *  bare form is R(axis, −120°) (clockwise from the vertex, like the corner turns). */
const ROT_BARE_INVERTED = new Set(['z']);
/** Canonical rotation token per axis vertex 0..3 (y preferred over its Uv alias; the
 *  B-axis re-hold prints as Bv/Bv', so `z` round-trips to "Bv'" and `z'` to "Bv"). */
const ROT_NAMES = ['y', 'Lv', 'Rv', 'Bv'] as const;

/** Vertex permutation of R(V̂_k, +120°): ROT_SIGMA[k][a] = the vertex direction V_a
 *  maps onto. Derived numerically (Rodrigues on VDIR, exact for the tetra group);
 *  −120° is the inverse = the square (each rotation has order 3). */
const ROT_SIGMA: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 2, 3, 1], [3, 1, 0, 2], [1, 3, 2, 0], [2, 0, 1, 3],
];

/** σ for a rotation about physical vertex axis `k` by dir·120°. */
function rotSigma(k: number, dir: 1 | -1, a: number): number {
  const s = ROT_SIGMA[k];
  return dir === 1 ? s[a] : s[s[a]];
}

/**
 * Advance a letter→physical vertex map across one rotation (about PHYSICAL axis
 * `physAxis`, sign `dir`). After the re-hold, the world slot letter ℓ points at holds
 * σ⁻¹(previous occupant): l2p'[ℓ] = σ⁻¹(l2p[ℓ]). Shared by the engine (PyraCube) and
 * the PG bridge so their remaps can never diverge.
 */
export function rotateLetterMap(l2p: ReadonlyArray<number>, physAxis: number, dir: 1 | -1): number[] {
  return l2p.map((p) => rotSigma(physAxis, dir === 1 ? -1 : 1, p));
}

/** Shared strict lexer for playback and completion checks. */
export function parsePyraAlgorithm(text: string): { moves: PyraMove[]; invalid: string[] } {
  const parsed = lexCornerNotation(text, /^(?:Dw?|Lw|Rw|Fw|[ULRB]v|[ULRBulrbSH]|[xyz])\d*'?/);
  const moves: PyraMove[] = [];
  for (const token of parsed.tokens) {
    const macro = /^([SH])(\d*)('?)$/.exec(token);
    if (macro) {
      const count = Number(macro[2] || 1);
      if (!Number.isSafeInteger(count) || count > 100) { parsed.invalid.push(token); continue; }
      const hedge = (macro[1] === 'H') !== Boolean(macro[3]);
      const body = parsePyraMoves(hedge ? "L R' L' R" : "R' L R L'");
      for (let i = 0; i < count; i++) moves.push(...body);
      continue;
    }
    const face = FACE_RE.exec(token), rot = ROT_RE.exec(token), corner = TOKEN_RE.exec(token);
    const match = face ?? rot ?? corner!;
    const amount = cornerTurnAmount(match[2], match[3], 3);
    if (!amount) continue;
    const vertex = face ? FACE_TO_VERTEX[match[1]] : rot ? ROT_TO_VERTEX[match[1]]
      : VERTEX_NAMES.indexOf(match[1].toUpperCase() as VertexName);
    const bare = face || (rot && ROT_BARE_INVERTED.has(match[1])) ? 1 : -1;
    moves.push({ vertex, part: face ? 'face' : rot ? 'rot'
      : match[1] === match[1].toLowerCase() ? 'tip' : 'corner',
      dir: (amount === 1 ? bare : -bare) as 1 | -1 });
  }
  return { moves, invalid: parsed.invalid };
}

/** Playback retains valid chunks; validation also checks the invalid list. */
export function parsePyraMoves(text: string): PyraMove[] {
  return parsePyraAlgorithm(text).moves;
}

/** Render one move to its canonical token: uppercase=corner / lowercase=tip / w=face /
 *  y·v=rotation; bare = clockwise (from the grabbed end), primed = its inverse. Exact
 *  inverse of parsePyraMoves (modulo the D → Dw, Uv → y and z → Bv' aliases). */
export function pyraMoveToString(move: PyraMove): string {
  if (move.part === 'face') return FACE_NAMES[move.vertex] + (move.dir === -1 ? "'" : '');
  if (move.part === 'rot') return ROT_NAMES[move.vertex] + (move.dir === 1 ? "'" : '');
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
