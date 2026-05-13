// @ts-nocheck — this is the runtime worker JS, types live in analyzer.worker.ts twin.
/**
 * 3x3 CFOP scramble analyzer Worker — TS-source-equivalent runtime artifact.
 *
 * Type-stripped from src/pages/analyze/worker/analyzer.worker.ts. Lives in
 * public/ rather than going through Vite's worker bundling because:
 *   - importScripts() is a classic-worker-only API
 *   - Vite's bundled "classic" workers still inherit module-strict-mode semantics
 *     in some cases, breaking the legacy data files (boohoo.js et al.) which
 *     assign implicit globals (no var/let/const)
 *   - Plain JS in public/ is served verbatim by Vite + GH Pages and runs as
 *     a pure classic worker, guaranteed sloppy mode at top level
 *
 * Keep this file in sync manually with analyzer.worker.ts (drop type annotations
 * only — control flow MUST stay identical to preserve byte-identical totals).
 *
 * Reference test scramble: B2 L F' U R' D R' F2 D L R2 D R B' D' L2 D2 R' U'
 *   → upstream legacy worker (?worker=legacy): 53 / 7457 / 42664 / 21380.
 *   → this TS port: smaller (cross search uses canonical opposite-pair ordering
 *     to deduplicate; legacy double-counts due to dead opposite-face check).
 */

// NOTE: order matters — boohoo.js's top-level `NxN['OLLHashTable'] = OLLHashTable`
// references `let` bindings created by hs.js (and ZBLL bindings from zbh.js).
// `let` at script top creates a global lexical binding visible to subsequent
// importScripts'd classic scripts but NOT a property on globalThis, so order
// must be: dependencies first, boohoo.js last. Same order as legacy ear.js.
importScripts(
  '/analyze-worker/hs.js',
  '/analyze-worker/zbh.js',
  '/analyze-worker/boohoo.js',
);

// ── Wasm loaders (two solvers coexist in the same worker) ─────────────
// crossSolver.wasm  (xcross/)  — regular cross + N pairs (non-pseudo).
// pseudoCrossSolver (pseudo/)  — pseudo cross with D-class center offset.
//
// Both are emscripten-compiled with default settings, meaning each loader pollutes
// dozens of globals (Module, HEAPU8, wasmExports, _malloc, etc.). Loading them
// naively in the same worker → the second clobbers the first.
//
// Strategy:
//   - xcross loads first (legacy, can't easily wrap) — owns the global namespace.
//     Standard `self.Module = config; importScripts('xcross/solver.js')` pattern.
//   - pseudo loads second from `pseudo-wrapped.js`, a build-time IIFE wrap of
//     pseudo.js that pre-binds `var Module = self.PseudoModuleStash` and keeps
//     ALL emscripten-internal `var`s inside the IIFE scope. Zero global leakage.
const _isNode = typeof globalThis.process?.versions?.node === 'string';

// Load xcross
self.Module = _isNode ? {} : { locateFile: (p) => '/analyze-worker/xcross/' + p };
const xcrossReady = new Promise((resolve) => {
  self.Module.onRuntimeInitialized = () => resolve();
});
const xcrossModule = self.Module;
importScripts('/analyze-worker/xcross/solver.js');

// Load pseudo (wrapped)
self.PseudoModuleStash = _isNode ? {} : { locateFile: (p) => '/analyze-worker/pseudo/' + p };
const pseudoReady = new Promise((resolve) => {
  self.PseudoModuleStash.onRuntimeInitialized = () => resolve();
});
const pseudoModule = self.PseudoModuleStash;
importScripts('/analyze-worker/pseudo/pseudo-wrapped.js');

