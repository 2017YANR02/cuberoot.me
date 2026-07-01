/**
 * PermEngineBinding — the GroupKernel for /sim puzzles backed by the engine's own
 * permutation model instead of a cubing.js polytope (see `permBridge.ts` for why).
 * It mirrors `PgEngineBinding` method-for-method (same panel surface) but its group
 * elements are plain permutations, its BSGS is `PermGroup`, and its facts come from
 * the declared orbit list rather than Schreier-Sims over a compiled cut.
 *
 * Facts are served from the SAME precomputed table as the PG puzzles (keyed by
 * `bridge.key`), so the runtime never runs the BSGS just to display |G|; the
 * constructive BSGS is built only when the bridge is `solvable` (ivy) and only for
 * solve/scramble.
 */
import type { PgGroupFacts } from './pgBackbone';
import type { GroupKernel } from './pgBinding';
import { PermGroup, compose, permInv, isIdPerm, permOrder, type WordStep } from './permGroup';
import { permFacts, type PermBridge } from './permBridge';
import { precomputedFacts } from './pgFacts';
import { schreierSims } from '@/lib/puzzle-geometry/SchreierSims';
import { Perm } from '@/lib/puzzle-geometry/Perm';

export class PermEngineBinding<M> implements GroupKernel {
  private readonly gens: number[][];
  private readonly genInv: number[][];
  private readonly id: number[];
  private state: number[];
  /** Constructive BSGS — null when the bridge opts out (facts + live state still work). */
  private readonly group: PermGroup | null;
  readonly solvable: boolean;
  moveCount = 0;
  private cachedFacts?: PgGroupFacts;

  constructor(private readonly bridge: PermBridge<M>) {
    this.gens = bridge.genPerms();
    this.genInv = this.gens.map(permInv);
    this.id = Array.from({ length: this.gens[0].length }, (_, i) => i);
    this.state = this.id;
    this.solvable = bridge.solvable !== false;
    this.group = this.solvable ? new PermGroup(this.gens, { optimize: true }) : null;
  }

  /** |G| — from the BSGS when built, else the precomputed facts. */
  get order(): bigint {
    return this.group ? this.group.order : this.facts().order;
  }

  reset(): void {
    this.state = this.id;
    this.moveCount = 0;
  }

  applyMove(m: M): void {
    const s = this.bridge.moveToStep(m);
    this.state = compose(this.state, s.inv ? this.genInv[s.gi] : this.gens[s.gi]);
    this.moveCount++;
  }

  rebuild(moves: M[]): void {
    this.reset();
    for (const m of moves) this.applyMove(m);
  }

  rebuildFromString(text: string): void {
    this.rebuild(this.bridge.parse(text));
  }

  get solved(): boolean {
    return isIdPerm(this.state);
  }

  currentOrder(): number {
    return permOrder(this.state);
  }

  solveMoves(): M[] {
    if (!this.group || this.solved) return [];
    return this.wordToMoves(this.group.factor(permInv(this.state)));
  }

  scrambleMoves(): M[] {
    if (!this.group) return [];
    return this.wordToMoves(this.group.randomElement().word);
  }

  solveString(): string {
    return this.movesToString(this.solveMoves());
  }
  scrambleString(): string {
    return this.movesToString(this.scrambleMoves());
  }

  /** Facts from the precomputed table (deterministic per puzzle); live fallback warns. */
  facts(): PgGroupFacts {
    if (!this.cachedFacts) {
      const pre = precomputedFacts(this.bridge.key);
      if (pre) {
        this.cachedFacts = pre;
      } else {
        if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
          console.warn(`[pgFacts] no precomputed facts for "${this.bridge.key}" — computing live (freezes UI). Regenerate tests/gen_pg_facts.gen.test.ts`);
        }
        this.cachedFacts = this.computeFactsLive();
      }
    }
    return this.cachedFacts;
  }

  /** Live-computed facts — offline generator only. |G| from the constructive BSGS when
   *  built (solvable), else the vendored word-free Schreier-Sims (large facts-only groups
   *  like rex ≈ 5×10²⁷ would OOM our word-tracking build; the count is convention-free). */
  computeFactsLive(): PgGroupFacts {
    const order = this.group
      ? this.group.order
      : schreierSims(this.gens.map((g) => new Perm(g.slice())), () => {});
    return permFacts(order, this.bridge.orbits, this.bridge.moveNames);
  }

  private wordToMoves(word: WordStep[]): M[] {
    return word.map((s) => this.bridge.stepToMove(s));
  }
  private movesToString(moves: M[]): string {
    const s = this.bridge.toString(moves);
    return this.bridge.reduce ? this.bridge.reduce(s) : s;
  }
}
