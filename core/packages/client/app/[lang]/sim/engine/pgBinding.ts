/**
 * PgEngineBinding — the GENERAL binding layer between an in-house /sim engine puzzle
 * and the vendored cubing.js group theory. It is puzzle-agnostic: give it a
 * `MoveBridge<M>` (which PG puzzle, how the engine's own moves embed as PG group
 * elements, and how to parse/print them) and it provides, in *engine move* terms:
 *
 *   • live state mirroring   — applyMove / rebuild from the engine's move history,
 *   • group-theoretic solved — `solved` (state === identity in G),
 *   • current element order   — `currentOrder()`,
 *   • a real random-STATE scramble — `scrambleMoves()` (uniform over G via the BSGS,
 *     a true random state, not a random-move shuffle),
 *   • a group-theory solver   — `solveMoves()` (BSGS factorisation of the inverse),
 *   • the exact group facts   — `facts()` (Schreier-Sims, via PgBackbone).
 *
 * The BSGS is built over the *engine's* generators (each expressed as a PG transform),
 * so every word it returns is already a playable engine move sequence — no second
 * notation hop. See `pyra/pyraPgBridge.ts` for the pilot.
 */
import { PgBackbone, type PgGroupFacts } from './pgBackbone';
import { PgGroup, type WordStep } from './pgGroup';
import { precomputedFacts } from './pgFacts';
import type { PGOrbitsDef, PGTransform, PuzzleName } from '@/lib/puzzle-geometry';

export interface MoveBridge<M> {
  /** Vendored PG puzzle name (a `pgPuzzle` key). */
  readonly pgName: PuzzleName;
  /** The engine's generators as PG transforms, indexed identically to the WordStep
   *  `gi` returned by `moveToStep`. */
  engineGens(od: PGOrbitsDef): PGTransform[];
  /** Engine move → BSGS step (which generator, inverted?). */
  moveToStep(m: M): WordStep;
  /** BSGS step → engine move (exact inverse of `moveToStep`). */
  stepToMove(s: WordStep): M;
  /** Parse a scramble/alg string into engine moves. */
  parse(text: string): M[];
  /** Print engine moves to a string the engine's twister can replay. */
  toString(moves: M[]): string;
  /** Optional: collapse redundant consecutive turns (shortens solver output). */
  reduce?(text: string): string;
  /** Whether to build the constructive BSGS (solve/scramble). Default true. Set false
   *  for groups too large to factor in-browser (e.g. the helicopter cube, ~10^20) —
   *  the binding then still mirrors live state + serves Schreier-Sims facts, but
   *  `solveMoves`/`scrambleMoves` return empty. */
  readonly solvable?: boolean;
  /** Compute the displayed group facts (|G|, index) over the engine's OWN generators
   *  rather than all of PG's move ops. Set when PG's cut exposes extra slices that aren't
   *  standard puzzle moves (megaminx: 6 deep 2-layer slices inflate |G| 60×). Default false. */
  readonly factsOverEngineGens?: boolean;
  /** Generator names to show in the panel when `factsOverEngineGens` (e.g. the 12 face
   *  names), indexed like `engineGens`. */
  readonly factsMoveNames?: readonly string[];
}

export class PgEngineBinding<M> {
  readonly backbone: PgBackbone;
  /** The constructive BSGS — null when the bridge opts out (group too large to factor
   *  in-browser); live mirroring + facts still work, solve/scramble don't. */
  private readonly group: PgGroup | null;
  private readonly gens: PGTransform[];
  private readonly id: PGTransform;
  private state: PGTransform;
  /** True when solve/scramble are available (the BSGS was built). */
  readonly solvable: boolean;
  /** Number of moves currently mirrored into the state. */
  moveCount = 0;
  private cachedFacts?: PgGroupFacts;

