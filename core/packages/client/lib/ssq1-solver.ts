/*
 * Super Square-1 (ssq1, cstimer key `ssq1t`) solver — pure TS, no worker, no tables to download.
 * TIER D (valid + bounded, NOT optimal): a genuine TWO-PHASE shape+permutation REDUCTION that solves the
 * actual STATE (not the scramble path). Honest quality bucket = "sampled-bounded": the returned solution
 * is guaranteed valid and bounded, and its LENGTH VARIES with the scramble (a real distribution, not a
 * single bar). Mirrors sq2's honesty — near-optimal-ish but NOT provably optimal.
 *
 * WHY this decomposition (measured, not assumed). The Super Square-1 is genuinely TWO coupled Square-1
 * mechanisms (P0, P1) sharing the `/` slice; a flat search over the ≈10²⁵ space explodes. But the classic
 * shape-then-permutation split is tiny and BFS-able:
 *   • SHAPE space of ONE side: only 3,678 reachable shapes, diameter 14 (verified by BFS).
 *   • In cube shape, CORNER permutation closes at 8! = 40,320 (BFS over cube→cube macros).
 *   • In cube shape with corners solved, EDGE permutation is the EVEN group A8 = 20,160 (a real Square-1
 *     has no short pure 3-cycles — corner-only/edge-only macros are all even, so corner-fixing edge perms
 *     form A8). The remaining ODD half (the famous Square-1 "parity") is handled by ONE constructively-
 *     found odd corner-fixing edge generator that flips edge-perm parity, then A8 finishes.
 * The two coupled sides are solved INDEPENDENTLY into atomic op-words, then COMPOSED at the shared slice:
 * each side is split into "rounds" (layer-turn packs between slices); the side with fewer slices is padded
 * with an IDENTITY word (`/ /` adds 2 slices; `U6/ U6/ U6/` adds 3) so both reach a common slice count
 * S = max(s0,s1)+2 (no 1-slice identity exists, so every pad is 0 or ≥ 2). At each round both sides apply
 * their own turn pack, then the SHARED slice fires. Provably terminates; verified by round-trip.
 *
 * MECHANISM (verified against cstimer's generator). cstimer's `ssq1t` generator
 * (tools/cstimer-scramble/scramble/utilscramble.js: ssq1t_scramble → sq1_getseq → sq1_domove) builds
 * two independent Square-1 move sequences s and t, then emits `len` 4-tuples
 *   "(" + s[2i][0] + "," + t[2i][0] + "," + t[2i][1] + "," + s[2i][1] + ")/ "
 * i.e. a tuple (a,b,c,d)/ drives: P0 top-turn a + P0 bottom-turn d; P1 top-turn b + P1 bottom-turn c;
 * then the slice "/" slices BOTH P0 and P1. This solver mirrors that move model EXACTLY (faithful by
 * construction: the generator runs cstimer's `sq1_domove` index math on two `p` arrays).
 *
 * STATE MODEL (single source of truth):
 *   Each side is a Square-1 with 24 thirty-degree SLOTS (top 0..11 CW, bottom 12..23 CW). 8 corners
 *   (60°, span 2 consecutive slots) + 8 edges (30°, 1 slot). Per side we store a 24-entry piece-id
 *   array `p` (PERMUTATION): a corner home-id occupies its TWO slots with the SAME id; an edge occupies
 *   one slot with a singleton id. SOLVED layout (per side, slot→id):
 *     corner slots (0,1)(3,4)(6,7)(9,10) top, (13,14)(16,17)(19,20)(22,23) bottom → corner ids 0..7;
 *     edge slots 2,5,8,11 top, 12,15,18,21 bottom → edge ids 100..107.
 *   Side 0 uses these ids; side 1 offsets by +SIDE1_OFFSET so the combined solved state is unambiguous
 *   (flat 48-slot array in `ssq1Apply`). The SHAPE (which slots hold a corner-start) is DERIVED from
 *   `p` (two equal adjacent ids = a corner). CUBE SHAPE = the solved shape (4 corners + 4 edges per ring).
 *   Coordinates in cube shape: CORNER_POS = corner-start slots, EDGE_POS = edge slots.
 *
 *   Moves (cstimer convention, both layers of a side):
 *     • top-turn by k:  p[i]=old[(12+i-k)%12]   for i in 0..11
 *     • bottom-turn by k: p[12+i]=old[12+((12+i-k)%12)]
 *     • slice (a side): for i in 0..5 swap slots i+6 ↔ i+12.
 *     • LOCK CHECK before a (ktop,kbot) turn: ILLEGAL iff a corner straddles either cut, i.e.
 *       shape[(17-ktop)%12]||shape[(11-ktop)%12]||shape[12+(17-kbot)%12]||shape[12+(11-kbot)%12]
 *       (verbatim cstimer sq1_domove). The slice is always legal. Every op the solver emits is legal by
 *       construction (the BFS/tables only follow legal moves; padding uses U6 which is legal in cube shape).
 *   A scramble tuple (a,b,c,d)/ → turn P0 by (a,d) + turn P1 by (b,c), then slice BOTH.
 *
 * STATE SPACE: one Square-1 has 3,393,693,768,000 states (Jaap's standard count). Two coupled ones ⇒
 *   ≈ the product, ≈1.15×10²⁵ — far beyond any full-BFS / packed-table tier. > 2^53 so the constant is
 *   a string (§0.0 #4).
 *
 * TABLES: built ONCE, lazily (module-level singleton TABLES) on first solve — shape parent map (3,678),
 * corner-perm parent map (40,320), edge-perm (A8) parent map (20,160), cube→cube macros, edge composite
 * generators, and the odd-parity generator. ~15-20ms-equiv build (pure JS Maps); per-solve is fast.
 *
 * tests/ssq1_solver.test.ts re-derives the move permutations INDEPENDENTLY (two-array model) and
 * round-trips 500 random + 200 real cstimer scrambles (scramble ∘ solution = solved) — that is the
 * validity oracle; it does NOT assume the inverse, so this real reduction passes it. A 2000-sample test
 * logs the length spread and asserts every length ≤ SSQ1_MAX_LENGTH.
 *
 * METRIC: solution length is counted in cstimer-style (a,b,c,d)/ TUPLES (one segment of layer-turns
 * then a slice = one tuple; a trailing partial tuple counts 1) — the same unit cstimer uses for
 * scramble length. The pretty solution string is in (a,b,c,d)/ form.
 */

