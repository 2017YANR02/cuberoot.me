/**
 * pgGroup — a Schreier-Sims BSGS *with words*, built directly on the vendored
 * cubing.js group algebra (`PGTransform` from `@/lib/puzzle-geometry`). The upstream
 * `SchreierSims.ts` only counts |G|; here we keep the full stabilizer chain (base +
 * transversals) and, for every transversal element, the *word* in the original
 * generators that produces it. That makes the group constructive:
 *
 *   • factor(h)  — express any element h as a product of generators (a "solution").
 *   • randomElement() — a *uniform* random element of G (one uniform coset rep per
 *     level), returned with the word that reaches it (a true random-state scramble).
 *
 * It is puzzle-agnostic: feed it the generators you want the words written in. The
 * pyraminx binding feeds it the 8 *engine* generators (tip = PG `DRF`, corner =
 * `DRF·2DRF`), so every word is already a playable engine move sequence.
 *
 * Construction is an *incremental* Schreier-Sims with sifting: each element/Schreier
 * generator is stripped through the partial chain and only registered as a strong
 * generator when its residue is non-trivial. Strong generators are kept *cumulatively*
 * — a generator that fixes base[0..k-1] joins the generating set of every level j ≤ k
 * (the property S^(j) = S ∩ G^(j) a BSGS requires) — and each level's orbit/transversal
 * is extended incrementally. That keeps the strong generating set small, so groups far
 * larger than the pyraminx's 75M (e.g. the helicopter cube, ~10^19) build without the
 * naive "carry every Schreier generator" blow-up.
 *
 * Internals run on the *flattened* permutation of each element (`toPerm().p`), so the
 * hot loops never re-flatten a PGTransform. The flattening uses the right-acting
 * convention `act(t,i) = toPerm(t).p[i]`, which makes `compose(a,b)[i] = a[b[i]]`
 * mirror `PGTransform.mul`: `toPerm(a·b) = compose(toPerm(a), toPerm(b))` and a
 * transversal element u for point δ satisfies `act(u, base) = δ`. Words stay in
 * PGTransform terms; the two are kept in lock-step — every stored word's PGTransform
 * has `toPerm` equal to its stored perm.
 */
import type { PGTransform } from '@/lib/puzzle-geometry';

export interface WordStep {
  /** Index into the generator array passed to the constructor. */
  gi: number;
  /** Apply the generator's inverse. */
  inv: boolean;
}
export type PgWord = WordStep[];

/** Right-acting composition: act(compose(a,b), i) = a[b[i]] = act(a, act(b, i)). */
function compose(a: number[], b: number[]): number[] {
  const c = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) c[i] = a[b[i]];
  return c;
}
function permInv(a: number[]): number[] {
  const c = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) c[a[i]] = i;
  return c;
}
function isIdPerm(a: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== i) return false;
  return true;
}
/** Inverse of a word: reverse order, flip each step. */
function invWord(w: PgWord): PgWord {
  const out: PgWord = new Array(w.length);
  for (let i = 0; i < w.length; i++) {
    const s = w[w.length - 1 - i];
    out[i] = { gi: s.gi, inv: !s.inv };
  }
  return out;
}

interface PCoset {
  perm: number[];
  word: PgWord;
}
interface Level {
  base: number;
  /** δ → coset rep u with act(u, base) = δ. */
  tv: Map<number, PCoset>;
  /** S^(j): strong generators fixing base[0..j-1] (cumulative — includes deeper ones). */
  gens: PCoset[];
}
/** A pending element to sift into the chain, starting at `from`. */
interface Pending {
  perm: number[];
  word: PgWord;
  from: number;
}

export class PgGroup {
  private readonly gens: PGTransform[];
  private readonly invGens: PGTransform[];
  private readonly id: PGTransform;
  private readonly genPerms: number[][];
  private readonly genInvPerms: number[][];
  private readonly degree: number;
  private readonly iota: number[];
  private readonly levels: Level[] = [];
  private readonly pending: Pending[] = [];
  /** Perms already registered as strong generators (dedup — a residue whose perm is
   *  already a strong gen adds nothing, so skip it; keeps the chain build bounded). */
  private readonly registered = new Set<string>();
  /** |G| = ∏ |transversal|, an independent check against Schreier-Sims. */
  readonly order: bigint;

