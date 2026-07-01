/**
 * permGroup — a Schreier-Sims BSGS *with words*, working on PLAIN permutations
 * (`number[]`). It is the non-PG twin of `pgGroup.ts`: identical incremental
 * sifting + Minkwitz word-shortening, but the element type is a bare permutation
 * array instead of a vendored `PGTransform`. Use it for the /sim puzzles the
 * cubing.js polytope compiler cannot faithfully represent — the ones whose group
 * we build straight from the ENGINE's own state model (ivy: 4 tetrahedral corner
 * twists; rex: 8 deep corner turns), so the words it returns are already playable
 * engine moves.
 *
 * pgGroup already runs its hot loops on the flattened permutation (`toPerm().p`);
 * this class simply IS those loops with the PGTransform wrapper removed, so the two
 * stay algorithmically in lock-step. Right-acting convention: `compose(a,b)[i] =
 * a[b[i]]`, a transversal rep u for point δ satisfies `act(u, base) = δ`.
 *
 *   • order        — |G| = ∏ |transversal| (computed during the build).
 *   • factor(perm) — express any group element as a word in the generators.
 *   • randomElement() — a *uniform* random element with its word (true random state).
 *
 * Construct with `{ optimize: false }` for a facts-only puzzle (rex): the chain is
 * still built (so `order` is exact) but the expensive Minkwitz pass — only useful
 * for shortening solve words — is skipped. Solvable puzzles (ivy) use the default.
 */

export interface WordStep {
  /** Index into the generator array passed to the constructor. */
  gi: number;
  /** Apply the generator's inverse. */
  inv: boolean;
}
export type PermWord = WordStep[];

/** Right-acting composition: act(compose(a,b), i) = a[b[i]] = act(a, act(b, i)). */
export function compose(a: number[], b: number[]): number[] {
  const c = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) c[i] = a[b[i]];
  return c;
}
export function permInv(a: number[]): number[] {
  const c = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) c[a[i]] = i;
  return c;
}
export function isIdPerm(a: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== i) return false;
  return true;
}
/** Order of a permutation = lcm of its cycle lengths (1 = identity). */
export function permOrder(a: number[]): number {
  const seen = new Array<boolean>(a.length).fill(false);
  let ord = 1;
  const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
  for (let i = 0; i < a.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    let j = i;
    while (!seen[j]) { seen[j] = true; j = a[j]; len++; }
    if (len > 1) ord = (ord / gcd(ord, len)) * len;
  }
  return ord;
}
/** Inverse of a word: reverse order, flip each step. */
export function invWord(w: PermWord): PermWord {
  const out: PermWord = new Array(w.length);
  for (let i = 0; i < w.length; i++) {
    const s = w[w.length - 1 - i];
    out[i] = { gi: s.gi, inv: !s.inv };
  }
  return out;
}

interface PCoset {
  perm: number[];
  word: PermWord;
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
  word: PermWord;
  from: number;
}

export class PermGroup {
  private readonly genPerms: number[][];
  private readonly genInvPerms: number[][];
  private readonly degree: number;
  private readonly iota: number[];
  private readonly levels: Level[] = [];
  private readonly pending: Pending[] = [];
  private readonly registered = new Set<string>();
  /** |G| = ∏ |transversal|. */
  readonly order: bigint;

  constructor(gens: number[][], opts: { optimize?: boolean } = {}) {
    if (!gens.length) throw new Error('PermGroup needs at least one generator');
    this.genPerms = gens.map((g) => g.slice());
    this.genInvPerms = this.genPerms.map(permInv);
    this.degree = this.genPerms[0].length;
    this.iota = Array.from({ length: this.degree }, (_, i) => i);
    this.build();
    this.order = this.levels.reduce((a, l) => a * BigInt(l.tv.size), 1n);
    if (opts.optimize !== false) this.optimizeWords();
  }