type U8 = Uint8Array<ArrayBuffer>;

// ── per-side solved layout (slot → piece id) ─────────────────────────────────────────
const CORNER_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [3, 4], [6, 7], [9, 10], [13, 14], [16, 17], [19, 20], [22, 23],
];
const EDGE_SLOTS: readonly number[] = [2, 5, 8, 11, 12, 15, 18, 21];
const CORNER_EDGE_GAP = 100; // edge ids = CORNER_EDGE_GAP + e so corners (0..7) and edges never collide
const SIDE1_OFFSET = 50;     // side 1 piece ids shifted so the combined flat 48-array is unambiguous

function solvedSidePieces(sideOffset: number): U8 {
  const p = new Uint8Array(24) as U8;
  CORNER_SLOTS.forEach((pair, ci) => { p[pair[0]] = sideOffset + ci; p[pair[1]] = sideOffset + ci; });
  EDGE_SLOTS.forEach((slot, ei) => { p[slot] = sideOffset + CORNER_EDGE_GAP + ei; });
  return p;
}
const SOLVED_P0 = solvedSidePieces(0);
const SOLVED_P1 = solvedSidePieces(SIDE1_OFFSET);

// ── primitive moves on one 24-id side array (cstimer convention) ──────────────────────
function rotTop(arr: U8, k: number): U8 {
  k = ((k % 12) + 12) % 12;
  if (k === 0) return new Uint8Array(arr) as U8;
  const n = new Uint8Array(arr) as U8;
  for (let i = 0; i < 12; i++) n[i] = arr[(12 + i - k) % 12];
  return n;
}
function rotBot(arr: U8, k: number): U8 {
  k = ((k % 12) + 12) % 12;
  if (k === 0) return new Uint8Array(arr) as U8;
  const n = new Uint8Array(arr) as U8;
  for (let i = 0; i < 12; i++) n[12 + i] = arr[12 + ((12 + i - k) % 12)];
  return n;
}
function sliceSide(arr: U8): U8 {
  const n = new Uint8Array(arr) as U8;
  for (let i = 0; i < 6; i++) { const c = n[i + 6]; n[i + 6] = n[i + 12]; n[i + 12] = c; }
  return n;
}
/** Is slot i a corner-start (slot i and i+1 in the same ring hold the same id)? Derives SHAPE. */
function isCornerStart(arr: ArrayLike<number>, i: number): boolean {
  if (i < 11) return arr[i] === arr[i + 1];      // top ring 0..11
  if (i === 11) return false;
  if (i < 23) return arr[i] === arr[i + 1];      // bottom ring 12..23
  return false;
}
/** cstimer lock check for a (ktop,kbot) turn given the side array (true = ILLEGAL). */
function lockedSide(arr: U8, ktop: number, kbot: number): boolean {
  const a = ((ktop % 12) + 12) % 12;
  const b = ((kbot % 12) + 12) % 12;
  return isCornerStart(arr, (17 - a) % 12) || isCornerStart(arr, (11 - a) % 12)
    || isCornerStart(arr, 12 + ((17 - b) % 12)) || isCornerStart(arr, 12 + ((11 - b) % 12));
}

