/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @module pages/analyze/worker/analyzer.worker
 *
 * **NOT the runtime artifact** — kept as a TS-typed reference / future migration
 * target. Runtime classic worker is the type-stripped twin at
 * `public/analyze-worker/analyzer.js`. Reason: Vite's worker bundling places
 * the worker into module-strict semantics that break the legacy data files
 * (boohoo.js et al.) which use implicit-global assignment.
 *
 * 3x3 CFOP scramble analyzer Worker — TS port of speedcubedb.com's
 * /earphones/ear.js. Cube model, hash tables, and alg dictionaries are
 * loaded verbatim from the legacy data files (boohoo / hs / zbh) via
 * importScripts so recognition keys + dictionary entries stay byte-identical
 * to the upstream reference implementation. Anything in *this* file is
 * pure control flow (cross IDA*, F2L queue, LL recognition pipeline).
 *
 * Verified to produce identical totals to speedcubedb for the canonical
 * scrambles: see commit history.
 *
 * The legacy obfuscated `ear.legacy.js` is preserved alongside the data
 * files and can be swapped in via `?worker=legacy` URL flag.
 *
 * ── Future optimization opportunities ──────────────────────────────────
 * The hottest path is `NxN.new_NxN_Data(parent) + ProcessMoves(child)`
 * called O(18 × pops) times in the cross planner. To go faster:
 *   1. Replace cube state with a 54-byte Uint8Array; precompute 18 move
 *      permutations (R/U/L/D/F/B × {1,2,'} ); applyMove becomes one tight
 *      typed-array index swap. Convert back to NxN_Data only at cross
 *      leaves (handed off to F2L planner).
 *   2. Skip cube state cloning by mutating a scratch + applying inverse
 *      after each child evaluation. Only clone when keeping the state.
 *   3. Skip BinaryHeap (constant-0 score in F2L/LL planners) — but the
 *      heap's exact pop order is load-bearing for total counts, so any
 *      replacement must preserve ordering exactly. Non-trivial.
 *
 * Each of these requires byte-identical verification (compare totals
 * against legacy worker for a battery of scrambles) before shipping.
 * Deferred until that verification harness exists.
 */

// NOTE: classic worker — NO import/export at top level (importScripts only
// exists in classic workers; ES module syntax is a runtime SyntaxError here).
// Type stubs are local since they can't cross the module boundary.
declare const importScripts: (...urls: string[]) => void;
declare const NxN: any;
declare const NxN_AlgHandler: any;
type NxNState = { mat: Record<'U' | 'D' | 'F' | 'B' | 'L' | 'R', string[][]>; [k: string]: unknown };
type F2LOption = [string, string];

// NOTE: load order matters — boohoo.js's top-level statements reference `let`
// bindings (OLLHashTable, ZBLLHashTable etc.) defined by hs.js / zbh.js.
// Must match legacy ear.js order: hs.js, zbh.js, boohoo.js.
importScripts(
  '/analyze-worker/hs.js',
  '/analyze-worker/zbh.js',
  '/analyze-worker/boohoo.js',
);

// Two wasm solvers coexist in the same worker. Both are emscripten-default
// compiled and pollute globals (Module, HEAPU8, wasmExports, _malloc, ...) when
// loaded; we avoid the collision by wrapping the SECOND module's source in an
// IIFE so its var-declarations stay function-local (see analyzer.js comment for
// full notes).
type EmModule = { locateFile?: (p: string) => string; onRuntimeInitialized?: () => void; solve?: (...args: unknown[]) => void };
declare const self: {
  Module: EmModule;
  PseudoModuleStash: EmModule;
  EOCrossStash: EmModule;
  PairingStash: EmModule;
  PseudoPairingStash: EmModule;
  postMessage: (msg: unknown) => void;
  onmessage: ((e: MessageEvent<AnalyzeRequest>) => void) | null;
};
const _isNode = typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node === 'string';
// xcross — standard loader pattern, owns the global emscripten namespace.
self.Module = _isNode ? {} : { locateFile: (p: string) => '/analyze-worker/xcross/' + p };
const xcrossReady = new Promise<void>((resolve) => {
  self.Module.onRuntimeInitialized = () => resolve();
});
const xcrossModule = self.Module;
importScripts('/analyze-worker/xcross/solver.js');
// pseudo — IIFE-wrapped, picks up its config from self.PseudoModuleStash.
self.PseudoModuleStash = _isNode ? {} : { locateFile: (p: string) => '/analyze-worker/pseudo-cross/' + p };
const pseudoReady = new Promise<void>((resolve) => {
  self.PseudoModuleStash.onRuntimeInitialized = () => resolve();
});
const pseudoModule = self.PseudoModuleStash;
importScripts('/analyze-worker/pseudo-cross/pseudo-wrapped.js');
// EOCross — IIFE-wrapped, solve(scr, rot, slot, num, len, ...) 11 args, no pslot.
self.EOCrossStash = _isNode ? {} : { locateFile: (p: string) => '/analyze-worker/eocross/' + p };
const eoCrossReady = new Promise<void>((resolve) => {
  self.EOCrossStash.onRuntimeInitialized = () => resolve();
});
const eoCrossModule = self.EOCrossStash;
importScripts('/analyze-worker/eocross/solver-wrapped.js');
// F2L_PairingSolver — IIFE-wrapped, solve(scr, rot, slot, pslot, num, len, ...) 12 args.
self.PairingStash = _isNode ? {} : { locateFile: (p: string) => '/analyze-worker/pair/' + p };
const pairingReady = new Promise<void>((resolve) => {
  self.PairingStash.onRuntimeInitialized = () => resolve();
});
const pairingModule = self.PairingStash;
importScripts('/analyze-worker/pair/pairing_solver-wrapped.js');
// pseudoPairingSolver — IIFE-wrapped, solve(scr, rot, slot, pslot, a_slot, a_pslot, num, len, ...) 14 args.
self.PseudoPairingStash = _isNode ? {} : { locateFile: (p: string) => '/analyze-worker/pseudo-pair/' + p };
const pseudoPairingReady = new Promise<void>((resolve) => {
  self.PseudoPairingStash.onRuntimeInitialized = () => resolve();
});
const pseudoPairingModule = self.PseudoPairingStash;
importScripts('/analyze-worker/pseudo-pair/pseudoPairingSolver-wrapped.js');

// ── Types ─────────────────────────────────────────────────────────────

type CrossColor = 'Yellow' | 'White' | 'Blue' | 'Green' | 'Red' | 'Orange';
type Howfar = 1 | 2 | 3 | 4;
type Stage = 'cross' | 'xcross' | 'xxcross' | 'xxxcross';
type Variant = 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair';

interface AnalyzeRequest {
  scramble: string;
  crosscolors: Record<CrossColor, boolean>;
  howfar: Howfar;
  variant?: Variant;
  stage?: Stage;
  // Legacy keys still accepted by the runtime worker for back-compat with older test fixtures.
  stage1?: Stage;
  pseudo?: boolean;
}

type Solution = [etm: number, alg: string, state: NxNState, stages: string[]];

// ── Queues ─────────────────────────────────────────────────────────────

/**
 * Provably-equivalent O(1) replacement for BinaryHeap when scoreFn is constant.
 * Trace: with all scores equal, bubbleUp/sinkDown never swap (`0 >= 0` and
 * `0 < 0` are both false), so push degenerates to `array.push` and pop
 * degenerates to "return [0], copy last to [0], drop last". This class
 * preserves the exact pop order produced by the upstream BinaryHeap when
 * scores are constant. Used in F2LPlanner / LLPlanner where score is `() => 0`.
 *
 * ~10x faster than BinaryHeap for 7000+ pops on long scrambles, no
 * change to total counts.
 */
class ConstScoreQueue<T> {
  private content: T[] = [];
  push(item: T): void { this.content.push(item); }
  pop(): T {
    const top = this.content[0];
    const last = this.content.pop()!;
    if (this.content.length > 0) this.content[0] = last;
    return top;
  }
  size(): number { return this.content.length; }
}

class BinaryHeap<T> {
  private content: T[] = [];
  private scoreFn: (item: T) => number;
  constructor(scoreFn: (item: T) => number) { this.scoreFn = scoreFn; }
  push(item: T): void {
    this.content.push(item);
    this.bubbleUp(this.content.length - 1);
  }
  pop(): T {
    const top = this.content[0];
    const last = this.content.pop()!;
    if (this.content.length > 0) {
      this.content[0] = last;
      this.sinkDown(0);
    }
    return top;
  }
  size(): number { return this.content.length; }
  private bubbleUp(n: number): void {
    const item = this.content[n];
    const score = this.scoreFn(item);
    while (n > 0) {
      const parentN = Math.floor((n + 1) / 2) - 1;
      const parent = this.content[parentN];
      if (score >= this.scoreFn(parent)) break;
      this.content[parentN] = item;
      this.content[n] = parent;
      n = parentN;
    }
  }
  private sinkDown(n: number): void {
    const len = this.content.length;
    const item = this.content[n];
    const score = this.scoreFn(item);
    while (true) {
      const r = (n + 1) * 2;
      const l = r - 1;
      let swap: number | null = null;
      let leftScore = 0;
      if (l < len) {
        leftScore = this.scoreFn(this.content[l]);
        if (leftScore < score) swap = l;
      }
      if (r < len) {
        const rightScore = this.scoreFn(this.content[r]);
        if (rightScore < (swap === null ? score : leftScore)) swap = r;
      }
      if (swap === null) break;
      this.content[n] = this.content[swap];
      this.content[swap] = item;
      n = swap;
    }
  }
}

// ── Cross planner ──────────────────────────────────────────────────────

const CROSS_INSPECTION: Record<CrossColor, string> = {
  Yellow: '',
  White: 'z2',
  Blue: 'x',
  Green: "x'",
  Red: 'z',
  Orange: "z'",
};

const FACES = ['R', 'U', 'L', 'D', 'F', 'B'] as const;
const SUFFIXES = ['', "'", '2'] as const;
// Canonical order within each opposite pair: R before L, U before D, F before B.
// "After canonical-second, prune canonical-first" → never enumerate `L R` after
// `R L` was already enumerated for the same final state.
const CANONICAL_REVERSE_OPPOSITE: Record<string, string> = { L: 'R', D: 'U', B: 'F' };

type CrossNode = [scoreNeg: number, depth: number, alg: string, state: NxNState, lastFace: string];
type CrossResult = [alg: string, state: NxNState, score: number];

let totalNumCross = 0;

class NxNCrossPlanner {
  readonly sides = CROSS_INSPECTION;
  private maxDepth: Record<CrossColor, number> = {
    Yellow: 7, White: 7, Blue: 7, Green: 7, Red: 7, Orange: 7,
  };
  private queues: Partial<Record<CrossColor, BinaryHeap<CrossNode>>> = {};

  constructor(scramble: string) {
    for (const color of Object.keys(this.sides) as CrossColor[]) {
      // Build the post-scramble + post-inspection state, then push 4 AUF rotations as roots.
      const start = NxN.new_NxN_Data(3);
      NxN.ProcessMoves(start, scramble);
      NxN.ProcessMoves(start, this.sides[color]);

      const root = NxN.new_NxN_Data(start);
      this.push(color, [1000, 0, (this.sides[color] + ' // Inspection\n').trimStart(), root, ' ']);

      const rY = NxN.new_NxN_Data(start);
      NxN.ProcessMoves(start, 'y'); // matches upstream ordering — see ear.legacy.js
      this.push(color, [1000, 0, (this.sides[color] + ' y // Inspection\n').trimStart(), rY, ' ']);

      const rY2 = NxN.new_NxN_Data(start);
      NxN.ProcessMoves(rY2, 'y2');
      this.push(color, [1000, 0, (this.sides[color] + ' y2 // Inspection\n').trimStart(), rY2, ' ']);

      const rYp = NxN.new_NxN_Data(start);
      NxN.ProcessMoves(rYp, "y'");
      this.push(color, [1000, 0, (this.sides[color] + " y' // Inspection\n").trimStart(), rYp, ' ']);
    }
  }

  private push(color: CrossColor, item: CrossNode): void {
    if (!Object.prototype.hasOwnProperty.call(this.queues, color)) {
      this.queues[color] = new BinaryHeap<CrossNode>((x) => x[0]);
    }
    this.queues[color]!.push(item);
  }

  processOptions(color: CrossColor, maxIter: number, maxFound: number): CrossResult[] {
    const out: CrossResult[] = [];
    const queue = this.queues[color];
    if (!queue) return out;
    for (let iter = 0; iter < maxIter; iter++) {
      if (queue.size() === 0) break;
      if (out.length >= maxFound) break;
      const cur = queue.pop();
      if (cur[1] + 1 > this.maxDepth[color]) continue;
      for (const face of FACES) {
        // Same-face never twice in a row; opposite-face only in canonical order.
        // Upstream `ear.js` had a dead opposite-face check (parallel array indexed
        // by string key always returns undefined) so its cross search double-counted
        // every opposite-pair reordering. We diverge here. Use `?worker=legacy` for
        // byte-identical upstream totals.
        if (face === cur[4]) continue;
        if (CANONICAL_REVERSE_OPPOSITE[cur[4]] === face) continue;
        for (const suf of SUFFIXES) {
          const move = face + suf;
          const p = NxN.new_NxN_Data(cur[3]);
          NxN.ProcessMoves(p, move);
          // Cross petals = 4 means D-edges placed and oriented relative to centers.
          const m = p.mat;
          let petals = 0;
          if (m.D[1][1] === m.D[0][1] && m.F[1][1] === m.F[2][1]) petals++;
          if (m.D[1][1] === m.D[1][0] && m.L[1][1] === m.L[2][1]) petals++;
          if (m.D[1][1] === m.D[2][1] && m.B[1][1] === m.B[2][1]) petals++;
          if (m.D[1][1] === m.D[1][2] && m.R[1][1] === m.R[2][1]) petals++;
          if (petals === 4) {
            const pairsAfter = NxN.getAmountOfSolvedPairs(p);
            const xs = 'X'.repeat(pairsAfter);
            const alg = cur[2] + move + ' // ' + color + ' ' + xs + 'Cross';
            // Dynamic prune: subsequent crosses must be at most 1 move worse, floor at 5.
            this.maxDepth[color] = Math.min(this.maxDepth[color], cur[1] + 2);
            this.maxDepth[color] = Math.max(5, this.maxDepth[color]);
            const score = pairsAfter * 10 - cur[1] + 1;
            out.push([alg, p, score]);
            totalNumCross++;
            postMessage({ totalnumcross: totalNumCross });
            continue;
          }
          // Heuristic: petals (5x) + center matches (3x) − depth penalty (10x).
          let centers = 0;
          if (m.D[1][1] === m.D[0][1]) centers++;
          if (m.D[1][1] === m.D[1][0]) centers++;
          if (m.D[1][1] === m.D[2][1]) centers++;
          if (m.D[1][1] === m.D[1][2]) centers++;
          let h = petals * 5 + centers * 3 + (cur[1] + 1) * -10;
          this.push(color, [-h, cur[1] + 1, cur[2] + move + ' ', p, face]);
        }
      }
    }
    return out;
  }
}

// ── F2L planner ────────────────────────────────────────────────────────

type F2LNode = [alg: string, state: NxNState];

class F2LPlanner {
  private queue = new ConstScoreQueue<F2LNode | CrossResult>();
  constructor(seeds: CrossResult[]) {
    for (const c of seeds) this.queue.push(c);
  }
  processOptions(howfar: Howfar): Solution[] {
    const out: Solution[] = [];
    let counter = 0;
    while (this.queue.size() !== 0) {
      const cur = this.queue.pop() as F2LNode | CrossResult;
      // CrossResult is [alg, state, score]; F2LNode is [alg, state] — both share index 0/1.
      const solvedBefore = NxN.getAmountOfSolvedPairs(cur[1]);
      // If seed already meets howfar (e.g. xcross seed with 1 pair, howfar=1),
      // emit directly as final — don't search further pairs.
      if (solvedBefore >= howfar) {
        out.push([NxN_AlgHandler.calculateETM(cur[0]), cur[0], cur[1] as NxNState, []]);
        if (counter++ % 250 === 0) postMessage({ pairscovered: counter });
        continue;
      }
      const opts: F2LOption[] = NxN.getF2LOptions(cur[1]);
      for (const opt of opts) {
        const p = NxN.new_NxN_Data(cur[1]);
        NxN.ProcessMoves(p, opt[1]);
        const solvedAfter = NxN.getAmountOfSolvedPairs(p);
        let alg = cur[0] + '\n' + opt[1] + ' // Pair ' + (solvedBefore + 1);
        for (let j = solvedBefore + 2; j <= solvedAfter; j++) alg += ' & ' + j;
        if (solvedAfter >= howfar) {
          out.push([NxN_AlgHandler.calculateETM(alg), alg, p, []]);
        } else {
          this.queue.push([alg, p] as F2LNode);
        }
      }
      if (counter++ % 250 === 0) postMessage({ pairscovered: counter });
    }
    postMessage({ pairscovered: counter });
    return out;
  }
}

// ── LL planner ─────────────────────────────────────────────────────────

// Identical arrays — only the index expression differs (orientation vs (orientation+2)%4).
const AUF_BEFORE = ['', "U' ", 'U2 ', 'U '] as const;
const FACE_TO_AUF_AFTER_PLL: Record<string, string> = { F: '', B: '\nU2 // AUF', R: '\nU ', L: ' U' };
const FACE_TO_AUF_LL_SKIP: Record<string, string> = { F: '', B: '\nU2 // AUF', R: "\nU' // AUF", L: '\nU // AUF' };

class LLPlanner {
  private queue = new ConstScoreQueue<Solution>();
  constructor(seeds: Solution[]) {
    for (const s of seeds) this.queue.push(s);
  }
  processOptions(): Solution[] {
    const out: Solution[] = [];
    let counter = 0;
    while (this.queue.size() !== 0) {
      const cur = this.queue.pop();
      const ollHash = NxN.getOLLHash(cur[2]);
      if (Object.prototype.hasOwnProperty.call(NxN.OLLHashTable, ollHash)) {
        const entry = NxN.OLLHashTable[ollHash];
        for (const rawAlg0 of NxN_AlgHandler.OLLDictionary[entry.name]) {
          let rawAlg = rawAlg0;
          const yPrefix = rawAlg.match(/^y[2]?'?/);
          let orientation = entry.orientation;
          if (yPrefix !== null) {
            const tok = yPrefix[0];
            if (tok === "y'") orientation = (orientation + 1) % 4;
            else if (tok === 'y2') orientation = (orientation + 2) % 4;
            else if (tok === 'y') orientation = (orientation + 4 - 1) % 4;
            rawAlg = rawAlg.replace(/^y[2]?'?/, '').trim();
          }
          let alg = AUF_BEFORE[orientation] + rawAlg;
          const flipped = AUF_BEFORE[(orientation + 2) % 4] + rawAlg;
          // OLL 20 is 4-fold symmetric (skip AUF); OLL 1 is 2-fold (special switch).
          if (entry.name === 'OLL 20') alg = rawAlg;
          if (entry.name === 'OLL 1') {
            if (orientation === 1 || orientation === 3) alg = flipped;
            else if (orientation === 2) alg = rawAlg;
          }
          const p = NxN.new_NxN_Data(cur[2]);
          NxN.ProcessMoves(p, alg);
          const newAlg = cur[1] + '\n' + alg + ' // OLL';
          this.queue.push([NxN_AlgHandler.calculateETM(cur[1]), newAlg, p, ['OLL']]);
          break; // upstream takes first dictionary entry only
        }
      } else {
        const pllHash = NxN.getNewPLLHash(NxN.getNormalizedPuzzle(cur[2]));
        if (Object.prototype.hasOwnProperty.call(NxN.PLLnewHashTable, pllHash)) {
          const entry = NxN.PLLnewHashTable[pllHash];
          for (const rawAlg0 of NxN_AlgHandler.PLLDictionary[entry.name]) {
            let rawAlg = rawAlg0;
            const yPrefix = rawAlg.match(/^y[2]?'?/);
            let orientation = entry.orientation;
            if (yPrefix !== null) {
              const tok = yPrefix[0];
              if (tok === "y'") orientation = (orientation + 1) % 4;
              else if (tok === 'y2') orientation = (orientation + 2) % 4;
              else if (tok === 'y') orientation = (orientation + 4 - 1) % 4;
              rawAlg = rawAlg.replace(/^y[2]?'?/, '').trim();
            }
            let alg = AUF_BEFORE[orientation % NxN_AlgHandler.PLLRot[entry.name]] + rawAlg;
            const probe = NxN.new_NxN_Data(cur[2]);
            NxN.ProcessMoves(probe, alg);
            const front = NxN.getNormalizedPuzzle(probe).mat.F[0][1];
            if (Object.prototype.hasOwnProperty.call(FACE_TO_AUF_AFTER_PLL, front)) {
              alg = alg + FACE_TO_AUF_AFTER_PLL[front];
            }
            const newState = NxN.new_NxN_Data(cur[2]);
            const newAlg = cur[1] + '\n' + alg + ' // PLL';
            const stages = cur[3];
            stages.push('PLL');
            out.push([NxN_AlgHandler.calculateETM(newAlg), newAlg, newState, stages]);
            break;
          }
        } else {
          // Already PLL skipped: just append final AUF based on F-face center color.
          const front = NxN.getNormalizedPuzzle(cur[2]).mat.F[0][1];
          let alg = cur[1];
          if (Object.prototype.hasOwnProperty.call(FACE_TO_AUF_LL_SKIP, front)) {
            alg = alg + FACE_TO_AUF_LL_SKIP[front];
          }
          out.push([NxN_AlgHandler.calculateETM(alg), alg, cur[2], cur[3] ?? []]);
        }
      }
      if (counter++ % 250 === 0) postMessage({ llcovered: counter });
    }
    postMessage({ llcovered: counter });
    out.sort((a, b) => a[0] - b[0]);
    return out;
  }
}

// ── Worker entry ───────────────────────────────────────────────────────

let finalSolutions: Solution[] = [];
let workingScramble = '';

// rotation strings match NxN_Data inspection AUF.
const XCROSS_ROTATIONS: Record<CrossColor, string> = {
  Yellow: '', White: 'z2', Blue: 'x', Green: "x'", Red: 'z', Orange: "z'",
};
// F2L solver semantics — slot count = exact pair count. 0=cross-only (used only
// by pseudo cross), 1=xcross, 2=xxcross, 3=xxxcross.
const XCROSS_SLOT_COMBOS: Record<0 | 1 | 2 | 3, string[][]> = {
  0: [[]],
  1: [['BL'], ['BR'], ['FR'], ['FL']],
  2: [['BL', 'BR'], ['BL', 'FR'], ['BL', 'FL'], ['BR', 'FR'], ['BR', 'FL'], ['FR', 'FL']],
  3: [['BR', 'FR', 'FL'], ['BL', 'FR', 'FL'], ['BL', 'BR', 'FL'], ['BL', 'BR', 'FR']],
};
// sol_num + post-filter optimal+1 per (color × slot combo). solNum scales down for
// higher-X to bound per-call wasm time on mobile.
const XCROSS_STAGE_PARAMS: Record<Stage, { pairs: 0 | 1 | 2 | 3; solNum: number; maxLen: number; nearOptDelta: number }> = {
  cross:    { pairs: 0, solNum: 20, maxLen: 10, nearOptDelta: 1 },
  xcross:   { pairs: 1, solNum: 20, maxLen: 12, nearOptDelta: 1 },
  xxcross:  { pairs: 2, solNum: 10, maxLen: 14, nearOptDelta: 1 },
  xxxcross: { pairs: 3, solNum: 5,  maxLen: 18, nearOptDelta: 1 },
};
const CENTER_OFFSET_REGULAR = 'EMPTY_EMPTY';
// pseudoCrossSolver center_offset: allow cross to land at {Solved, D, D', D2} via
// crest_mapping codes 0/1/2/3 = ""/y/y2/y'. See pseudo.cpp `buildCenterOffset`.
const PSEUDO_CENTER_OFFSET_ALL = "EMPTY_EMPTY|EMPTY_y|EMPTY_y2|EMPTY_y'";
// D-class fix-ups for detecting which offset a pseudo-cross result landed at.
const PSEUDO_OFFSET_FIXES = ['', 'D', 'D2', "D'"];
const XCROSS_TERMINALS = new Set(['Search finished.', 'Already solved.', 'Unsolvable.', 'Error']);

// Stage labels for new variants. xs = number of X prefixes (matches std XCross naming).
const STAGE_XS: Record<Stage, string> = { cross: '', xcross: 'X', xxcross: 'XX', xxxcross: 'XXX' };
// EO solutions take more moves (remaining edges must be EO). Bump maxLen vs std XCROSS_STAGE_PARAMS.
const EOCROSS_STAGE_PARAMS: Record<Stage, { pairs: 0 | 1 | 2 | 3; solNum: number; maxLen: number; nearOptDelta: number }> = {
  cross:    { pairs: 0, solNum: 20, maxLen: 12, nearOptDelta: 1 },
  xcross:   { pairs: 1, solNum: 20, maxLen: 14, nearOptDelta: 1 },
  xxcross:  { pairs: 2, solNum: 10, maxLen: 16, nearOptDelta: 1 },
  xxxcross: { pairs: 3, solNum: 5,  maxLen: 20, nearOptDelta: 1 },
};
// Pair-ready stages — alg ends right BEFORE the Setup+Insert that would close the pair.
const PAIR_STAGE_PARAMS: Record<Stage, { pairs: 0 | 1 | 2 | 3; solNum: number; maxLen: number; nearOptDelta: number }> = {
  cross:    { pairs: 0, solNum: 20, maxLen: 10, nearOptDelta: 1 },
  xcross:   { pairs: 1, solNum: 20, maxLen: 12, nearOptDelta: 1 },
  xxcross:  { pairs: 2, solNum: 10, maxLen: 14, nearOptDelta: 1 },
  xxxcross: { pairs: 3, solNum: 5,  maxLen: 18, nearOptDelta: 1 },
};
const PSEUDO_PAIR_STAGE_PARAMS = PAIR_STAGE_PARAMS;
// For Pseudo+Pair we restrict to matched a_slot==a_pslot to keep F2L planner handoff sane.
const F2L_SLOTS = ['BL', 'BR', 'FR', 'FL'] as const;

/** Run crossSolver.wasm in F2L mode once. Sync; monkey-patches postMessage to capture emit. */
function runXCrossWasmOnce(scramble: string, rotation: string, slot: string, solNum: number, maxLen: number, centerOffset: string): string[] {
  const collected: string[] = [];
  const orig = self.postMessage.bind(self);
  self.postMessage = (msg: unknown) => {
    if (typeof msg !== 'string') { orig(msg); return; }
    if (XCROSS_TERMINALS.has(msg)) return;
    if (msg.startsWith('depth')) return;
    collected.push(msg);
  };
  try {
    xcrossModule.solve!('F2L', scramble, rotation, slot, '', solNum, maxLen,
      'U_U2_U-_D_D2_D-_L_L2_L-_R_R2_R-_F_F2_F-_B_B2_B-',
      '', centerOffset || CENTER_OFFSET_REGULAR, 0, '', '');
  } finally {
    self.postMessage = orig;
  }
  return collected;
}

function runXCrossAllColors(scramble: string, crosscolors: Record<CrossColor, boolean>, stage: Stage): CrossResult[] {
  const params = XCROSS_STAGE_PARAMS[stage];
  const combos = XCROSS_SLOT_COMBOS[params.pairs];
  const xs = 'X'.repeat(params.pairs);
  const label = xs + 'Cross';
  const out: CrossResult[] = [];
  for (const color of Object.keys(XCROSS_ROTATIONS) as CrossColor[]) {
    if (crosscolors[color] === false) continue;
    const rotation = XCROSS_ROTATIONS[color];
    for (const slots of combos) {
      const slotStr = slots.join(' ');
      const wasmOuts = runXCrossWasmOnce(scramble, rotation, slotStr, params.solNum, params.maxLen, CENTER_OFFSET_REGULAR);
      const parsed = wasmOuts.map((w) => {
        const m = rotation && w.startsWith(rotation + ' ') ? w.substring(rotation.length + 1) : w;
        return { moves: m, len: m.split(/\s+/).filter((s) => s.length).length };
      });
      const minLen = parsed.length === 0 ? 0 : Math.min(...parsed.map((p) => p.len));
      const lenCap = minLen + params.nearOptDelta;
      const kept = parsed.filter((p) => p.len <= lenCap);
      for (const { moves: movesOnly, len: depth } of kept) {
        const fullMoves = (rotation ? rotation + ' ' : '') + movesOnly;
        const state = NxN.new_NxN_Data(3);
        NxN.ProcessMoves(state, scramble);
        NxN.ProcessMoves(state, fullMoves);
        if (!NxN.isCrossSolved(state) || NxN.getAmountOfSolvedPairs(state) < params.pairs) continue;
        const inspectionPrefix = rotation ? rotation + ' // Inspection\n' : '';
        const slotPart = slotStr ? ' [' + slotStr + ']' : '';
        const alg = inspectionPrefix + movesOnly + ' // ' + color + ' ' + label + slotPart;
        const pairs = NxN.getAmountOfSolvedPairs(state);
        const score = pairs * 10 - depth + 1;
        out.push([alg, state, score]);
        totalNumCross++;
        postMessage({ totalnumcross: totalNumCross });
      }
    }
  }
  return out;
}

/** Run pseudoCrossSolver.wasm once. Same emit protocol as crossSolver. */
function runPseudoWasmOnce(scramble: string, rotation: string, slot: string, pslot: string, solNum: number, maxLen: number, centerOffset: string): string[] {
  const collected: string[] = [];
  const orig = self.postMessage.bind(self);
  self.postMessage = (msg: unknown) => {
    if (typeof msg !== 'string') { orig(msg); return; }
    if (XCROSS_TERMINALS.has(msg)) return;
    if (msg.startsWith('depth')) return;
    collected.push(msg);
  };
  try {
    // signature: scr, rot, slot, pslot, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mcString
    pseudoModule.solve!(scramble, rotation, slot, pslot, solNum, maxLen,
      'U_U2_U-_D_D2_D-_L_L2_L-_R_R2_R-_F_F2_F-_B_B2_B-',
      '', centerOffset, 0, '', '');
  } finally {
    self.postMessage = orig;
  }
  return collected;
}

/**
 * Pseudo Cross/XCross/XXCross/XXXCross via pseudoCrossSolver.wasm.
 * Stage selection: slot+pslot count selects cross_search/xcross_search/etc. We use matched
 * slot==pslot so after D-fix both edge (fixed-pos) and corner (pseudo-pos) land in the same
 * canonical F2L slot, indistinguishable from standard XCross/XXCross/XXXCross. Decoupled
 * slot≠pslot would need offset-aware F2L — out of scope. Δ=0 dropped to avoid duplicates.
 */
function runPseudoCrossAllColors(scramble: string, crosscolors: Record<CrossColor, boolean>, stage: Stage): CrossResult[] {
  const params = XCROSS_STAGE_PARAMS[stage];
  const combos = XCROSS_SLOT_COMBOS[params.pairs];
  const label = 'p' + STAGE_XS[stage] + 'Cross';
  const solNum = params.solNum * 4;
  const out: CrossResult[] = [];
  for (const color of Object.keys(XCROSS_ROTATIONS) as CrossColor[]) {
    if (crosscolors[color] === false) continue;
    const rotation = XCROSS_ROTATIONS[color];
    for (const slots of combos) {
      const slotStr = slots.join(' ');
      const wasmOuts = runPseudoWasmOnce(scramble, rotation, slotStr, slotStr, solNum, params.maxLen, PSEUDO_CENTER_OFFSET_ALL);
      const parsed = wasmOuts.map((w) => {
        const m = rotation && w.startsWith(rotation + ' ') ? w.substring(rotation.length + 1) : w;
        return { moves: m, len: m.split(/\s+/).filter((s) => s.length).length };
      });
      const minLen = parsed.length === 0 ? 0 : Math.min(...parsed.map((p) => p.len));
      const lenCap = minLen + params.nearOptDelta;
      const kept = parsed.filter((p) => p.len <= lenCap);
      for (const { moves: movesOnly, len: depth } of kept) {
        const fullMoves = (rotation ? rotation + ' ' : '') + movesOnly;
        const state = NxN.new_NxN_Data(3);
        NxN.ProcessMoves(state, scramble);
        NxN.ProcessMoves(state, fullMoves);
        let chosenFix: string | null = null;
        let chosenState: NxNState | null = null;
        for (const fix of PSEUDO_OFFSET_FIXES) {
          const p = NxN.new_NxN_Data(state);
          if (fix) NxN.ProcessMoves(p, fix);
          if (NxN.isCrossSolved(p) && NxN.getAmountOfSolvedPairs(p) >= params.pairs) {
            chosenFix = fix;
            chosenState = p;
            break;
          }
        }
        if (chosenState === null) continue;
        if (chosenFix === '') continue;
        const inspectionPrefix = rotation ? rotation + ' // Inspection\n' : '';
        const fixSuffix = ' ' + chosenFix;
        const slotPart = slotStr ? ' [' + slotStr + ']' : '';
        const alg = inspectionPrefix + movesOnly + fixSuffix + ' // ' + color + ' ' + label + ' [+' + chosenFix + ']' + slotPart;
        const pairsNow = NxN.getAmountOfSolvedPairs(chosenState);
        const score = pairsNow * 10 - depth + 1;
        out.push([alg, chosenState, score]);
        totalNumCross++;
        postMessage({ totalnumcross: totalNumCross });
      }
    }
  }
  return out;
}

// ── EO Cross via EOCrossSolver.wasm ────────────────────────────────────
// Output state: cross (or xcross/xxcross/...) solved + remaining edges color-oriented (EO).
// State is canonical (no D-offset), so F2LPlanner takes over directly.
function runEOWasmOnce(scramble: string, rotation: string, slot: string, solNum: number, maxLen: number, centerOffset: string): string[] {
  const collected: string[] = [];
  const orig = self.postMessage.bind(self);
  self.postMessage = (msg: unknown) => {
    if (typeof msg !== 'string') { orig(msg); return; }
    if (XCROSS_TERMINALS.has(msg)) return;
    if (msg.startsWith('depth')) return;
    collected.push(msg);
  };
  try {
    // signature: scr, rot, slot, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mcString
    eoCrossModule.solve!(scramble, rotation, slot, solNum, maxLen,
      'U_U2_U-_D_D2_D-_L_L2_L-_R_R2_R-_F_F2_F-_B_B2_B-',
      '', centerOffset || CENTER_OFFSET_REGULAR, 0, '', '');
  } finally {
    self.postMessage = orig;
  }
  return collected;
}

function runEOCrossAllColors(scramble: string, crosscolors: Record<CrossColor, boolean>, stage: Stage): CrossResult[] {
  const params = EOCROSS_STAGE_PARAMS[stage];
  const combos = XCROSS_SLOT_COMBOS[params.pairs];
  const label = 'EO+' + STAGE_XS[stage] + 'Cross';
  const out: CrossResult[] = [];
  for (const color of Object.keys(XCROSS_ROTATIONS) as CrossColor[]) {
    if (crosscolors[color] === false) continue;
    const rotation = XCROSS_ROTATIONS[color];
    for (const slots of combos) {
      const slotStr = slots.join(' ');
      const wasmOuts = runEOWasmOnce(scramble, rotation, slotStr, params.solNum, params.maxLen, CENTER_OFFSET_REGULAR);
      const parsed = wasmOuts.map((w) => {
        const m = rotation && w.startsWith(rotation + ' ') ? w.substring(rotation.length + 1) : w;
        return { moves: m, len: m.split(/\s+/).filter((s) => s.length).length };
      });
      const minLen = parsed.length === 0 ? 0 : Math.min(...parsed.map((p) => p.len));
      const lenCap = minLen + params.nearOptDelta;
      const kept = parsed.filter((p) => p.len <= lenCap);
      for (const { moves: movesOnly, len: depth } of kept) {
        const fullMoves = (rotation ? rotation + ' ' : '') + movesOnly;
        const state = NxN.new_NxN_Data(3);
        NxN.ProcessMoves(state, scramble);
        NxN.ProcessMoves(state, fullMoves);
        if (!NxN.isCrossSolved(state) || NxN.getAmountOfSolvedPairs(state) < params.pairs) continue;
        const inspectionPrefix = rotation ? rotation + ' // Inspection\n' : '';
        const slotPart = slotStr ? ' [' + slotStr + ']' : '';
        const alg = inspectionPrefix + movesOnly + ' // ' + color + ' ' + label + slotPart;
        const pairs = NxN.getAmountOfSolvedPairs(state);
        const score = pairs * 10 - depth + 1;
        out.push([alg, state, score]);
        totalNumCross++;
        postMessage({ totalnumcross: totalNumCross });
      }
    }
  }
  return out;
}

// ── Cross + Pair via F2L_PairingSolver.wasm ────────────────────────────
// Output state: cross (or xcross/...) solved + one F2L slot in "pair-ready" configuration.
// F2L planner picks up the pair-ready as the next pair to insert.
function runPairWasmOnce(scramble: string, rotation: string, slot: string, pslot: string, solNum: number, maxLen: number, centerOffset: string): string[] {
  const collected: string[] = [];
  const orig = self.postMessage.bind(self);
  self.postMessage = (msg: unknown) => {
    if (typeof msg !== 'string') { orig(msg); return; }
    if (XCROSS_TERMINALS.has(msg)) return;
    if (msg.startsWith('depth')) return;
    collected.push(msg);
  };
  try {
    // signature: scr, rot, slot, pslot, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mcString
    pairingModule.solve!(scramble, rotation, slot, pslot, solNum, maxLen,
      'U_U2_U-_D_D2_D-_L_L2_L-_R_R2_R-_F_F2_F-_B_B2_B-',
      '', centerOffset || CENTER_OFFSET_REGULAR, 0, '', '');
  } finally {
    self.postMessage = orig;
  }
  return collected;
}

function pairSlotPslotCombos(pairs: 0 | 1 | 2 | 3): Array<{ slot: string; pslot: string }> {
  const out: Array<{ slot: string; pslot: string }> = [];
  const baseCombos = XCROSS_SLOT_COMBOS[pairs];
  for (const slots of baseCombos) {
    const remaining = F2L_SLOTS.filter((s) => !slots.includes(s));
    for (const ps of remaining) out.push({ slot: slots.join(' '), pslot: ps });
  }
  return out;
}

function runCrossPairAllColors(scramble: string, crosscolors: Record<CrossColor, boolean>, stage: Stage): CrossResult[] {
  const params = PAIR_STAGE_PARAMS[stage];
  const combos = pairSlotPslotCombos(params.pairs);
  const label = STAGE_XS[stage] + 'Cross+Pair';
  const out: CrossResult[] = [];
  for (const color of Object.keys(XCROSS_ROTATIONS) as CrossColor[]) {
    if (crosscolors[color] === false) continue;
    const rotation = XCROSS_ROTATIONS[color];
    for (const { slot, pslot } of combos) {
      const wasmOuts = runPairWasmOnce(scramble, rotation, slot, pslot, params.solNum, params.maxLen, CENTER_OFFSET_REGULAR);
      const parsed = wasmOuts.map((w) => {
        const m = rotation && w.startsWith(rotation + ' ') ? w.substring(rotation.length + 1) : w;
        return { moves: m, len: m.split(/\s+/).filter((s) => s.length).length };
      });
      const minLen = parsed.length === 0 ? 0 : Math.min(...parsed.map((p) => p.len));
      const lenCap = minLen + params.nearOptDelta;
      const kept = parsed.filter((p) => p.len <= lenCap);
      for (const { moves: movesOnly, len: depth } of kept) {
        const fullMoves = (rotation ? rotation + ' ' : '') + movesOnly;
        const state = NxN.new_NxN_Data(3);
        NxN.ProcessMoves(state, scramble);
        NxN.ProcessMoves(state, fullMoves);
        if (!NxN.isCrossSolved(state) || NxN.getAmountOfSolvedPairs(state) < params.pairs) continue;
        const inspectionPrefix = rotation ? rotation + ' // Inspection\n' : '';
        const slotPart = slot ? ' [' + slot + ']' : '';
        const alg = inspectionPrefix + movesOnly + ' // ' + color + ' ' + label + ' (' + pslot + ' ready)' + slotPart;
        const pairsNow = NxN.getAmountOfSolvedPairs(state);
        const score = pairsNow * 10 - depth + 1;
        out.push([alg, state, score]);
        totalNumCross++;
        postMessage({ totalnumcross: totalNumCross });
      }
    }
  }
  return out;
}

// ── Pseudo + Pair via pseudoPairingSolver.wasm ─────────────────────────
// Like Pair, with D-offset cross allowed. Restrict a_slot==a_pslot (matched physical slot).
function runPseudoPairWasmOnce(scramble: string, rotation: string, slot: string, pslot: string, aSlot: string, aPslot: string, solNum: number, maxLen: number, centerOffset: string): string[] {
  const collected: string[] = [];
  const orig = self.postMessage.bind(self);
  self.postMessage = (msg: unknown) => {
    if (typeof msg !== 'string') { orig(msg); return; }
    if (XCROSS_TERMINALS.has(msg)) return;
    if (msg.startsWith('depth')) return;
    collected.push(msg);
  };
  try {
    // signature: scr, rot, slot, pslot, a_slot, a_pslot, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mcString
    pseudoPairingModule.solve!(scramble, rotation, slot, pslot, aSlot, aPslot, solNum, maxLen,
      'U_U2_U-_D_D2_D-_L_L2_L-_R_R2_R-_F_F2_F-_B_B2_B-',
      '', centerOffset, 0, '', '');
  } finally {
    self.postMessage = orig;
  }
  return collected;
}

function runPseudoPairAllColors(scramble: string, crosscolors: Record<CrossColor, boolean>, stage: Stage): CrossResult[] {
  const params = PSEUDO_PAIR_STAGE_PARAMS[stage];
  const baseCombos = XCROSS_SLOT_COMBOS[params.pairs];
  const out: CrossResult[] = [];
  const label = 'p' + STAGE_XS[stage] + 'Cross+pPair';
  const solNumExpanded = params.solNum * 4;
  for (const color of Object.keys(XCROSS_ROTATIONS) as CrossColor[]) {
    if (crosscolors[color] === false) continue;
    const rotation = XCROSS_ROTATIONS[color];
    for (const slots of baseCombos) {
      const slotStr = slots.join(' ');
      const remaining = F2L_SLOTS.filter((s) => !slots.includes(s));
      for (const ar of remaining) {
        const wasmOuts = runPseudoPairWasmOnce(scramble, rotation, slotStr, slotStr, ar, ar,
          solNumExpanded, params.maxLen, PSEUDO_CENTER_OFFSET_ALL);
        const parsed = wasmOuts.map((w) => {
          const m = rotation && w.startsWith(rotation + ' ') ? w.substring(rotation.length + 1) : w;
          return { moves: m, len: m.split(/\s+/).filter((s) => s.length).length };
        });
        const minLen = parsed.length === 0 ? 0 : Math.min(...parsed.map((p) => p.len));
        const lenCap = minLen + params.nearOptDelta;
        const kept = parsed.filter((p) => p.len <= lenCap);
        for (const { moves: movesOnly, len: depth } of kept) {
          const fullMoves = (rotation ? rotation + ' ' : '') + movesOnly;
          const state = NxN.new_NxN_Data(3);
          NxN.ProcessMoves(state, scramble);
          NxN.ProcessMoves(state, fullMoves);
          let chosenFix: string | null = null;
          let chosenState: NxNState | null = null;
          for (const fix of PSEUDO_OFFSET_FIXES) {
            const p = NxN.new_NxN_Data(state);
            if (fix) NxN.ProcessMoves(p, fix);
            if (NxN.isCrossSolved(p) && NxN.getAmountOfSolvedPairs(p) >= params.pairs) {
              chosenFix = fix;
              chosenState = p;
              break;
            }
          }
          if (chosenState === null) continue;
          if (chosenFix === '') continue;
          const inspectionPrefix = rotation ? rotation + ' // Inspection\n' : '';
          const fixSuffix = ' ' + chosenFix;
          const slotPart = slotStr ? ' [' + slotStr + ']' : '';
          const alg = inspectionPrefix + movesOnly + fixSuffix + ' // ' + color + ' ' + label + ' (' + ar + ' ready, +' + chosenFix + ')' + slotPart;
          const pairsNow = NxN.getAmountOfSolvedPairs(chosenState);
          const score = pairsNow * 10 - depth + 1;
          out.push([alg, chosenState, score]);
          totalNumCross++;
          postMessage({ totalnumcross: totalNumCross });
        }
      }
    }
  }
  return out;
}

function runCrossAllColors(scramble: string, crosscolors: Record<CrossColor, boolean>): CrossResult[] {
  const planner = new NxNCrossPlanner(scramble);
  let crosses: CrossResult[] = [];
  let attempts = 0;
  while (crosses.length === 0 && attempts < 3) {
    attempts++;
    let anyAdded = false;
    for (const color of Object.keys(planner.sides) as CrossColor[]) {
      if (crosscolors[color] === false) continue;
      const r = planner.processOptions(color, 10000, 100);
      if (r.length > 0) { crosses = crosses.concat(r); anyAdded = true; }
    }
    if (!anyAdded) break;
  }
  return crosses;
}

self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  try {
    finalSolutions = [];
    totalNumCross = 0;
    workingScramble = e.data.scramble;
    const howfar = e.data.howfar;
    // Accept both new {variant, stage} and legacy {stage1, pseudo} for back-compat with old tests.
    const stage: Stage = e.data.stage ?? e.data.stage1 ?? 'cross';
    const variant: Variant = e.data.variant ?? (e.data.pseudo === true ? 'pseudo' : 'std');

    const initial = NxN.new_NxN_Data(3);
    NxN.ProcessMoves(initial, workingScramble);

    let crosses: CrossResult[] = [];
    let xcrossFallback = false;
    let variantUnsupported = false;
    // See analyzer.js twin for the full dispatch matrix and "how to add a new variant" comment.
    const useXCrossWasm = variant === 'std' && (stage === 'xcross' || stage === 'xxcross' || stage === 'xxxcross');
    const usePseudoCrossWasm = variant === 'pseudo';
    const useEOCrossWasm = variant === 'eo';
    const usePairWasm = variant === 'pair';
    const usePseudoPairWasm = variant === 'pseudo_pair';
    if (NxN.isCrossSolved(initial)) {
      crosses = [['', initial, 0]];
    } else if (usePseudoCrossWasm) {
      await pseudoReady;
      crosses = runPseudoCrossAllColors(workingScramble, e.data.crosscolors, stage);
      if (crosses.length === 0) {
        xcrossFallback = true;
        crosses = runCrossAllColors(workingScramble, e.data.crosscolors);
      }
    } else if (useEOCrossWasm) {
      await eoCrossReady;
      crosses = runEOCrossAllColors(workingScramble, e.data.crosscolors, stage);
      if (crosses.length === 0) {
        xcrossFallback = true;
        crosses = runCrossAllColors(workingScramble, e.data.crosscolors);
      }
    } else if (usePairWasm) {
      await pairingReady;
      crosses = runCrossPairAllColors(workingScramble, e.data.crosscolors, stage);
      if (crosses.length === 0) {
        xcrossFallback = true;
        crosses = runCrossAllColors(workingScramble, e.data.crosscolors);
      }
    } else if (usePseudoPairWasm) {
      await pseudoPairingReady;
      crosses = runPseudoPairAllColors(workingScramble, e.data.crosscolors, stage);
      if (crosses.length === 0) {
        xcrossFallback = true;
        crosses = runCrossAllColors(workingScramble, e.data.crosscolors);
      }
    } else if (variant !== 'std') {
      variantUnsupported = true;
    } else if (useXCrossWasm) {
      await xcrossReady;
      crosses = runXCrossAllColors(workingScramble, e.data.crosscolors, stage);
      if (crosses.length === 0) {
        xcrossFallback = true;
        crosses = runCrossAllColors(workingScramble, e.data.crosscolors);
      }
    } else {
      crosses = runCrossAllColors(workingScramble, e.data.crosscolors);
    }

    if (crosses.length > 0) {
      crosses.sort((a, b) => b[2] - a[2]);
      crosses = crosses.slice(0, 20);
      const f2lPlanner = new F2LPlanner(crosses);
      const f2lOut = f2lPlanner.processOptions(howfar);

      if (howfar > 3) {
        const llPlanner = new LLPlanner(f2lOut);
        finalSolutions = finalSolutions.concat(llPlanner.processOptions());
      } else {
        finalSolutions = finalSolutions.concat(f2lOut);
      }
    }

    postMessage({ finalSolutions, xcrossFallback, variantUnsupported });
  } catch (err) {
    postMessage({ finalSolutions: [], error: String((err && (err as Error).message) || err) });
  }
};