  /** Permutation a word evaluates to (product left-to-right). */
  wordPerm(w: PermWord): number[] {
    let e = this.iota;
    for (const s of w) e = compose(e, s.inv ? this.genInvPerms[s.gi] : this.genPerms[s.gi]);
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
    if (this.registered.has(key)) return;
    this.registered.add(key);
    if (k === this.levels.length) {
      const pt = cur.findIndex((v, i) => v !== i);
      this.levels.push({ base: pt, tv: new Map([[pt, { perm: this.iota, word: [] }]]), gens: [] });
    }
    const g: PCoset = { perm: cur, word: w };
    for (let j = 0; j <= k; j++) {
      this.levels[j].gens.push(g);
      this.extendLevel(j, g);
    }
  }

  private extendLevel(j: number, g: PCoset): void {
    const lvl = this.levels[j];
    const gInv: PCoset = { perm: permInv(g.perm), word: invWord(g.word) };
    const allEdges: PCoset[] = [];
    for (const x of lvl.gens) {
      allEdges.push(x);
      allEdges.push({ perm: permInv(x.perm), word: invWord(x.word) });
    }
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
    const newSet = new Set(newPts);
    for (const [d, u] of lvl.tv) {
      for (const x of lvl.gens) {
        if (x !== g && !newSet.has(d)) continue;
        const u2 = lvl.tv.get(x.perm[d])!;
        const perm = compose(permInv(u2.perm), compose(x.perm, u.perm));
        if (isIdPerm(perm)) continue;
        const word = invWord(u2.word).concat(x.word, u.word);
        this.pending.push({ perm, word, from: j + 1 });
      }
    }
  }

  // ── Minkwitz word shortening (see pgGroup.ts for the rationale) ──────────────
  private optimizeWords(): void {
    const baseLen = this.levels.length;
    if (baseLen === 0) return;
    const G = this.genPerms.length;
    for (let gi = 0; gi < G; gi++) this.sgn(this.genPerms[gi], [{ gi, inv: false }]);
    const rounds = Math.min(200_000, 1500 * baseLen);
    const maxLen = 2 * baseLen + 2;
    for (let r = 0; r < rounds; r++) {
      const len = 1 + Math.floor(Math.random() * maxLen);
      let perm = this.iota;
      const word: PermWord = [];
      for (let i = 0; i < len; i++) {
        const gi = Math.floor(Math.random() * G);
        const inv = Math.random() < 0.5;
        perm = compose(perm, inv ? this.genInvPerms[gi] : this.genPerms[gi]);
        word.push({ gi, inv });
      }
      this.sgn(perm, word);
    }
  }

  private sgn(perm: number[], word: PermWord): void {
    let c = perm;
    let w = word;
    for (let k = 0; k < this.levels.length; k++) {
      if (isIdPerm(c)) return;
      const lvl = this.levels[k];
      const delta = c[lvl.base];
      const u = lvl.tv.get(delta);
      if (!u) return;
      if (w.length < u.word.length) {
        lvl.tv.set(delta, { perm: c, word: w });
        const nc = compose(permInv(c), u.perm);
        w = invWord(w).concat(u.word);
        c = nc;
      } else {
        c = compose(permInv(u.perm), c);
        w = invWord(u.word).concat(w);
      }
    }
  }

  /** Express `perm` as a word in the original generators (product left-to-right = perm). */
  factor(perm: number[]): PermWord {
    let cur = perm.slice();
    let word: PermWord = [];
    for (const lvl of this.levels) {
      const u = lvl.tv.get(cur[lvl.base]);
      if (!u) throw new Error(`factor: point ${cur[lvl.base]} not in transversal of base ${lvl.base}`);
      word = word.concat(u.word);
      cur = compose(permInv(u.perm), cur);
    }
    if (!isIdPerm(cur)) throw new Error('factor: residue is not identity (element outside G)');
    return word;
  }

  /** A uniform-random element of G with the word that produces it. */
  randomElement(): { perm: number[]; word: PermWord } {
    let word: PermWord = [];
    for (const lvl of this.levels) {
      const reps = [...lvl.tv.values()];
      const u = reps[Math.floor(Math.random() * reps.length)];
      word = word.concat(u.word);
    }
    return { perm: this.wordPerm(word), word };
  }
}