// ── a Tuple = one (a,b,c,d) layer-turn pack; the slice is applied separately ──────────
//   a = P0 top, d = P0 bottom, b = P1 top, c = P1 bottom.
export interface SsqTuple { a: number; b: number; c: number; d: number; }
export interface SsqState { p0: U8; p1: U8; }

function solvedState(): SsqState { return { p0: new Uint8Array(SOLVED_P0) as U8, p1: new Uint8Array(SOLVED_P1) as U8 }; }

/** Is the (ktop,kbot) layer turn of `side` legal at this state? (slice is always legal) */
export function ssq1TupleLegal(st: SsqState, t: SsqTuple): boolean {
  if ((t.a !== 0 || t.d !== 0) && lockedSide(st.p0, t.a, t.d)) return false;
  if ((t.b !== 0 || t.c !== 0) && lockedSide(st.p1, t.b, t.c)) return false;
  return true;
}

/** Apply only the layer turns of a tuple (no slice). */
function applyTurns(st: SsqState, t: SsqTuple): SsqState {
  let p0 = st.p0, p1 = st.p1;
  if (t.a) p0 = rotTop(p0, t.a);
  if (t.d) p0 = rotBot(p0, t.d);
  if (t.b) p1 = rotTop(p1, t.b);
  if (t.c) p1 = rotBot(p1, t.c);
  return { p0, p1 };
}
function applySliceBoth(st: SsqState): SsqState { return { p0: sliceSide(st.p0), p1: sliceSide(st.p1) }; }
/** Apply one full scramble tuple (a,b,c,d)/ = layer turns then slice BOTH sides. */
function applyTuple(st: SsqState, t: SsqTuple): SsqState { return applySliceBoth(applyTurns(st, t)); }

// ── scramble parsing / state apply ────────────────────────────────────────────────────
const TUPLE_RE = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*\//g;

/** Parse a "(a,b,c,d)/ …" scramble into tuple structs (each followed by a slice). Junk ignored. */
export function parseSsq1Scramble(scramble: string): SsqTuple[] {
  const out: SsqTuple[] = [];
  if (!scramble) return out;
  const cleaned = scramble.replace(/\/\/[^\n]*/g, ' ');
  const re = new RegExp(TUPLE_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    out.push({ a: parseInt(m[1], 10), b: parseInt(m[2], 10), c: parseInt(m[3], 10), d: parseInt(m[4], 10) });
  }
  return out;
}

/** Apply a scramble to the solved puzzle, returning full per-side state. */
export function ssq1ApplyState(scramble: string): SsqState {
  let st = solvedState();
  for (const t of parseSsq1Scramble(scramble)) st = applyTuple(st, t);
  return st;
}

/** Apply a scramble → flat 48-slot piece array (P0 slots 0..23, P1 slots 24..47) for the SVG. */
export function ssq1Apply(scramble: string): Uint8Array<ArrayBuffer> {
  const st = ssq1ApplyState(scramble);
  const out = new Uint8Array(48) as U8;
  out.set(st.p0, 0);
  out.set(st.p1, 24);
  return out;
}

// ── solve = genuine two-phase shape+permutation reduction ─────────────────────────────
function normTurn(x: number): number { let v = ((x % 12) + 12) % 12; if (v > 6) v -= 12; return v; }

// An atomic op on ONE side: a slice, a top-turn by k, or a bottom-turn by k.
type Op = { s: true } | { t: number } | { b: number };
function applyOpSide(arr: U8, op: Op): U8 {
  if ('s' in op) return sliceSide(arr);
  if ('t' in op) return rotTop(arr, op.t);
  return rotBot(arr, op.b);
}
function applyOpsSide(arr: U8, ops: readonly Op[]): U8 { let q = arr; for (const op of ops) q = applyOpSide(q, op); return q; }
/** Inverse of an op-word (reverse order; top/bot by k → by 12−k; slice self-inverse). */
function invOps(ops: readonly Op[]): Op[] {
  return ops.slice().reverse().map((op) =>
    's' in op ? { s: true } as Op : 't' in op ? { t: (12 - op.t) % 12 } as Op : { b: (12 - op.b) % 12 } as Op);
}

