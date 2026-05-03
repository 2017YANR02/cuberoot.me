/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @module pages/analyze/worker/analyzer.worker
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

import type { NxNState, F2LOption } from './cube_globals';

declare const importScripts: (...urls: string[]) => void;

importScripts(
  '/analyze-worker/boohoo.js',
  '/analyze-worker/hs.js',
  '/analyze-worker/zbh.js',
);

// ── Types ─────────────────────────────────────────────────────────────

export type CrossColor = 'Yellow' | 'White' | 'Blue' | 'Green' | 'Red' | 'Orange';
export type Howfar = 1 | 2 | 3 | 4;

export interface AnalyzeRequest {
  scramble: string;
  crosscolors: Record<CrossColor, boolean>;
  howfar: Howfar;
}

export type Solution = [etm: number, alg: string, state: NxNState, stages: string[]];

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
const OPPOSITE_OF: Record<string, string> = { R: 'L', U: 'D', L: 'R', D: 'U', F: 'B', B: 'F' };
const SUFFIXES = ['', "'", '2'] as const;

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
        if (face === cur[4] || face === OPPOSITE_OF[cur[4]]) continue;
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
      const opts: F2LOption[] = NxN.getF2LOptions(cur[1]);
      const solvedBefore = NxN.getAmountOfSolvedPairs(cur[1]);
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

const AUF_BEFORE = ['', "U' ", 'U2 ', 'U '] as const;
const AUF_BEFORE_FLIPPED = ['', " U2", 'U2 ', 'U '] as const; // upstream uses this odd table for OLL 20 only
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
          const flipped = AUF_BEFORE_FLIPPED[(orientation + 2) % 4] + rawAlg;
          // OLL 1 / OLL 20 are 4-fold symmetric; force their canonical AUF.
          if (entry.name === 'OLL 1') alg = rawAlg;
          if (entry.name === 'OLL 20') {
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

self.onmessage = (e: MessageEvent<AnalyzeRequest>) => {
  finalSolutions = [];
  totalNumCross = 0;
  workingScramble = e.data.scramble;
  const howfar = e.data.howfar;

  let crossPlanner: NxNCrossPlanner | undefined = new NxNCrossPlanner(workingScramble);
  let crosses: CrossResult[] = [];

  const initial = NxN.new_NxN_Data(3);
  NxN.ProcessMoves(initial, workingScramble);
  if (NxN.isCrossSolved(initial)) {
    crosses = [['', initial, 0]];
  } else {
    while (crosses.length === 0) {
      for (const color of Object.keys(crossPlanner!.sides) as CrossColor[]) {
        if (e.data.crosscolors[color] === false) continue;
        const r = crossPlanner!.processOptions(color, 10000, 100);
        crosses = crosses.concat(r);
      }
    }
    crossPlanner = undefined;
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

  postMessage({ finalSolutions });
};