  constructor(private readonly bridge: MoveBridge<M>) {
    this.backbone = new PgBackbone(bridge.pgName);
    this.gens = bridge.engineGens(this.backbone.od);
    this.solvable = bridge.solvable !== false;
    this.group = this.solvable ? new PgGroup(this.gens) : null;
    this.id = this.gens[0].e();
    this.state = this.id;
  }

  /** |G| — from the BSGS when built, else the Schreier-Sims count. For a non-solvable
   *  bridge this respects `factsOverEngineGens` (e.g. megaminx's 1.01×10⁶⁸ over the 12 face
   *  turns, not PG's 6.04×10⁶⁹ over all 18 cuts). */
  get order(): bigint {
    return this.group ? this.group.order : this.facts().order;
  }

  reset(): void {
    this.state = this.id;
    this.moveCount = 0;
  }

  /** Mirror one engine move into the maintained group element. */
  applyMove(m: M): void {
    const s = this.bridge.moveToStep(m);
    const g = s.inv ? this.gens[s.gi].inv() : this.gens[s.gi];
    this.state = this.state.mul(g);
    this.moveCount++;
  }

  /** Rebuild the state from a full move list (e.g. engine history.init + moves). */
  rebuild(moves: M[]): void {
    this.reset();
    for (const m of moves) this.applyMove(m);
  }

  /** Rebuild from a scramble/alg string. */
  rebuildFromString(text: string): void {
    this.rebuild(this.bridge.parse(text));
  }

  /** Group-theoretic solved test (state is the identity of G). */
  get solved(): boolean {
    return this.state.equal(this.id);
  }

  /** Order of the current element (1 = solved); the number of repeats of the whole
   *  current scramble that return to solved. */
  currentOrder(): number {
    return this.state.order();
  }

  /** A solution: engine moves that return the current state to solved, via BSGS
   *  factorisation of the inverse (pure group theory). Reduced if the bridge supports
   *  it. Empty when already solved. */
  solveMoves(): M[] {
    if (!this.group || this.solved) return [];
    const word = this.group.factor(this.state.inv());
    return this.wordToMoves(word);
  }

  /** A real random-STATE scramble: a uniform-random element of G, as engine moves. */
  scrambleMoves(): M[] {
    if (!this.group) return [];
    const { word } = this.group.randomElement();
    return this.wordToMoves(word);
  }

  /** Solution / scramble as a replayable string. */
  solveString(): string {
    return this.movesToString(this.solveMoves());
  }
  scrambleString(): string {
    return this.movesToString(this.scrambleMoves());
  }

  /** The exact group facts. Served from the PRECOMPUTED table (deterministic per puzzle —
   *  see pgFacts) so the runtime never runs Schreier-Sims and never freezes; falls back to
   *  a live computation only if a puzzle wasn't baked (regenerate pgFacts.generated then). */
  facts(): PgGroupFacts {
    if (!this.cachedFacts) {
      const pre = precomputedFacts(String(this.bridge.pgName));
      if (pre) {
        this.cachedFacts = pre;
      } else {
        if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
          console.warn(`[pgFacts] no precomputed facts for "${this.bridge.pgName}" — computing live (freezes UI). Regenerate tests/gen_pg_facts.gen.test.ts`);
        }
        this.cachedFacts = this.bridge.factsOverEngineGens
          ? this.backbone.factsOver(this.gens, this.bridge.factsMoveNames)
          : this.backbone.facts();
      }
    }
    return this.cachedFacts;
  }

  /** Live-computed facts, bypassing the precomputed table — used by the offline generator
   *  to (re)build the baked table. Do not call from UI (may freeze). */
  computeFactsLive(): PgGroupFacts {
    return this.bridge.factsOverEngineGens
      ? this.backbone.factsOver(this.gens, this.bridge.factsMoveNames)
      : this.backbone.facts();
  }

  private wordToMoves(word: WordStep[]): M[] {
    return word.map((s) => this.bridge.stepToMove(s));
  }

  private movesToString(moves: M[]): string {
    const s = this.bridge.toString(moves);
    return this.bridge.reduce ? this.bridge.reduce(s) : s;
  }
}