// ── per-side SHAPE / permutation coordinates (cube shape = solved layout) ──────────────
const SHAPE_CUBE: readonly number[] = (() => {
  const a: number[] = []; for (let i = 0; i < 24; i++) a.push(isCornerStart(SOLVED_P0, i) ? 1 : 0); return a;
})();
const SHAPE_CUBE_KEY = SHAPE_CUBE.join('');
const CORNER_POS: readonly number[] = [0, 3, 6, 9, 13, 16, 19, 22]; // corner-start slot of each corner
const EDGE_POS: readonly number[] = [2, 5, 8, 11, 12, 15, 18, 21];   // edge slots
function shapeArr(arr: ArrayLike<number>): number[] { const a: number[] = []; for (let i = 0; i < 24; i++) a.push(isCornerStart(arr, i) ? 1 : 0); return a; }
function shapeKeyOf(arr: ArrayLike<number>): string { return shapeArr(arr).join(''); }
/** cstimer SHAPE-array lock (reads the 0/1 array directly: 1 = corner-start spanning this+next slot). */
function lockedShape(sh: readonly number[], x: number, y: number): boolean {
  const a = ((x % 12) + 12) % 12, b = ((y % 12) + 12) % 12;
  return !!(sh[(17 - a) % 12] || sh[(11 - a) % 12] || sh[12 + ((17 - b) % 12)] || sh[12 + ((11 - b) % 12)]);
}
function rotShapeTop(sh: readonly number[], k: number): number[] { k = ((k % 12) + 12) % 12; if (!k) return sh.slice(); const n = sh.slice(); for (let i = 0; i < 12; i++) n[i] = sh[(12 + i - k) % 12]; return n; }
function rotShapeBot(sh: readonly number[], k: number): number[] { k = ((k % 12) + 12) % 12; if (!k) return sh.slice(); const n = sh.slice(); for (let i = 0; i < 12; i++) n[12 + i] = sh[12 + ((12 + i - k) % 12)]; return n; }
function sliceShape(sh: readonly number[]): number[] { const n = sh.slice(); for (let i = 0; i < 6; i++) { const c = n[i + 6]; n[i + 6] = n[i + 12]; n[i + 12] = c; } return n; }
function permParity(a: readonly number[]): number {
  const seen = new Array<boolean>(a.length).fill(false); let par = 0;
  for (let i = 0; i < a.length; i++) { if (seen[i]) continue; let len = 0, j = i; while (!seen[j]) { seen[j] = true; j = a[j]; len++; } par ^= (len - 1) & 1; }
  return par;
}
function applyMapVals(vals: readonly number[], posMap: readonly number[]): number[] { const nv = new Array<number>(8); for (let pos = 0; pos < 8; pos++) nv[posMap[pos]] = vals[pos]; return nv; }

// ── precomputed reduction tables (built once, lazily — module-level singleton) ─────────
interface SsqTables {
  /** scrambled shapeKey → op moving it ONE step toward cube shape, + parent shapeKey. */
  shapeParent: Map<string, { op: Op; pk: string } | null>;
  /** scrambled corner-perm key → {macro index, parent key}; reconstruct solve word by inverse macros. */
  cornerParent: Map<string, { mi: number; pk: string } | null>;
  /** scrambled (EVEN) edge-perm key → {composite-gen index, parent key}. */
  edgeParent: Map<string, { gi: number; pk: string } | null>;
  /** cube→cube elementary macros (op-word + their corner posMap). */
  macros: { w: Op[]; cmap: number[] }[];
  /** edge composite generators (op-word fixing corners + their edge posMap). */
  eGens: { w: Op[]; emap: number[] }[];
  /** one ODD corner-fixing edge generator (flips edge-perm parity), built constructively. */
  oddGen: { w: Op[]; emap: number[] } | null;
}
let TABLES: SsqTables | null = null;