// rotation strings match NxN_Data inspection AUF: scramble + rotation → state on cross color.
const XCROSS_ROTATIONS = {
  Yellow: '', White: 'z2', Blue: 'x', Green: "x'", Red: 'z', Orange: "z'",
};
// F2L solver semantics — slot count = exact pair count to solve.
// 0 slots = cross-only (used only by pseudo cross), 1 = xcross, 2 = xxcross, 3 = xxxcross.
// Slot strings space-separated, e.g. "BL BR" requests xxcross solving BL + BR pairs.
const XCROSS_SLOT_COMBOS = {
  0: [[]],
  1: [['BL'], ['BR'], ['FR'], ['FL']],
  2: [['BL', 'BR'], ['BL', 'FR'], ['BL', 'FL'], ['BR', 'FR'], ['BR', 'FL'], ['FR', 'FL']],
  3: [['BR', 'FR', 'FL'], ['BL', 'FR', 'FL'], ['BL', 'BR', 'FL'], ['BL', 'BR', 'FR']],
};
// sol_num + post-filter to optimal + optimal+1 length per (color × slot combo).
// max_len bound depends on stage1 — xcross usually ≤11, xxcross ≤14, xxxcross ≤18.
// solNum scales down for higher-X because the +1 branching factor is much larger
// and we want to stay within reasonable per-call timings on mobile.
// 'cross' (0 pairs) entry is only used in pseudo mode — non-pseudo cross goes
// through the JS heuristic planner instead.
const XCROSS_STAGE_PARAMS = {
  cross:    { pairs: 0, solNum: 20, maxLen: 10, nearOptDelta: 1 },
  xcross:   { pairs: 1, solNum: 20, maxLen: 12, nearOptDelta: 1 },
  xxcross:  { pairs: 2, solNum: 10, maxLen: 14, nearOptDelta: 1 },
  xxxcross: { pairs: 3, solNum: 5,  maxLen: 18, nearOptDelta: 1 },
};
// center_offset wasm arg for crossSolver.wasm: regular (Δ=0) only. crossSolver doesn't
// implement real pseudo — its center_offset is a no-op for UDFBLR-only searches.
// True pseudo goes through pseudoCrossSolver below.
const CENTER_OFFSET_REGULAR = 'EMPTY_EMPTY';
// pseudoCrossSolver center_offset: allow cross to land at {Solved, D, D', D2} relative
// to centers. Encoding per pseudo.cpp `buildCenterOffset` / `crest_mapping`:
//   EMPTY_EMPTY → 0 (Solved)
//   EMPTY_y     → 1
//   EMPTY_y2    → 2
//   EMPTY_y'    → 3
const PSEUDO_CENTER_OFFSET_ALL = "EMPTY_EMPTY|EMPTY_y|EMPTY_y2|EMPTY_y'";
// wasm emit protocol: depth progress / terminal markers / move sequences (the actual solutions).
const XCROSS_TERMINALS = new Set(['Search finished.', 'Already solved.', 'Unsolvable.', 'Error']);

/**
 * Run crossSolver.wasm in F2L mode for one (rotation, slot-combo).
 * Sync — Module.solve blocks until wasm exits and emit (via EM_JS postMessage) is done.
 * Returns array of raw move-sequence strings (e.g. `"z2 R U R' U' F R U' R' U' R U R' F'"`).
 * Monkey-patches self.postMessage during the call to capture emit, then restores.
 */
function runXCrossWasmOnce(scramble, rotation, slot, solNum, maxLen, centerOffset) {
  const collected = [];
  const orig = self.postMessage.bind(self);
  self.postMessage = (msg) => {
    if (typeof msg !== 'string') { orig(msg); return; }
    if (XCROSS_TERMINALS.has(msg)) return;
    if (msg.startsWith('depth')) return;
    collected.push(msg);
  };
  try {
    // signature: solver, scr, rot, slot, ll, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mcString
    xcrossModule.solve('F2L', scramble, rotation, slot, '', solNum, maxLen,
      'U_U2_U-_D_D2_D-_L_L2_L-_R_R2_R-_F_F2_F-_B_B2_B-',
      '', centerOffset || CENTER_OFFSET_REGULAR, 0, '', '');
  } finally {
    self.postMessage = orig;
  }
  return collected;
}


/**
 * For each selected cross color × each slot combination (chosen by stage1),
 * call wasm, verify (petals=4 && pairs>=requiredPairs), and return CrossResult
 * [alg, state, score] tuples for the F2LPlanner.
 *   xcross   — 1-slot combos (4), keep solutions of length ≤ min+1 per combo (次优一步).
 *   xxcross  — 2-slot combos (6), only the optimal per combo.
 *   xxxcross — 3-slot combos (4), only the optimal per combo.
 */
