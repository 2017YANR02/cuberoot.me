/**
 * puzzle-group — a twisty puzzle as an oriented permutation group.
 *
 * A puzzle's pieces live in disjoint **orbits** (corners / edges / centers …);
 * within an orbit every piece is interchangeable and carries an orientation in
 * `Z/ori`. A move is an element of the wreath product `(Z/ori) ≀ S_size` on each
 * orbit, written here in **cycle notation** + a sparse orientation twist — the
 * natural group-theory presentation, not an opaque flat permutation array.
 *
 * State is "which piece (and orientation) currently sits in each slot". A move
 * acts on the left exactly as a KPuzzle transformation does:
 *     pieces'[i] = pieces[σ[i]]
 *     orient'[i] = orient[σ[i]] + twist[i]      (mod ori)
 * where σ[i] = "slot i now sources from slot σ[i]". A cycle `[a,b,c]` means
 * σ[a]=b, σ[b]=c, σ[c]=a; `twist` is keyed by destination slot.
 *
 * Scramble tokens resolve to a base generator raised to an integer power:
 * `X'` = inverse, `X2` = square, megaminx `X--` = `(X++)⁻¹`. Base generators
 * only ever store the +1 direction; the rest is derived by the group action.
 *
 * The geometry of a 2D net (polygon coordinates) is *data*, kept in PuzzleNet
 * alongside the group; the math here never touches pixels.
 */

export interface OrbitSpec {
  /** number of piece slots in this orbit */
  size: number;
  /** distinguishable orientations per piece (1 = unoriented) */
  ori: number;
}

/**
 * A generator's action on one orbit, in cycle notation.
 * - `cycles`: slot cycles. `[a,b,c]` ⇒ σ[a]=b, σ[b]=c, σ[c]=a (where a piece
 *   comes *from*); slots in no cycle are fixed.
 * - `twist`: sparse orientation delta added on arrival, keyed by destination slot.
 */
export interface OrbitAction {
  cycles: number[][];
  twist?: Record<number, number>;
}

/** A generator = its action per (named) orbit. Orbits omitted are fixed. */
export type Generator = Record<string, OrbitAction>;

export interface PuzzleGroup {
  orbits: Record<string, OrbitSpec>;
  /** Base generators, keyed by their canonical (+1) scramble token. */
  gens: Record<string, Generator>;
}

/** Runtime state: for each orbit, the piece + orientation occupying every slot. */
export type PuzzleState = Record<string, { pieces: number[]; orient: number[] }>;

/** Flat permutation + orientation delta for one orbit (length = orbit size). */
interface FlatMove {
  perm: number[];
  delta: number[];
}

export function solvedState(g: PuzzleGroup): PuzzleState {
  const st: PuzzleState = {};
  for (const [name, spec] of Object.entries(g.orbits)) {
    st[name] = {
      pieces: Array.from({ length: spec.size }, (_, i) => i),
      orient: new Array(spec.size).fill(0),
    };
  }
  return st;
}

/** Expand cycle notation + twist into a flat (perm, delta) of length `size`. */
function expandAction(a: OrbitAction | undefined, size: number): FlatMove {
  const perm = Array.from({ length: size }, (_, i) => i);
  const delta = new Array(size).fill(0);
  if (a) {
    for (const cyc of a.cycles) {
      for (let k = 0; k < cyc.length; k++) {
        perm[cyc[k]] = cyc[(k + 1) % cyc.length];
      }
    }
    if (a.twist) for (const [slot, d] of Object.entries(a.twist)) delta[+slot] = d;
  }
  return { perm, delta };
}

/** Group inverse of a wreath element (σ, v): (σ⁻¹, w) with w[i] = −v[σ⁻¹[i]]. */
function invertFlat({ perm, delta }: FlatMove, ori: number): FlatMove {
  const n = perm.length;
  const inv = new Array(n);
  for (let i = 0; i < n; i++) inv[perm[i]] = i;
  const w = new Array(n);
  for (let i = 0; i < n; i++) w[i] = ((-delta[inv[i]]) % ori + ori) % ori;
  return { perm: inv, delta: w };
}

/** Apply one orbit's flat move to one orbit's state. */
function applyFlat(
  cur: { pieces: number[]; orient: number[] },
  mv: FlatMove,
  ori: number,
): { pieces: number[]; orient: number[] } {
  const n = mv.perm.length;
  const pieces = new Array(n);
  const orient = new Array(n);
  for (let i = 0; i < n; i++) {
    pieces[i] = cur.pieces[mv.perm[i]];
    orient[i] = ((cur.orient[mv.perm[i]] + mv.delta[i]) % ori + ori) % ori;
  }
  return { pieces, orient };
}

/** Apply a base generator raised to `power` (negative = inverse). */
export function applyGenerator(
  g: PuzzleGroup,
  st: PuzzleState,
  genName: string,
  power: number,
): PuzzleState {
  const gen = g.gens[genName];
  if (!gen || power === 0) return st;
  const times = Math.abs(power);
  const inverse = power < 0;
  let out = st;
  for (let k = 0; k < times; k++) {
    const next: PuzzleState = {};
    for (const [orbit, spec] of Object.entries(g.orbits)) {
      let mv = expandAction(gen[orbit], spec.size);
      if (inverse) mv = invertFlat(mv, spec.ori);
      next[orbit] = applyFlat(out[orbit], mv, spec.ori);
    }
    out = next;
  }
  return out;
}

/** Resolve a scramble token to a base generator + power (null if unknown). */
export function resolveToken(
  g: PuzzleGroup,
  token: string,
): { gen: string; power: number } | null {
  if (g.gens[token]) return { gen: token, power: 1 };
  if (token.endsWith("'")) {
    const b = token.slice(0, -1);
    if (g.gens[b]) return { gen: b, power: -1 };
  }
  if (token.endsWith('2')) {
    const b = token.slice(0, -1);
    if (g.gens[b]) return { gen: b, power: 2 };
  }
  if (token.endsWith('--')) {
    const b = token.slice(0, -2) + '++';
    if (g.gens[b]) return { gen: b, power: -1 };
  }
  return null;
}

/** Apply a whitespace-separated scramble to the solved state. Unknown tokens are skipped. */
export function applyScramble(g: PuzzleGroup, scramble: string): PuzzleState {
  let st = solvedState(g);
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const r = resolveToken(g, tok);
    if (r) st = applyGenerator(g, st, r.gen, r.power);
  }
  return st;
}