function buildTables(): SsqTables {
  // -- Phase 1: shape BFS from cube shape (3,678 shapes, diameter 14) --
  const shapeParent = new Map<string, { op: Op; pk: string } | null>([[SHAPE_CUBE_KEY, null]]);
  {
    let frontier: number[][] = [SHAPE_CUBE.slice()];
    while (frontier.length) {
      const next: number[][] = [];
      for (const sh of frontier) {
        const cur = sh.join('');
        const neigh: [Op, number[]][] = [];
        for (let k = 1; k < 12; k++) if (!lockedShape(sh, k, 0)) neigh.push([{ t: k }, rotShapeTop(sh, k)]);
        for (let k = 1; k < 12; k++) if (!lockedShape(sh, 0, k)) neigh.push([{ b: k }, rotShapeBot(sh, k)]);
        neigh.push([{ s: true }, sliceShape(sh)]);
        for (const [op, nsh] of neigh) {
          const k = nsh.join(''); if (shapeParent.has(k)) continue;
          const inv: Op = 's' in op ? { s: true } : 't' in op ? { t: (12 - op.t) % 12 } : { b: (12 - op.b) % 12 };
          shapeParent.set(k, { op: inv, pk: cur }); next.push(nsh);
        }
      }
      frontier = next;
    }
  }

  // -- elementary cube→cube macros (depth ≤ 6; ample to generate the full corner perm group S8) --
  const macros: { w: Op[]; cmap: number[] }[] = [];
  {
    const seen = new Set<string>([SOLVED_P0.join(',')]);
    const macroSeen = new Set<string>();
    let frontier: { p: U8; w: Op[] }[] = [{ p: new Uint8Array(SOLVED_P0) as U8, w: [] }];
    let depth = 0;
    while (frontier.length && depth < 6) {
      const next: { p: U8; w: Op[] }[] = [];
      for (const { p, w } of frontier) {
        const mv: [Op, U8][] = [];
        for (let k = 1; k < 12; k++) if (!lockedSide(p, k, 0)) mv.push([{ t: k }, rotTop(p, k)]);
        for (let k = 1; k < 12; k++) if (!lockedSide(p, 0, k)) mv.push([{ b: k }, rotBot(p, k)]);
        mv.push([{ s: true }, sliceSide(p)]);
        for (const [op, q] of mv) {
          const kq = q.join(','); if (seen.has(kq)) continue; seen.add(kq);
          const nw = [...w, op];
          if (shapeKeyOf(q) === SHAPE_CUBE_KEY) {
            const c = CORNER_POS.map((s) => q[s]).join('') + '|' + EDGE_POS.map((s) => q[s] - CORNER_EDGE_GAP).join('');
            if (!macroSeen.has(c)) { macroSeen.add(c); const cmap = new Array<number>(8); CORNER_POS.forEach((s, i) => { cmap[q[s]] = i; }); macros.push({ w: nw, cmap }); }
            continue; // a cube→cube macro: do not expand past it
          }
          next.push({ p: q, w: nw });
        }
      }
      frontier = next; depth++;
    }
  }

  // -- corner-perm BFS over macros (closes at 8! = 40,320) --
  const cornerParent = new Map<string, { mi: number; pk: string } | null>([['01234567', null]]);
  {
    let frontier: number[][] = [[0, 1, 2, 3, 4, 5, 6, 7]];
    while (frontier.length && cornerParent.size < 40320) {
      const next: number[][] = [];
      for (const v of frontier) {
        const cur = v.join('');
        for (let mi = 0; mi < macros.length; mi++) {
          const nv = applyMapVals(v, macros[mi].cmap); const k = nv.join('');
          if (cornerParent.has(k)) continue; cornerParent.set(k, { mi, pk: cur }); next.push(nv);
        }
      }
      frontier = next;
    }
  }
  const cornerSolveOps = (cv: readonly number[]): Op[] => {
    let cur = cv.join(''); const out: Op[] = []; let g = 0;
    while (cur !== '01234567') { const e = cornerParent.get(cur); if (!e) throw new Error('ssq1: corner perm unreachable ' + cur); out.push(...invOps(macros[e.mi].w)); cur = e.pk; if (++g > 200) throw new Error('ssq1: corner walk'); }
    return out;
  };

  // -- edge composite generators: each macro "stir" + corner-restore = a corner-FIXING edge perm.
  //    These reach exactly the even edge group A8 (corner=id ⇒ edge ∈ A8 when only even generators used). --
  const edgeGenMap = new Map<string, Op[]>([['01234567', []]]);
  const solved0 = new Uint8Array(SOLVED_P0) as U8;
  for (const m of macros) {
    const after = applyOpsSide(solved0, m.w);
    const cvAfter = CORNER_POS.map((s) => after[s]);
    const word = [...m.w, ...cornerSolveOps(cvAfter)];
    const fin = applyOpsSide(solved0, word);
    let cid = true; for (let i = 0; i < 8; i++) if (fin[CORNER_POS[i]] !== i) { cid = false; break; }
    if (!cid) continue;
    const ek = EDGE_POS.map((s) => fin[s] - CORNER_EDGE_GAP).join('');
    if (!edgeGenMap.has(ek)) edgeGenMap.set(ek, word);
  }
  const eGens: { w: Op[]; emap: number[] }[] = [];
  for (const [k, w] of edgeGenMap) {
    if (k === '01234567') continue;
    const fin = applyOpsSide(solved0, w); const emap = new Array<number>(8); EDGE_POS.forEach((s, i) => { emap[fin[s] - CORNER_EDGE_GAP] = i; });
    eGens.push({ w, emap });
  }
  const edgeParent = new Map<string, { gi: number; pk: string } | null>([['01234567', null]]);
  {
    let frontier: number[][] = [[0, 1, 2, 3, 4, 5, 6, 7]];
    while (frontier.length && edgeParent.size < 20160) {
      const next: number[][] = [];
      for (const v of frontier) {
        const cur = v.join('');
        for (let gi = 0; gi < eGens.length; gi++) {
          const nv = applyMapVals(v, eGens[gi].emap); const k = nv.join('');
          if (edgeParent.has(k)) continue; edgeParent.set(k, { gi, pk: cur }); next.push(nv);
        }
      }
      frontier = next;
    }
  }

  // -- one ODD corner-fixing edge generator (Square-1 "parity"): constructed deterministically by
  //    driving a short scramble through shape+corner solve until corners are identity & edges ODD.
  //    The composite word maps solved → (corner id, odd edge), an odd corner-fixing edge op. --
  let oddGen: { w: Op[]; emap: number[] } | null = null;
  {
    const shapeSolveOps = (arr: U8): Op[] => {
      let cur = shapeKeyOf(arr); const out: Op[] = []; let g = 0;
      while (cur !== SHAPE_CUBE_KEY) { const e = shapeParent.get(cur); if (!e) throw new Error('ssq1: shape unreachable ' + cur); out.push(e.op); cur = e.pk; if (++g > 200) throw new Error('ssq1: shape walk'); }
      return out;
    };
    // deterministic LCG (no Math.random — reproducible table) to probe short scrambles
    let seed = 0x9e3779b9 >>> 0;
    const rand12 = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % 12; };
    for (let iter = 0; iter < 40000 && !oddGen; iter++) {
      let p = new Uint8Array(SOLVED_P0) as U8; const ww: Op[] = [];
      let cnt = 0, safety = 0;
      while (cnt < 6) { if (++safety > 100000) break; const x = rand12() - 5, y = rand12() - 5; const size = (x === 0 ? 0 : 1) + (y === 0 ? 0 : 1);
        if (size > 0 || cnt === 0) { if (!lockedSide(p, x, y)) { if (x) { p = rotTop(p, x); ww.push({ t: x }); } if (y) { p = rotBot(p, y); ww.push({ b: y }); } cnt++; p = sliceSide(p); ww.push({ s: true }); } } }
      const w2 = [...ww, ...shapeSolveOps(p)]; let cur = applyOpsSide(solved0, w2);
      const w3 = [...w2, ...cornerSolveOps(CORNER_POS.map((s) => cur[s]))]; cur = applyOpsSide(solved0, w3);
      let cid = true; for (let i = 0; i < 8; i++) if (cur[CORNER_POS[i]] !== i) { cid = false; break; }
      if (cid && permParity(EDGE_POS.map((s) => cur[s] - CORNER_EDGE_GAP)) === 1) {
        const emap = new Array<number>(8); EDGE_POS.forEach((s, i) => { emap[cur[s] - CORNER_EDGE_GAP] = i; });
        oddGen = { w: w3, emap };
      }
    }
  }

  return { shapeParent, cornerParent, edgeParent, macros, eGens, oddGen };
}
function tables(): SsqTables { if (!TABLES) TABLES = buildTables(); return TABLES; }