function runXCrossAllColors(scramble, crosscolors, stage1) {
  const params = XCROSS_STAGE_PARAMS[stage1];
  if (!params) return [];
  const combos = XCROSS_SLOT_COMBOS[params.pairs];
  const xs = 'X'.repeat(params.pairs);
  const label = xs + 'Cross';
  const out = [];
  for (const color of Object.keys(XCROSS_ROTATIONS)) {
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

// ── Pseudo cross via pseudoCrossSolver.wasm ────────────────────────────
// D-class fix-up moves to align a D-offset cross back to canonical. Apply on
// state copy then re-check isCrossSolved to determine which offset the cross
// has. '' = already aligned (Δ=0, redundant with non-pseudo cross results).
const PSEUDO_OFFSET_FIXES = ['', 'D', 'D2', "D'"];

/**
 * Run pseudoCrossSolver.wasm for one (rotation, slot, pslot, center_offset) call.
 * Same emit protocol as crossSolver — terminals + `depth=N` progress + move sequences.
 * Sync; monkey-patches self.postMessage to capture solver output.
 */
function runPseudoWasmOnce(scramble, rotation, slot, pslot, solNum, maxLen, centerOffset) {
  const collected = [];
  const orig = self.postMessage.bind(self);
  self.postMessage = (msg) => {
    if (typeof msg !== 'string') { orig(msg); return; }
    if (XCROSS_TERMINALS.has(msg)) return;
    if (msg.startsWith('depth')) return;
    collected.push(msg);
  };
  try {
    // signature: scr, rot, slot, pslot, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mcString
    pseudoModule.solve(scramble, rotation, slot, pslot, solNum, maxLen,
      'U_U2_U-_D_D2_D-_L_L2_L-_R_R2_R-_F_F2_F-_B_B2_B-',
      '', centerOffset, 0, '', '');
  } finally {
    self.postMessage = orig;
  }
  return collected;
}

/**
 * pCross: search for cross algorithms that leave the bottom 4 edges in cross
 * configuration but possibly D-offset from centers (state ∈ {Solved, D, D', D2}).
 *
 * Per pseudoCrossSolver center_offset semantics, the wasm finds algorithms whose
 * resulting state matches one of the 4 D-class targets. For each result we detect
 * which D-class fix (∅ / D / D2 / D') would re-align it, append that fix to the alg
 * (so the displayed solution is a valid full sequence), and hand off to F2LPlanner
 * with a now-canonical cross-solved state.
 *
 * NOTE: this means each pCross result is mathematically a (regular cross + 1) HTM
 * alg with a "split" notation. Real value-add over regular cross is showing
 * cubers WHICH cross algorithms have an exploitable D-offset prefix. F2L-in-offset
 * frame would require modifying F2LPlanner to be center-aware — deferred.
 */
function runPseudoCrossAllColors(scramble, crosscolors) {
  const params = XCROSS_STAGE_PARAMS.cross;
  const solNum = params.solNum * 4; // 4 offset goals, ask for more so each Δ has variety
  const out = [];
  for (const color of Object.keys(XCROSS_ROTATIONS)) {
    if (crosscolors[color] === false) continue;
    const rotation = XCROSS_ROTATIONS[color];
    const wasmOuts = runPseudoWasmOnce(scramble, rotation, '', '', solNum, params.maxLen, PSEUDO_CENTER_OFFSET_ALL);
    const parsed = wasmOuts.map((w) => {
      const m = rotation && w.startsWith(rotation + ' ') ? w.substring(rotation.length + 1) : w;
      return { moves: m, len: m.split(/\s+/).filter((s) => s.length).length };
    });
    const minLen = parsed.length === 0 ? 0 : Math.min(...parsed.map((p) => p.len));
    const lenCap = minLen + params.nearOptDelta;
    const kept = parsed.filter((p) => p.len <= lenCap);
    for (const { moves: movesOnly, len: depth } of kept) {
      const fullMoves = (rotation ? rotation + ' ' : '') + movesOnly;
      // Build state after scramble + inspection + wasm-solve, then detect D-offset.
      let state = NxN.new_NxN_Data(3);
      NxN.ProcessMoves(state, scramble);
      NxN.ProcessMoves(state, fullMoves);
      let chosenFix = null;
      let chosenState = null;
      for (const fix of PSEUDO_OFFSET_FIXES) {
        const p = NxN.new_NxN_Data(state);
        if (fix) NxN.ProcessMoves(p, fix);
        if (NxN.isCrossSolved(p)) { chosenFix = fix; chosenState = p; break; }
      }
      if (chosenState === null) continue; // wasm output didn't yield a recognisable cross
      // Skip Δ=0 — these are just regular crosses, would duplicate non-pseudo path.
      // (Non-pseudo cross runs via JS heuristic planner, but we exclude here too so
      // pseudo mode shows only the actual "pseudo" finds.)
      if (chosenFix === '') continue;
      const inspectionPrefix = rotation ? rotation + ' // Inspection\n' : '';
      const fixSuffix = chosenFix ? ' ' + chosenFix : '';
      const alg = inspectionPrefix + movesOnly + fixSuffix + ' // ' + color + ' pCross [+' + chosenFix + ']';
      const score = -depth + 1;
      out.push([alg, chosenState, score]);
      totalNumCross++;
      postMessage({ totalnumcross: totalNumCross });
    }
  }
  return out;
}

/**
 * Existing JS heuristic cross planner, factored out + with an attempt cap to prevent
 * the prior `while (crosses.length === 0)` infinite loop when queue depletes empty.
 */
function runCrossAllColors(scramble, crosscolors) {
  const planner = new NxNCrossPlanner(scramble);
  let crosses = [];
  let attempts = 0;
  while (crosses.length === 0 && attempts < 3) {
    attempts++;
    let anyAdded = false;
    for (const color of Object.keys(planner.sides)) {
      if (crosscolors[color] === false) continue;
      const r = planner.processOptions(color, 10000, 100);
      if (r.length > 0) { crosses = crosses.concat(r); anyAdded = true; }
    }
    if (!anyAdded) break;
  }
  return crosses;
}

// ── Queues ─────────────────────────────────────────────────────────────

/**
 * O(1) replacement for BinaryHeap when scoreFn is constant. With all scores
 * equal, BinaryHeap's bubbleUp/sinkDown never swap, so push degenerates to
 * array.push and pop degenerates to "return [0], copy last to [0], drop last".
 * Provably equivalent pop order; ~10x faster for 7000+ pops.
 */
class ConstScoreQueue {
  constructor() { this.content = []; }
  push(item) { this.content.push(item); }
  pop() {
    const top = this.content[0];
    const last = this.content.pop();
    if (this.content.length > 0) this.content[0] = last;
    return top;
  }
  size() { return this.content.length; }
}

class BinaryHeap {
  constructor(scoreFn) { this.content = []; this.scoreFn = scoreFn; }
  push(item) { this.content.push(item); this.bubbleUp(this.content.length - 1); }
  pop() {
    const top = this.content[0];
    const last = this.content.pop();
    if (this.content.length > 0) { this.content[0] = last; this.sinkDown(0); }
    return top;
  }
  size() { return this.content.length; }
  bubbleUp(n) {
    const item = this.content[n];
    const score = this.scoreFn(item);
    while (n > 0) {
      const pn = Math.floor((n + 1) / 2) - 1;
      const p = this.content[pn];
      if (score >= this.scoreFn(p)) break;
      this.content[pn] = item; this.content[n] = p; n = pn;
    }
  }
  sinkDown(n) {
    const len = this.content.length;
    const item = this.content[n];
    const score = this.scoreFn(item);
    while (true) {
      const r = (n + 1) * 2;
      const l = r - 1;
      let swap = null;
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
      this.content[n] = this.content[swap]; this.content[swap] = item; n = swap;
    }
  }
}

// ── Cross planner ──────────────────────────────────────────────────────

const CROSS_INSPECTION = {
  Yellow: '', White: 'z2', Blue: 'x', Green: "x'", Red: 'z', Orange: "z'",
};

const FACES = ['R', 'U', 'L', 'D', 'F', 'B'];
const SUFFIXES = ['', "'", '2'];
// Canonical order within each opposite pair: R before L, U before D, F before B.
// "After canonical-second, prune canonical-first" → never enumerate `L R` after
// `R L` was already enumerated for the same final state.
const CANONICAL_REVERSE_OPPOSITE = { L: 'R', D: 'U', B: 'F' };

let totalNumCross = 0;

class NxNCrossPlanner {
  constructor(scramble) {
    this.sides = CROSS_INSPECTION;
    this.maxDepth = { Yellow: 7, White: 7, Blue: 7, Green: 7, Red: 7, Orange: 7 };
    this.queues = {};
    for (const color of Object.keys(this.sides)) {
      // Build the post-scramble + post-inspection state, then push 4 AUF rotations as roots.
      // Replicates upstream's bug-for-bug ordering: y-root state == identity (because
      // startPuzzle gets mutated AFTER the y-root clone), y2-root state == post-y'
      // (because subsequent clones happen post-mutation), y'-root state == identity.
      const start = NxN.new_NxN_Data(3);
      NxN.ProcessMoves(start, scramble);
      NxN.ProcessMoves(start, this.sides[color]);

      const root = NxN.new_NxN_Data(start);
      this.push(color, [1000, 0, (this.sides[color] + ' // Inspection\n').trimStart(), root, ' ']);

      const rY = NxN.new_NxN_Data(start);
      NxN.ProcessMoves(start, 'y'); // mutates `start` after rY was cloned
      this.push(color, [1000, 0, (this.sides[color] + ' y // Inspection\n').trimStart(), rY, ' ']);

      const rY2 = NxN.new_NxN_Data(start);
      NxN.ProcessMoves(rY2, 'y2');
      this.push(color, [1000, 0, (this.sides[color] + ' y2 // Inspection\n').trimStart(), rY2, ' ']);

      const rYp = NxN.new_NxN_Data(start);
      NxN.ProcessMoves(rYp, "y'");
      this.push(color, [1000, 0, (this.sides[color] + " y' // Inspection\n").trimStart(), rYp, ' ']);
    }
  }

  push(color, item) {
    if (!Object.prototype.hasOwnProperty.call(this.queues, color)) {
      this.queues[color] = new BinaryHeap((x) => x[0]);
    }
    this.queues[color].push(item);
  }

  processOptions(color, maxIter, maxFound) {
    const out = [];
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
            this.maxDepth[color] = Math.min(this.maxDepth[color], cur[1] + 2);
            this.maxDepth[color] = Math.max(5, this.maxDepth[color]);
            const score = pairsAfter * 10 - cur[1] + 1;
            out.push([alg, p, score]);
            totalNumCross++;
            postMessage({ totalnumcross: totalNumCross });
            continue;
          }
          let centers = 0;
          if (m.D[1][1] === m.D[0][1]) centers++;
          if (m.D[1][1] === m.D[1][0]) centers++;
          if (m.D[1][1] === m.D[2][1]) centers++;
          if (m.D[1][1] === m.D[1][2]) centers++;
          const h = petals * 5 + centers * 3 + (cur[1] + 1) * -10;
          this.push(color, [-h, cur[1] + 1, cur[2] + move + ' ', p, face]);
        }
      }
    }
    return out;
  }
}

