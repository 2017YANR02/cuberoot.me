/**
 * PgBackbone — a thin, GENERAL group-theory kernel for the engine puzzles, built on
 * the vendored cubing.js puzzle-geometry (`@/lib/puzzle-geometry`). It is the "logic
 * truth" half of the dual-renderer's third mode: our Three.js puzzle (PyraCube, …)
 * still draws the pixels, while this object answers the group-theoretic questions the
 * geometry can't — exact |G| (Schreier-Sims), the orbit / wreath structure, the
 * unconstrained reassembly count + constraint index, and a state it maintains by
 * mirroring the same moves the visual plays (so "solved" can be asked of the group,
 * not just the geometry).
 *
 * Deliberately puzzle-agnostic: construct it with any name from `pgPuzzle` and it
 * works. The per-puzzle move-name bridge (our PyraMove ↔ PG's "2DRF"/"DRF"/…) lives
 * in the integration layer, not here — this class speaks PG move names only.
 *
 * Heavy import: pulling the barrel drags in PuzzleGeometry.ts (~3.4k lines). The third
 * render mode should `import()` this lazily so it never lands in the default bundle.
 */
import {
  getPuzzleGeometryByName,
  schreierSims,
} from '@/lib/puzzle-geometry';
import type {
  PuzzleGeometry,
  PGOrbitsDef,
  VisibleState,
  PuzzleName,
} from '@/lib/puzzle-geometry';

export interface PgOrbitInfo {
  /** PG orbit label, e.g. "EDGES" / "CORNERS" / "CORNERS2". */
  name: string;
  /** Number of pieces in the orbit (the S_n factor). */
  pieces: number;
  /** Orientation modulus o (the Z_o factor); 1 = unoriented. */
  oriMod: number;
}

export interface PgGroupFacts {
  /** |G| over all generators (fixed in space), via Schreier-Sims. */
  order: bigint;
  /** Unconstrained reassembly = ∏ pieces! · oriMod^pieces. */
  reassembly: bigint;
  /** reassembly / |G| — the product of the puzzle's conservation laws. */
  index: bigint;
  /** Per-orbit Z_o ≀ S_n structure. */
  orbits: PgOrbitInfo[];
  /** Generator (move) names PG derived from the cut description. */
  moveNames: string[];
}

export class PgBackbone {
  readonly pg: PuzzleGeometry;
  private readonly od: PGOrbitsDef;
  /** Pristine solved reference (mul is functional, so this never mutates). */
  private readonly solvedState: VisibleState;
  private readonly moveIndex: Map<string, number>;
  private state: VisibleState;
  private cachedFacts?: PgGroupFacts;

  constructor(public readonly puzzleName: PuzzleName) {
    this.pg = getPuzzleGeometryByName(puzzleName, {});
    this.od = this.pg.getOrbitsDef(false);
    this.solvedState = this.od.solved;
    this.state = this.od.solved;
    this.moveIndex = new Map(this.od.movenames.map((n, i) => [n, i]));
  }

  /** Reset the maintained state back to solved. */
  reset(): void {
    this.state = this.solvedState;
  }

  /** PG move names this backbone understands (the generators). */
  get moveNames(): readonly string[] {
    return this.od.movenames;
  }

  /**
   * Apply a PG move by name (e.g. "2DRF"); `inverse` plays its inverse (the primed
   * token). Returns false for an unknown name (caller's bridge is incomplete).
   */
  applyMoveName(name: string, inverse = false): boolean {
    const i = this.moveIndex.get(name);
    if (i === undefined) return false;
    const op = inverse ? this.od.moveops[i].inv() : this.od.moveops[i];
    this.state = this.state.mul(op);
    return true;
  }

  /** Group-theoretic solved test (state equals the solved reference). */
  get solved(): boolean {
    return this.state.equal(this.solvedState);
  }

  /**
   * Exact group facts (cached). |G| runs the vendored Knuth/Schreier-Sims over the
   * generators' permutations; cheap for small puzzles (pyraminx ≈ 20ms) — cache so a
   * UI panel can read it freely.
   */
  facts(): PgGroupFacts {
    if (this.cachedFacts) return this.cachedFacts;
    const order = schreierSims(
      this.od.moveops.map((m) => m.toPerm()),
      () => {},
    );
    const reassembly = this.od.reassemblySize();
    this.cachedFacts = {
      order,
      reassembly,
      index: reassembly / order,
      orbits: this.solvedState.orbits.map((o, i) => ({
        name: this.od.orbitnames[i],
        pieces: o.perm.length,
        oriMod: o.orimod,
      })),
      moveNames: this.od.movenames.slice(),
    };
    return this.cachedFacts;
  }
}