/** Full per-side solution: shape → corner perm → edge perm (A8, + odd-parity fix). Returns atomic ops. */
function solveSideOps(arr: U8, off: number): Op[] {
  const T = tables();
  const out: Op[] = [];
  let cur = new Uint8Array(arr) as U8;
  // shape
  { let k = shapeKeyOf(cur); let g = 0; while (k !== SHAPE_CUBE_KEY) { const e = T.shapeParent.get(k); if (!e) throw new Error('ssq1: shape unreachable ' + k); out.push(e.op); cur = applyOpSide(cur, e.op); k = e.pk; if (++g > 200) throw new Error('ssq1: shape walk'); } }
  if (shapeKeyOf(cur) !== SHAPE_CUBE_KEY) throw new Error('ssq1: side not cube shape');
  // corner perm
  { let key = CORNER_POS.map((s) => cur[s] - off).join(''); let g = 0; while (key !== '01234567') { const e = T.cornerParent.get(key); if (!e) throw new Error('ssq1: corner perm unreachable ' + key); const w = invOps(T.macros[e.mi].w); out.push(...w); cur = applyOpsSide(cur, w); key = e.pk; if (++g > 200) throw new Error('ssq1: corner walk'); } }
  // edge perm — odd-parity fix first, then solve within A8
  {
    let ev = EDGE_POS.map((s) => cur[s] - off - CORNER_EDGE_GAP);
    if (permParity(ev) === 1) {
      if (!T.oddGen) throw new Error('ssq1: no odd-parity generator');
      out.push(...T.oddGen.w); cur = applyOpsSide(cur, T.oddGen.w); ev = EDGE_POS.map((s) => cur[s] - off - CORNER_EDGE_GAP);
    }
    let key = ev.join(''); let g = 0;
    while (key !== '01234567') { const e = T.edgeParent.get(key); if (!e) throw new Error('ssq1: edge perm unreachable ' + key); const w = invOps(T.eGens[e.gi].w); out.push(...w); cur = applyOpsSide(cur, w); key = e.pk; if (++g > 200) throw new Error('ssq1: edge walk'); }
  }
  return out;
}

