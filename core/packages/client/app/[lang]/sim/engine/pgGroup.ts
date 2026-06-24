/**
 * pgGroup — a Schreier-Sims BSGS *with words*, built directly on the vendored
 * cubing.js group algebra (`PGTransform` from `@/lib/puzzle-geometry`). The upstream
 * `SchreierSims.ts` only counts |G|; here we keep the full stabilizer chain (base +
 * transversals) and, for every
 * transversal element, the *word* in the original generators that produces it. That
 * makes the group constructive:
 *
 *   • factor(h)  — express any element h as a product of generators (a "solution").
 *   • randomElement() — a *uniform* random element of G (one uniform coset rep per
 *     level), returned with the word that reaches it (a true random-state scramble).
 *
 * It is puzzle-agnostic: feed it the generators you want the words written in. The
 * pyraminx binding feeds it the 8 *engine* generators (tip = PG `DRF`, corner =
 * `DRF·2DRF`), so every word is already a playable engine move sequence.
 *
 * Conventions (verified against the vendored algebra): compose with `PGTransform.mul`;
 * the point-action of a product is `act(a·b, i) = act(a, act(b, i))` (right operand
 * acts first); a transversal element u for point δ satisfies `act(u, base) = δ`.
 */
import type { PGTransform } from '@/lib/puzzle-geometry';

export interface WordStep {
  /** Index into the generator array passed to the constructor. */
  gi: number;
  /** Apply the generator's inverse. */
  inv: boolean;
}
export type PgWord = WordStep[];

interface Coset {
  elem: PGTransform;
  word: PgWord;
}
interface Level {
  base: number;
  /** δ → coset rep u with act(u, base) = δ. */
  transversal: Map<number, Coset>;
}

const act = (t: PGTransform, i: number): number => t.toPerm().p[i];
const permKey = (t: PGTransform): string => t.toPerm().p.join(',');

/** Inverse of a word: reverse order, flip each step. */
function invWord(w: PgWord): PgWord {
  const out: PgWord = new Array(w.length);
  for (let i = 0; i < w.length; i++) {
    const s = w[w.length - 1 - i];
    out[i] = { gi: s.gi, inv: !s.inv };
  }
  return out;
}

export class PgGroup {
  private readonly gens: PGTransform[];
  private readonly invGens: PGTransform[];
  private readonly id: PGTransform;
  private readonly degree: number;
  private readonly levels: Level[] = [];
  /** |G| = ∏ |transversal|, an independent check against Schreier-Sims. */
  readonly order: bigint;

  constructor(gens: PGTransform[]) {
    if (!gens.length) throw new Error('PgGroup needs at least one generator');
    this.gens = gens;
    this.invGens = gens.map((g) => g.inv());
    this.id = gens[0].e();
    this.degree = gens[0].toPerm().p.length;
    this.build();
    this.order = this.levels.reduce((a, l) => a * BigInt(l.transversal.size), 1n);
  }

  private stepElem(s: WordStep): PGTransform {
    return s.inv ? this.invGens[s.gi] : this.gens[s.gi];
  }

  /** Element a word evaluates to (product left-to-right, so word[i] applied in order). */
  wordElem(w: PgWord): PGTransform {
    let e = this.id;
    for (const s of w) e = e.mul(this.stepElem(s));
    return e;
  }

  private build(): void {
    // Current level's generating set, each carrying its word in the ORIGINAL gens.
    let S: Coset[] = this.gens.map((op, gi) => ({ elem: op, word: [{ gi, inv: false }] }));
    for (let guard = 0; guard <= this.degree; guard++) {
      const base = this.firstMoved(S);
      if (base === null) break; // stabilizer trivial → chain complete
      const transversal = this.orbitTransversal(base, S);
      this.levels.push({ base, transversal });
      S = this.schreierGens(base, transversal, S);
    }
  }

  private firstMoved(S: Coset[]): number | null {
    for (let i = 0; i < this.degree; i++) {
      for (const s of S) if (act(s.elem, i) !== i) return i;
    }
    return null;
  }

  /** BFS the orbit of `base` under ⟨S⟩ (edges = each gen and its inverse), recording
   *  for each reached point the coset rep + word. */
  private orbitTransversal(base: number, S: Coset[]): Map<number, Coset> {
    const U = new Map<number, Coset>();
    U.set(base, { elem: this.id, word: [] });
    const edges: Coset[] = [];
    for (const s of S) {
      edges.push(s);
      edges.push({ elem: s.elem.inv(), word: invWord(s.word) });
    }
    const queue = [base];
    while (queue.length) {
      const d = queue.shift()!;
      const u = U.get(d)!;
      for (const e of edges) {
        const d2 = act(e.elem, d);
        if (U.has(d2)) continue;
        // act(e·u, base) = act(e, act(u, base)) = act(e, d) = d2.
        U.set(d2, { elem: e.elem.mul(u.elem), word: e.word.concat(u.word) });
        queue.push(d2);
      }
    }
    return U;
  }

  /** Schreier generators of Stab_⟨S⟩(base): u_{s·δ}⁻¹ · s · u_δ for each δ, s. */
  private schreierGens(base: number, U: Map<number, Coset>, S: Coset[]): Coset[] {
    const out: Coset[] = [];
    const seen = new Set<string>();
    for (const [d, u] of U) {
      for (const s of S) {
        const d2 = act(s.elem, d);
        const u2 = U.get(d2)!;
        const elem = u2.elem.inv().mul(s.elem).mul(u.elem);
        if (act(elem, base) !== base) continue; // sanity; should always hold
        const key = permKey(elem);
        if (key === this.identityKey || seen.has(key)) continue;
        seen.add(key);
        out.push({ elem, word: invWord(u2.word).concat(s.word, u.word) });
      }
    }
    return out;
  }

  private get identityKey(): string {
    return permKey(this.id);
  }

  /**
   * Express `h` as a word in the original generators: the returned word's product
   * (left-to-right) equals `h`. Throws if `h` is not in G (should not happen for
   * elements built from the generators).
   */
  factor(h: PGTransform): PgWord {
    let cur = h;
    let word: PgWord = [];
    for (const lvl of this.levels) {
      const d = act(cur, lvl.base);
      const u = lvl.transversal.get(d);
      if (!u) throw new Error(`factor: point ${d} not in transversal of base ${lvl.base}`);
      // cur = u · rest, rest = u⁻¹ · cur fixes this base (and all earlier).
      word = word.concat(u.word);
      cur = u.elem.inv().mul(cur);
    }
    if (permKey(cur) !== this.identityKey) {
      throw new Error('factor: residue is not identity (element outside G)');
    }
    return word;
  }

  /** A uniform-random element of G with the word that produces it (one uniform coset
   *  rep per level → exactly uniform over the unique chain factorisation). */
  randomElement(): { elem: PGTransform; word: PgWord } {
    let elem = this.id;
    let word: PgWord = [];
    for (const lvl of this.levels) {
      const reps = [...lvl.transversal.values()];
      const u = reps[Math.floor(Math.random() * reps.length)];
      elem = elem.mul(u.elem);
      word = word.concat(u.word);
    }
    return { elem, word };
  }
}
