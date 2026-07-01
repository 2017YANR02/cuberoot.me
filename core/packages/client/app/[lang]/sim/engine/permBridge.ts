/**
 * PermBridge — the per-puzzle description a `PermEngineBinding` needs, the non-PG
 * analogue of `MoveBridge`. Where `MoveBridge` names a cubing.js polytope puzzle,
 * a `PermBridge` supplies the group DIRECTLY as permutations lifted from the /sim
 * engine's own discrete state model. Use it for puzzles the polytope compiler can't
 * represent faithfully:
 *   • ivy  — only 4 of the 8 corners turn (tetrahedral); not a symmetric cube cut.
 *   • rex  — its 6 centres carry an INVISIBLE 4-fold orientation, so the PG octahedron
 *            (FTO) counts 4^? more states than the single-coloured Rex visibly has.
 * Building the group from the engine model makes |G| match what's on screen exactly.
 *
 * The generators are permutations over an abstract point set = every tracked
 * (piece, orientation-slot). A piece in an orbit with orientation modulus `o`
 * occupies `o` consecutive points, so a twist that both moves AND re-orients a piece
 * is one honest permutation. `orbitsFromLayout` lays those points out and
 * `permFromApply` reads a generator off the engine's own `apply(solved) → state`.
 */
import type { PgOrbitInfo, PgGroupFacts } from './pgBackbone';

/** One orbit of like pieces. `permutes:false` = the pieces never change position,
 *  they only re-orient in place (e.g. the ivy corners) — such an orbit contributes
 *  `oriMod^pieces` to the reassembly count but NO `pieces!` factor. */
export interface PermOrbit extends PgOrbitInfo {
  /** false ⇒ position-fixed (orientation-only). Default true. */
  permutes?: boolean;
}

export interface PermBridge<M> {
  /** Facts-table key (the precomputed-facts lookup key), e.g. 'ivy' / 'rex'. */
  readonly key: string;
  /** The engine's generators as permutations over the point layout, indexed
   *  identically to the WordStep `gi` returned by `moveToStep`. */
  genPerms(): number[][];
  /** Orbit structure for the panel + reassembly/index. */
  readonly orbits: PermOrbit[];
  /** Generator display names, indexed like `genPerms`. */
  readonly moveNames: readonly string[];
  /** Engine move → BSGS step (which generator, inverted?). */
  moveToStep(m: M): { gi: number; inv: boolean };
  /** BSGS step → engine move (exact inverse of `moveToStep`). */
  stepToMove(s: { gi: number; inv: boolean }): M;
  /** Parse a scramble/alg string into engine moves. */
  parse(text: string): M[];
  /** Print engine moves to a replayable string. */
  toString(moves: M[]): string;
  /** Optional: collapse redundant consecutive turns (shortens solver output). */
  reduce?(text: string): string;
  /** Build the constructive BSGS (solve/scramble). Default true; set false for
   *  groups too large to factor in-browser (rex ~10^23) — facts + live state stay. */
  readonly solvable?: boolean;
}

/** Total point count implied by an orbit list (∑ pieces·oriMod). */
export function layoutDegree(orbits: PermOrbit[]): number {
  return orbits.reduce((n, o) => n + o.pieces * o.oriMod, 0);
}

/**
 * Lift a generator permutation from the engine's own move application. `orbits` fix
 * the point layout: orbit k owns a contiguous block, piece p (0..pieces-1) at
 * orientation t (0..oriMod-1) is point `base_k + p*oriMod + t`. `read(orbitIndex)`
 * returns, for the state AFTER the move, an array `slotPiece[]` (which piece sits in
 * each slot) and, when oriented, `slotOri[]` (that piece's orientation there). The
 * resulting permutation sends a solved point to where that sticker went, so composing
 * generators mirrors the engine exactly.
 */
export function permFromLayout(
  orbits: PermOrbit[],
  read: (orbitIndex: number) => { slotPiece: number[]; slotOri?: number[] },
): number[] {
  const degree = layoutDegree(orbits);
  const perm = Array.from({ length: degree }, (_, i) => i);
  let base = 0;
  orbits.forEach((o, k) => {
    const { slotPiece, slotOri } = read(k);
    for (let slot = 0; slot < o.pieces; slot++) {
      const piece = slotPiece[slot];
      const ori = o.oriMod > 1 ? (slotOri ? slotOri[slot] : 0) : 0;
      // The piece originally at (piece, 0) now shows at (slot, ori): a solved point
      // p=base+piece*o + 0 maps to base+slot*o + ori; extend across orientation t.
      for (let t = 0; t < o.oriMod; t++) {
        const from = base + piece * o.oriMod + ((ori + t) % o.oriMod);
        const to = base + slot * o.oriMod + t;
        perm[to] = from;
      }
    }
    base += o.pieces * o.oriMod;
  });
  return perm;
}

const factorial = (n: number): bigint => {
  let f = 1n;
  for (let k = 2n; k <= BigInt(n); k++) f *= k;
  return f;
};

/** Unconstrained reassembly = ∏ (permutes ? pieces! : 1) · oriMod^pieces. */
export function reassemblyOf(orbits: PermOrbit[]): bigint {
  let r = 1n;
  for (const o of orbits) {
    if (o.permutes !== false) r *= factorial(o.pieces);
    r *= BigInt(o.oriMod) ** BigInt(o.pieces);
  }
  return r;
}

/** Assemble the displayed facts for a perm puzzle from |G| + the orbit list. */
export function permFacts(order: bigint, orbits: PermOrbit[], moveNames: readonly string[]): PgGroupFacts {
  const reassembly = reassemblyOf(orbits);
  return {
    order,
    turningOrder: order,
    reorientations: 1n,
    reassembly,
    index: reassembly / order,
    orbits: orbits.map((o) => ({ name: o.name, pieces: o.pieces, oriMod: o.oriMod })),
    moveNames: [...moveNames],
  };
}