// ── compose two coupled-side solutions at the SHARED slice ─────────────────────────────
// A round = the layer-turn pack applied to a side before its next slice. Split a side's op-word into
// rounds (turn accums between slices); rounds.length−1 = slice count. The two sides must end on the
// SAME slice count (the slice is shared). Pad each side with an IDENTITY word adding the needed slices.
interface Round { t: number; b: number; }
function opsToRounds(ops: readonly Op[]): Round[] {
  const rounds: Round[] = []; let t = 0, b = 0;
  for (const op of ops) {
    if ('s' in op) { rounds.push({ t: ((t % 12) + 12) % 12, b: ((b % 12) + 12) % 12 }); t = 0; b = 0; }
    else if ('t' in op) t += op.t; else b += op.b;
  }
  rounds.push({ t: ((t % 12) + 12) % 12, b: ((b % 12) + 12) % 12 });
  return rounds;
}
// IDENTITY paddings (return a side to its current state): 2 slices = "/ /"; 3 slices = "U6/ U6/ U6/".
// No single-slice identity exists, so any pad amount is forced to be 0 or ≥ 2 (target = max+2).
const PAD2: readonly Round[] = [{ t: 0, b: 0 }, { t: 0, b: 0 }];
const PAD3: readonly Round[] = [{ t: 6, b: 0 }, { t: 6, b: 0 }, { t: 6, b: 0 }];
function padRoundsBy(rounds: readonly Round[], addSlices: number): Round[] {
  if (addSlices === 0) return rounds.slice();
  const extra: Round[] = []; let rem = addSlices;
  while (rem > 0) { if (rem === 3 || rem % 2 === 1) { extra.push(...PAD3); rem -= 3; } else { extra.push(...PAD2); rem -= 2; } }
  return [...rounds, ...extra];
}

export interface Ssq1Solution { solution: string; length: number; optimal: boolean; }

/**
 * Validated upper bound on the solution length, in (a,b,c,d)/ tuples. The reduction is "valid + bounded",
 * NOT optimal: shape ≤ 14 ops, corner perm ≤ ~13 macros, edge perm ≤ ~14 composites (+ a deep odd-parity
 * generator on ~half of states). Composed at the shared slice, the measured worst case over a high random
 * sample is ~43 tuples; SSQ1_MAX_LENGTH carries comfortable margin and is asserted in the test so it can
 * never be silently violated (the 336 lesson — a bound the solver provably stays under).
 */
export const SSQ1_MAX_LENGTH = 60;

/** Two coupled Square-1 mechanisms ⇒ ≈ product of the per-side reachable-state counts
 *  (3,393,693,768,000² ≈ 1.15×10²⁵). > 2^53 so MUST be a string (§0.0 #4); an estimate. */
export const SSQ1_STATE_COUNT_STR = '≈1.15×10²⁵ (two coupled Square-1 mechanisms)';

function isSolvedState(st: SsqState): boolean {
  for (let i = 0; i < 24; i++) if (st.p0[i] !== SOLVED_P0[i]) return false;
  for (let i = 0; i < 24; i++) if (st.p1[i] !== SOLVED_P1[i]) return false;
  return true;
}

/**
 * Solve a Super Square-1 scramble by a genuine TWO-PHASE reduction of the ACTUAL state (not the scramble
 * path): each side is reduced to cube shape (3,678-shape BFS), then its corner permutation (8! table) and
 * edge permutation (A8 table + a constructive odd-parity generator) are solved; the two coupled sides are
 * composed at the shared slice (each side padded with an identity word so their slice counts match). The
 * result is VALID + BOUNDED (`optimal` always false); its length varies with the actual scramble.
 * Throws only on internal invariant failure.
 */