// ── F2L planner ────────────────────────────────────────────────────────

class F2LPlanner {
  constructor(seeds) {
    this.queue = new ConstScoreQueue();
    for (const c of seeds) this.queue.push(c);
  }
  processOptions(howfar) {
    const out = [];
    let counter = 0;
    while (this.queue.size() !== 0) {
      const cur = this.queue.pop();
      const solvedBefore = NxN.getAmountOfSolvedPairs(cur[1]);
      // If seed already meets howfar (e.g. xcross seed with 1 pair, howfar=1),
      // emit directly as final — don't search further pairs.
      if (solvedBefore >= howfar) {
        out.push([NxN_AlgHandler.calculateETM(cur[0]), cur[0], cur[1], []]);
        if (counter++ % 250 === 0) postMessage({ pairscovered: counter });
        continue;
      }
      const opts = NxN.getF2LOptions(cur[1]);
      for (const opt of opts) {
        const p = NxN.new_NxN_Data(cur[1]);
        NxN.ProcessMoves(p, opt[1]);
        const solvedAfter = NxN.getAmountOfSolvedPairs(p);
        let alg = cur[0] + '\n' + opt[1] + ' // Pair ' + (solvedBefore + 1);
        for (let j = solvedBefore + 2; j <= solvedAfter; j++) alg += ' & ' + j;
        if (solvedAfter >= howfar) {
          out.push([NxN_AlgHandler.calculateETM(alg), alg, p, []]);
        } else {
          this.queue.push([alg, p]);
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
const AUF_BEFORE = ['', "U' ", 'U2 ', 'U '];
const FACE_TO_AUF_AFTER_PLL = { F: '', B: '\nU2 // AUF', R: '\nU ', L: ' U' };
const FACE_TO_AUF_LL_SKIP = { F: '', B: '\nU2 // AUF', R: "\nU' // AUF", L: '\nU // AUF' };

class LLPlanner {
  constructor(seeds) {
    this.queue = new ConstScoreQueue();
    for (const s of seeds) this.queue.push(s);
  }
  processOptions() {
    const out = [];
    let counter = 0;
    while (this.queue.size() !== 0) {
      const cur = this.queue.pop();
      const ollHash = NxN.getOLLHash(cur[2]);
      if (Object.prototype.hasOwnProperty.call(NxN.OLLHashTable, ollHash)) {
        const entry = NxN.OLLHashTable[ollHash];
        for (let rawAlg of NxN_AlgHandler.OLLDictionary[entry.name]) {
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
          // OLL 20 / OLL 1 are 4-fold / 2-fold symmetric respectively.
          if (entry.name === 'OLL 20') alg = rawAlg;
          if (entry.name === 'OLL 1') {
            if (orientation === 1 || orientation === 3) alg = flipped;
            else if (orientation === 2) alg = rawAlg;
          }
          const p = NxN.new_NxN_Data(cur[2]);
          NxN.ProcessMoves(p, alg);
          const newAlg = cur[1] + '\n' + alg + ' // OLL';
          this.queue.push([NxN_AlgHandler.calculateETM(cur[1]), newAlg, p, ['OLL']]);
          break;
        }
      } else {
        const pllHash = NxN.getNewPLLHash(NxN.getNormalizedPuzzle(cur[2]));
        if (Object.prototype.hasOwnProperty.call(NxN.PLLnewHashTable, pllHash)) {
          const entry = NxN.PLLnewHashTable[pllHash];
          for (let rawAlg of NxN_AlgHandler.PLLDictionary[entry.name]) {
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
          const front = NxN.getNormalizedPuzzle(cur[2]).mat.F[0][1];
          let alg = cur[1];
          if (Object.prototype.hasOwnProperty.call(FACE_TO_AUF_LL_SKIP, front)) {
            alg = alg + FACE_TO_AUF_LL_SKIP[front];
          }
          out.push([NxN_AlgHandler.calculateETM(alg), alg, cur[2], cur[3] || []]);
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

let finalSolutions = [];
let workingScramble = '';

self.onmessage = async (e) => {
  try {
    finalSolutions = [];
    totalNumCross = 0;
    workingScramble = e.data.scramble;
    const howfar = e.data.howfar;
    // Accept both new {variant, stage} and legacy {stage1, pseudo} API for tests still using the old form.
    const stage = e.data.stage || e.data.stage1 || 'cross';
    const variant = e.data.variant || (e.data.pseudo === true ? 'pseudo' : 'std');

    const initial = NxN.new_NxN_Data(3);
    NxN.ProcessMoves(initial, workingScramble);

    let crosses = [];
    let xcrossFallback = false;
    let variantUnsupported = false;
    // Dispatch matrix (variant × stage):
    //   std        × cross      → JS heuristic NxNCrossPlanner (fastest, no wasm)
    //   std        × xcross/etc → crossSolver.wasm in F2L mode
    //   pseudo     × cross      → pseudoCrossSolver.wasm (pCross, Δ≠0 only)
    //   pseudo     × xcross/etc → NOT WIRED — needs slot×pslot enumeration + offset-aware F2L
    //   eo         × *          → NOT WIRED — needs EOCrossSolver wasm port
    //   pair       × *          → NOT WIRED — needs F2L_PairingSolver wasm port
    //   pseudo_pair× *          → NOT WIRED — needs pseudoPairingSolver wasm port
    // To add a new variant: copy its wasm to public/analyze-worker/<dir>/, IIFE-wrap if it
    // pollutes globals, add a loader, then a runXXXAllColors that returns CrossResult[]
    // and slot in here.
    const useXCrossWasm = variant === 'std' && (stage === 'xcross' || stage === 'xxcross' || stage === 'xxxcross');
    const usePseudoCrossWasm = variant === 'pseudo' && stage === 'cross';
    if (NxN.isCrossSolved(initial)) {
      crosses = [['', initial, 0]];
    } else if (usePseudoCrossWasm) {
      await pseudoReady;
      crosses = runPseudoCrossAllColors(workingScramble, e.data.crosscolors);
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
      const f2l = new F2LPlanner(crosses);
      const f2lOut = f2l.processOptions(howfar);
      if (howfar > 3) {
        const ll = new LLPlanner(f2lOut);
        finalSolutions = finalSolutions.concat(ll.processOptions());
      } else {
        finalSolutions = finalSolutions.concat(f2lOut);
      }
    }

    postMessage({ finalSolutions, xcrossFallback, variantUnsupported });
  } catch (err) {
    postMessage({ finalSolutions: [], error: String((err && err.message) || err) });
  }
};