  constructor(gens: PGTransform[]) {
    if (!gens.length) throw new Error('PgGroup needs at least one generator');
    this.gens = gens;
    this.invGens = gens.map((g) => g.inv());
    this.id = gens[0].e();
    this.genPerms = gens.map((g) => g.toPerm().p.slice());
    this.genInvPerms = this.genPerms.map(permInv);
    this.degree = this.genPerms[0].length;
    this.iota = Array.from({ length: this.degree }, (_, i) => i);
    this.build();
    this.order = this.levels.reduce((a, l) => a * BigInt(l.tv.size), 1n);
    this.optimizeWords();
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

  // ── incremental Schreier-Sims with sifting ──────────────────────────────────
  private build(): void {
    this.genPerms.forEach((perm, gi) => {
      this.pending.push({ perm, word: [{ gi, inv: false }], from: 0 });
    });
    while (this.pending.length) {
      const e = this.pending.pop()!;
      this.siftAndRegister(e);
    }
  }

  /** Strip `e` from level `e.from`; if the residue is non-trivial, register it as a
   *  strong generator (extending the base if it runs off the chain). */
  private siftAndRegister(e: Pending): void {
    let cur = e.perm;
    let w = e.word;
    let k = e.from;
    for (; k < this.levels.length; k++) {
      const lvl = this.levels[k];
      const u = lvl.tv.get(cur[lvl.base]);
      if (!u) break;
      cur = compose(permInv(u.perm), cur);
      w = invWord(u.word).concat(w);
    }
    if (isIdPerm(cur)) return;
    const key = cur.join(',');
    if (this.registered.has(key)) return; // perm already a strong gen — adds nothing
    this.registered.add(key);
    if (k === this.levels.length) {
      const pt = cur.findIndex((v, i) => v !== i);
      this.levels.push({ base: pt, tv: new Map([[pt, { perm: this.iota, word: [] }]]), gens: [] });
    }
    // cur fixes base[0..k-1]; it is a strong generator of every level j ≤ k.
    const g: PCoset = { perm: cur, word: w };
    for (let j = 0; j <= k; j++) {
      this.levels[j].gens.push(g);
      this.extendLevel(j, g);
    }
  }

  /** A new strong generator `g` joined level j's set: grow the orbit/transversal of
   *  base[j] under the (now larger) S^(j) and queue the fresh Schreier generators. */
  private extendLevel(j: number, g: PCoset): void {
    const lvl = this.levels[j];
    const gInv: PCoset = { perm: permInv(g.perm), word: invWord(g.word) };
    const allEdges: PCoset[] = [];
    for (const x of lvl.gens) {
      allEdges.push(x);
      allEdges.push({ perm: permInv(x.perm), word: invWord(x.word) });
    }
    // Incrementally extend the orbit: g is the ONLY new edge, so apply just g/g⁻¹ to
    // the existing points; then close any points that opens up under all edges.
    const newPts: number[] = [];
    const queue: number[] = [];
    for (const d of [...lvl.tv.keys()]) {
      const u = lvl.tv.get(d)!;
      for (const e of [g, gInv]) {
        const d2 = e.perm[d];
        if (lvl.tv.has(d2)) continue;
        lvl.tv.set(d2, { perm: compose(e.perm, u.perm), word: e.word.concat(u.word) });
        newPts.push(d2);
        queue.push(d2);
      }
    }
    for (let qi = 0; qi < queue.length; qi++) {
      const d = queue[qi];
      const u = lvl.tv.get(d)!;
      for (const e of allEdges) {
        const d2 = e.perm[d];
        if (lvl.tv.has(d2)) continue;
        lvl.tv.set(d2, { perm: compose(e.perm, u.perm), word: e.word.concat(u.word) });
        newPts.push(d2);
        queue.push(d2);
      }
    }
    // Fresh Schreier generators u_{x·δ}⁻¹·x·u_δ: (every δ, the new gen g) ∪
    // (every new δ, every gen). Both fix base[0..j], so sift them from level j+1.
    const newSet = new Set(newPts);
    for (const [d, u] of lvl.tv) {
      for (const x of lvl.gens) {
        if (x !== g && !newSet.has(d)) continue; // (old δ, old gen) pairs already done
        const u2 = lvl.tv.get(x.perm[d])!;
        const perm = compose(permInv(u2.perm), compose(x.perm, u.perm));
        if (isIdPerm(perm)) continue;
        const word = invWord(u2.word).concat(x.word, u.word);
        this.pending.push({ perm, word, from: j + 1 });
      }
    }
  }

  // ── Minkwitz word shortening ────────────────────────────────────────────────
  /**
   * The sifting build produces a *correct* BSGS but with very long transversal words
   * (a tiny strong generating set → long BFS paths → compounded words). Minkwitz's
   * method fixes that without touching the group: feed short words and, wherever a
   * coset can be reached more cheaply, swap in the shorter word (the displaced longer
   * rep is reduced against the new one and sifted deeper, carrying improvement down).
   * Only words change — the transversal keys, sizes and |G| are untouched, so the
   * chain stays a valid BSGS and `factor` stays correct, just far shorter.
   */
  private optimizeWords(): void {
    const baseLen = this.levels.length;
    if (baseLen === 0) return;
    const G = this.genPerms.length;
    // seed with the bare generators, then random short words; rounds scale with the
    // chain length (deep levels need more feeds to reach), capped to stay snappy.
    for (let gi = 0; gi < G; gi++) this.sgn(this.genPerms[gi], [{ gi, inv: false }]);
    const rounds = Math.min(200_000, 1500 * baseLen);
    const maxLen = 2 * baseLen + 2;
    for (let r = 0; r < rounds; r++) {
      const len = 1 + Math.floor(Math.random() * maxLen);
      let perm = this.iota;
      const word: PgWord = [];
      for (let i = 0; i < len; i++) {
        const gi = Math.floor(Math.random() * G);
        const inv = Math.random() < 0.5;
        perm = compose(perm, inv ? this.genInvPerms[gi] : this.genPerms[gi]);
        word.push({ gi, inv });
      }
      this.sgn(perm, word);
    }
  }

  /** Sift (perm, word) through the chain, swapping in any shorter coset word found.
   *  When a shorter rep replaces a stored one, the old rep (reduced by the new) keeps
   *  sifting deeper so its word can still shorten lower levels. */
  private sgn(perm: number[], word: PgWord): void {
    let c = perm;
    let w = word;
    for (let k = 0; k < this.levels.length; k++) {
      if (isIdPerm(c)) return;
      const lvl = this.levels[k];
      const delta = c[lvl.base];
      const u = lvl.tv.get(delta);
      if (!u) return; // complete BSGS → defined; safety
      if (w.length < u.word.length) {
        lvl.tv.set(delta, { perm: c, word: w });
        // continue with old-rep reduced by the new (shorter) rep — fixes base[k].
        const nc = compose(permInv(c), u.perm);
        w = invWord(w).concat(u.word);
        c = nc;
      } else {
        c = compose(permInv(u.perm), c);
        w = invWord(u.word).concat(w);
      }
    }
  }

  /**
   * Express `h` as a word in the original generators: the returned word's product
   * (left-to-right) equals `h`. Throws if `h` is not in G (should not happen for
   * elements built from the generators).
   */
  factor(h: PGTransform): PgWord {
    let cur = h.toPerm().p.slice();
    let word: PgWord = [];
    for (const lvl of this.levels) {
      const u = lvl.tv.get(cur[lvl.base]);
      if (!u) throw new Error(`factor: point ${cur[lvl.base]} not in transversal of base ${lvl.base}`);
      // cur = u · rest, rest = u⁻¹ · cur fixes this base (and all earlier).
      word = word.concat(u.word);
      cur = compose(permInv(u.perm), cur);
    }
    if (!isIdPerm(cur)) throw new Error('factor: residue is not identity (element outside G)');
    return word;
  }

  /** A uniform-random element of G with the word that produces it (one uniform coset
   *  rep per level → exactly uniform over the unique chain factorisation). */
  randomElement(): { elem: PGTransform; word: PgWord } {
    let word: PgWord = [];
    for (const lvl of this.levels) {
      const reps = [...lvl.tv.values()];
      const u = reps[Math.floor(Math.random() * reps.length)];
      word = word.concat(u.word);
    }
    return { elem: this.wordElem(word), word };
  }
}