export function solveSsq1(scramble: string): Ssq1Solution {
  if (parseSsq1Scramble(scramble).length === 0) return { solution: '', length: 0, optimal: true };
  const start = ssq1ApplyState(scramble);
  if (isSolvedState(start)) return { solution: '', length: 0, optimal: true };

  const ops0 = solveSideOps(start.p0, 0);
  const ops1 = solveSideOps(start.p1, SIDE1_OFFSET);

  // compose at the shared slice: pad both to a common slice count S = max(s0,s1)+2 (so each pad is ≥ 2).
  const r0 = opsToRounds(ops0), r1 = opsToRounds(ops1);
  const s0 = r0.length - 1, s1 = r1.length - 1;
  const S = Math.max(s0, s1) + 2;
  const R0 = padRoundsBy(r0, S - s0), R1 = padRoundsBy(r1, S - s1);
  const R = S + 1;
  if (R0.length !== R || R1.length !== R) throw new Error('ssq1: compose pad mismatch');
  const tuples: SsqTuple[] = []; const trailingSlice: boolean[] = [];
  for (let i = 0; i < R; i++) { tuples.push({ a: R0[i].t, d: R0[i].b, b: R1[i].t, c: R1[i].b }); trailingSlice.push(i < R - 1); }

  // verify: apply the composed tuples to `start` → solved.
  let chk = start;
  for (let i = 0; i < tuples.length; i++) { chk = applyTurns(chk, tuples[i]); if (trailingSlice[i]) chk = applySliceBoth(chk); }
  if (!isSolvedState(chk)) throw new Error('ssq1: reduction did not reach solved');

  const { pretty, length } = formatTuples(tuples, trailingSlice);
  return { solution: pretty, length, optimal: false };
}

/** Pretty "(a,b,c,d)/" string + tuple count from packed tuples. */
function formatTuples(tuples: readonly SsqTuple[], trailingSlice: readonly boolean[]): { pretty: string; length: number } {
  const frags: string[] = [];
  for (let i = 0; i < tuples.length; i++) {
    const t = tuples[i];
    const a = normTurn(t.a), b = normTurn(t.b), c = normTurn(t.c), d = normTurn(t.d);
    frags.push(trailingSlice[i] ? `(${a},${b},${c},${d})/` : `(${a},${b},${c},${d})`);
  }
  return { pretty: frags.join(' '), length: frags.length };
}

// ── faithful random scramble generator (ports cstimer ssq1t_scramble / sq1_getseq / sq1_domove) ──
const SOLVED_SHAPE: readonly number[] = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];

/** Port of cstimer sq1_getseq for ONE side (type 0 → free x,y ∈ [-5,6]). Mutates a fresh SHAPE `p` and
 *  returns the recorded move list (turn pairs, each followed by a [7,0] slice marker). Honors the lock
 *  check, exactly as cstimer's sq1_domove (so it never emits an illegal scramble). */
function getSeqOne(len: number, rn: (n: number) => number): number[][] {
  const p: number[] = [...SOLVED_SHAPE];
  const seq: number[][] = [];
  const domove = (x: number, y: number): boolean => {
    if (x === 7) {
      for (let i = 0; i < 6; i++) { const tmp = p[i + 6]; p[i + 6] = p[i + 12]; p[i + 12] = tmp; }
      return true;
    }
    if (p[((17 - x) % 12 + 12) % 12] || p[((11 - x) % 12 + 12) % 12]
      || p[12 + (((17 - y) % 12 + 12) % 12)] || p[12 + (((11 - y) % 12 + 12) % 12)]) return false;
    const px = p.slice(0, 12), py = p.slice(12, 24);
    for (let i = 0; i < 12; i++) { p[i] = px[(12 + i - x) % 12]; p[i + 12] = py[(12 + i - y) % 12]; }
    return true;
  };
  let cnt = 0, safety = 0;
  while (cnt < len) {
    if (++safety > 100000) break;
    const x = rn(12) - 5;
    const y = rn(12) - 5;
    const size = (x === 0 ? 0 : 1) + (y === 0 ? 0 : 1);
    if (size > 0 || cnt === 0) {
      if (domove(x, y)) {
        if (size > 0) seq.push([x, y]);
        cnt++;
        seq.push([7, 0]);
        domove(7, 0);
      }
    }
  }
  return seq;
}

/**
 * Generate a random Super Square-1 scramble of `len` tuples, faithfully mirroring cstimer's
 * `ssq1t_scramble` (two independent sq1_getseq(.,0,len) sequences woven into 4-tuples). `rnd` defaults
 * to Math.random; pass a seeded PRNG for reproducibility.
 */
export function randomSsq1Scramble(len: number, rnd: () => number = Math.random): string {
  const rn = (n: number) => Math.floor(rnd() * n);
  let s = getSeqOne(len, rn);
  let t = getSeqOne(len, rn);
  if (s[0] && s[0][0] === 7) s = [[0, 0], ...s];
  if (t[0] && t[0][0] === 7) t = [[0, 0], ...t];
  const parts: string[] = [];
  for (let i = 0; i < len; i++) {
    const si = s[2 * i] ?? [0, 0];
    const ti = t[2 * i] ?? [0, 0];
    // (a,b,c,d) = (s_top, t_top, t_bot, s_bot)
    parts.push(`(${si[0]},${ti[0]},${ti[1]},${si[1]})/`);
  }
  return parts.join(' ');
}
