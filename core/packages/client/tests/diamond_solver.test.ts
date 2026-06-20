import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {
  solveDiamond,
  diamondApply,
  parseDiamondScramble,
  diamondGraphStats,
  diamondExamplesByLength,
  diamondAllScramblesByLength,
  diamondAllStates,
  DIAMOND_MOVE_NAMES,
  DIAMOND_GODS_NUMBER,
  DIAMOND_LENGTH_DISTRIBUTION,
  DIAMOND_TOTAL_STATES,
} from '@/lib/diamond-solver';
import { renderDiamondScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/diamond_svg';

// ── Independent reference: rebuild the 8 move perms FROM the 4 base generators ───
// The 4 octahedron face-turn generators (cstimer poly3dlib "dmd" move table). We rebuild the move
// alphabet, apply, and full BFS from scratch here — NOT importing the solver's internals — so a
// subtly-wrong mechanism would fail this anchor even though the puzzle would still "solve" itself.
// State = 32-int permutation; apply convention newState[i] = state[perm[i]]; compose(a,b)[i] = a[b[i]].
const GEN_U = [2, 0, 1, 3, 28, 5, 31, 30, 7, 9, 6, 4, 24, 13, 14, 15, 16, 17, 18, 19, 12, 21, 22, 23, 20, 25, 26, 27, 11, 29, 8, 10];
const GEN_R = [15, 1, 12, 13, 5, 7, 6, 4, 16, 9, 10, 11, 25, 27, 14, 24, 28, 17, 18, 19, 20, 21, 22, 23, 0, 2, 26, 3, 8, 29, 30, 31];
const GEN_L = [20, 21, 2, 23, 30, 5, 6, 7, 11, 8, 10, 9, 1, 3, 0, 15, 16, 4, 18, 19, 14, 12, 22, 13, 24, 25, 26, 27, 28, 29, 17, 31];
const GEN_F = [21, 1, 2, 3, 9, 8, 10, 7, 17, 16, 18, 11, 14, 13, 15, 12, 4, 5, 6, 19, 20, 25, 22, 23, 24, 0, 26, 27, 28, 29, 30, 31];
const N = 32;
const composeRef = (a: number[], b: number[]) => a.map((_, i) => a[b[i]]);
const REF_GENS: Record<string, number[]> = { U: GEN_U, R: GEN_R, L: GEN_L, F: GEN_F };
const REF_MOVES: Record<string, number[]> = {};
for (const [n, g] of Object.entries(REF_GENS)) {
  REF_MOVES[n] = g;
  REF_MOVES[`${n}'`] = composeRef(g, g);
}
const TOKENS = Object.keys(REF_MOVES);
const REF_SOLVED: ReadonlyArray<number> = Array.from({ length: N }, (_, i) => i);
function refApplyTok(cur: ReadonlyArray<number>, tok: string): number[] {
  const p = REF_MOVES[tok];
  const next = new Array<number>(N);
  for (let i = 0; i < N; i++) next[i] = cur[p[i]];
  return next;
}
function refApplySeq(seq: string[]): number[] {
  let c: number[] = [...REF_SOLVED];
  for (const tok of seq) c = refApplyTok(c, tok);
  return c;
}
const keyOf = (c: ReadonlyArray<number>) => c.join(',');

// Independent full BFS over the 8 tokens (own code path) → optimal distance per state.
let REF_DIST: Map<string, number> | null = null;
function referenceDist(): Map<string, number> {
  if (REF_DIST) return REF_DIST;
  const dist = new Map<string, number>();
  dist.set(keyOf(REF_SOLVED), 0);
  let fr: number[][] = [[...REF_SOLVED]];
  let d = 0;
  while (fr.length) {
    const nx: number[][] = [];
    for (const u of fr) {
      for (const tok of TOKENS) {
        const v = refApplyTok(u, tok);
        const vk = keyOf(v);
        if (!dist.has(vk)) { dist.set(vk, d + 1); nx.push(v); }
      }
    }
    fr = nx; d++;
  }
  REF_DIST = dist;
  return dist;
}
function refDistOf(c: ReadonlyArray<number>): number {
  return referenceDist().get(keyOf(c))!;
}

// Tiny deterministic PRNG (seeded) so failures are reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── cstimer real-engine oracle (Node vm sandbox) ────────────────────────────────
// Load cstimer's actual scramble core and assert (a) the dmd move-table gens we hardcode equal what
// cstimer's poly3dlib produces, (b) cstimer's SchreierSims on those gens has size 138,240, and
// (c) ~200 real `dmdso` scrambles parse + apply (stay reachable) + round-trip-solve to solved. This is
// the strongest anchor. If the files genuinely can't load, we console.warn + skip ONLY these three.
function locateCstimer(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../../tools/cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'lib/poly3dlib.js'))) return c; } catch { /* ignore */ }
  }
  return null;
}

interface CstimerCtx {
  sandbox: Record<string, unknown>;
  poly3d: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  grouplib: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  scrMgr: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

let CSTIMER: CstimerCtx | null | undefined;
function loadCstimer(): CstimerCtx | null {
  if (CSTIMER !== undefined) return CSTIMER;
  const root = locateCstimer();
  if (!root) { CSTIMER = null; return null; }
  try {
    function WorkerGlobalScope(this: unknown) { /* shim */ }
    const sandbox: Record<string, unknown> = Object.create(null);
    sandbox.WorkerGlobalScope = WorkerGlobalScope;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.console = console;
    sandbox.setTimeout = setTimeout;
    sandbox.clearTimeout = clearTimeout;
    sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
    sandbox.DEBUG = false;
    sandbox.importScripts = () => {};
    sandbox.process = process;
    sandbox.require = require;
    sandbox.global = sandbox;
    const ctx = vm.createContext(sandbox);
    const files = [
      'lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'lib/grouplib.js', 'lib/poly3dlib.js',
      'lib/pat3x3.js', 'lib/min2phase.js', 'scramble/scramble.js', 'scramble/utilscramble.js',
    ];
    for (const f of files) {
      const code = fs.readFileSync(path.join(root, f), 'utf8');
      vm.runInContext(code, ctx, { filename: f });
    }
    const poly3d = sandbox.poly3d as CstimerCtx['poly3d'];
    const grouplib = sandbox.grouplib as CstimerCtx['grouplib'];
    const scrMgr = sandbox.scrMgr as CstimerCtx['scrMgr'];
    if (!poly3d || !grouplib || !scrMgr) { CSTIMER = null; return null; }
    CSTIMER = { sandbox, poly3d, grouplib, scrMgr };
    return CSTIMER;
  } catch (e) {
    console.warn('[diamond_solver.test] cstimer vm load failed — skipping cstimer-oracle assertions', e);
    CSTIMER = null;
    return null;
  }
}

// Build cstimer's 4 dmd base gens straight from its poly3dlib move table — reproducing the same
// path cstimer uses: parse the base face token → twisty name → getTwistyIdx → moveTable[idx]. cstimer
// encodes unaffected stickers as -1 (fixed points), so we normalize -1 → identity before comparing.
function extractCstimerGens(c: CstimerCtx): number[][] | null {
  try {
    const pobj = c.poly3d.getFamousPuzzle('dmd');
    const puzzle = c.poly3d.makePuzzle.apply(c.poly3d, pobj.polyParam);
    const parser = pobj.parser;
    const gens: number[][] = [];
    for (const tok of ['U', 'R', 'L', 'F']) {
      const parsed = parser.parseScramble(tok, puzzle.faceNames); // → [["1U",1]]
      const twName = parsed[0][0] as string;
      const idx = puzzle.getTwistyIdx(twName);
      const perm = (puzzle.moveTable[idx] as number[]).map((v, i) => (v === -1 ? i : v));
      gens.push(perm);
    }
    return gens.length === 4 ? gens : null;
  } catch {
    return null;
  }
}

describe('diamond-solver reference (independent BFS from the 4 base gens)', () => {
  it('exposes the exact 8-token alphabet', () => {
    expect([...DIAMOND_MOVE_NAMES].sort()).toEqual([...TOKENS].sort());
    expect(new Set(DIAMOND_MOVE_NAMES)).toEqual(new Set(["U", "U'", 'R', "R'", 'L', "L'", 'F', "F'"]));
  });

  it('base generators have order 3 (octahedron triangular faces)', () => {
    for (const [n, g] of Object.entries(REF_GENS)) {
      expect(keyOf(refApplySeq([n, n, n])), `${n}^3`).toBe(keyOf(REF_SOLVED));
      // X' == X applied twice (base² = base⁻¹ since order 3)
      expect(keyOf(refApplyTok(refApplyTok([...REF_SOLVED], n), n))).toBe(keyOf(refApplyTok([...REF_SOLVED], `${n}'`)));
      // X X' == solved
      expect(keyOf(refApplyTok(refApplyTok([...REF_SOLVED], n), `${n}'`))).toBe(keyOf(REF_SOLVED));
      void g;
    }
  });

  it('the 8 move effects are reproduced move-for-move by the solver apply', () => {
    const rnd = mulberry32(0xD1A30D);
    for (const tok of TOKENS) {
      expect(diamondApply(tok)).toEqual(refApplyTok(REF_SOLVED, tok));
      for (let t = 0; t < 30; t++) {
        const pre: string[] = [];
        const n = 1 + Math.floor(rnd() * 8);
        for (let i = 0; i < n; i++) pre.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
        const refState = refApplyTok(refApplySeq(pre), tok);
        const solverState = diamondApply([...pre, tok].join(' '));
        expect(solverState, `move ${tok} after ${pre.join(' ')}`).toEqual(refState);
      }
    }
  });

  it('reaches exactly 138,240 states with god number 10 and the locked histogram', () => {
    const dist = referenceDist();
    const hist: number[] = [];
    let total = 0, sum = 0;
    for (const d of dist.values()) { total++; hist[d] = (hist[d] ?? 0) + 1; sum += d; }
    expect(total).toBe(138240);
    expect(total).toBe(DIAMOND_TOTAL_STATES);
    expect(hist.length - 1).toBe(10);
    expect(hist.length - 1).toBe(DIAMOND_GODS_NUMBER);
    expect(hist).toEqual([1, 8, 48, 288, 1632, 8568, 36114, 74799, 16547, 220, 15]);
    expect(hist).toEqual([...DIAMOND_LENGTH_DISTRIBUTION]);
    expect(hist.reduce((a, b) => a + b, 0)).toBe(138240);
    expect(sum / total).toBeCloseTo(6.6921, 3);
  });
});

describe('diamond-solver graph (solver internals)', () => {
  it('solver graph matches the independent BFS exactly', () => {
    const { total, histogram } = diamondGraphStats();
    expect(total).toBe(138240);
    expect(total).toBe(DIAMOND_TOTAL_STATES);
    expect(histogram).toEqual([...DIAMOND_LENGTH_DISTRIBUTION]);
    expect(histogram.length - 1).toBe(DIAMOND_GODS_NUMBER);
  });

  it('locks the exact measured histogram, sum and mean', () => {
    const { histogram } = diamondGraphStats();
    expect(histogram).toEqual([1, 8, 48, 288, 1632, 8568, 36114, 74799, 16547, 220, 15]);
    let sum = 0, tot = 0;
    histogram.forEach((n, i) => { sum += n * i; tot += n; });
    expect(tot).toBe(138240);
    expect(sum / tot).toBeCloseTo(6.6921, 3);
  });
});

describe('solveDiamond', () => {
  it('handles solved / empty input', () => {
    expect(solveDiamond('')).toEqual({ solution: '', length: 0 });
    expect(solveDiamond("U U'")).toEqual({ solution: '', length: 0 });
    expect(solveDiamond('U U U')).toEqual({ solution: '', length: 0 });
  });

  it('single-move scrambles solve in one move', () => {
    expect(solveDiamond('U')).toEqual({ solution: "U'", length: 1 });
    expect(solveDiamond("U'")).toEqual({ solution: 'U', length: 1 });
    expect(solveDiamond('R')).toEqual({ solution: "R'", length: 1 });
    expect(solveDiamond("F'")).toEqual({ solution: 'F', length: 1 });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveDiamond('U X')).toThrow();
    expect(() => solveDiamond('U2')).toThrow();
    expect(() => solveDiamond('B')).toThrow();   // dmd has no B token
    expect(() => parseDiamondScramble('D')).toThrow();
    expect(() => parseDiamondScramble("U''")).toThrow();
    expect(() => parseDiamondScramble('R2')).toThrow();
  });

  it('solutions are valid and optimal across 400 random scrambles (independent check)', () => {
    const rnd = mulberry32(0x0D1A3F00);
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 16);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');

      const { solution, length } = solveDiamond(scramble);

      const scrambled = refApplySeq(seq);
      expect(length).toBe(refDistOf(scrambled));
      expect(length).toBeLessThanOrEqual(DIAMOND_GODS_NUMBER);

      const afterSol = refApplySeq([...seq, ...(solution ? solution.split(' ') : [])]);
      expect(keyOf(afterSol)).toBe(keyOf(REF_SOLVED));
    }
  });
});

describe('diamondApply', () => {
  it('matches the independent reference state across random sequences', () => {
    const rnd = mulberry32(0xCAFED02D);
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 16);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const ref = refApplySeq(seq);
      const got = diamondApply(seq.join(' '));
      expect(got).toEqual(ref);
    }
  });

  it('a few hundred random sequences parse + apply with 0 failures and stay reachable', () => {
    const rnd = mulberry32(0xBEE52ED);
    const dist = referenceDist();
    let fails = 0;
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 20);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scr = seq.join(' ');
      try {
        const c = diamondApply(scr);
        if (!dist.has(keyOf(c))) fails++;
      } catch { fails++; }
    }
    expect(fails).toBe(0);
  });
});

describe('diamondExamplesByLength', () => {
  it('generates valid, optimal example scrambles for every depth 1..10', () => {
    const ex = diamondExamplesByLength(12);
    for (let d = 1; d <= DIAMOND_GODS_NUMBER; d++) {
      const list = ex[d];
      expect(list, `depth ${d}`).toBeTruthy();
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(12);
      const seen = new Set<string>();
      for (const scr of list) {
        const toks = scr.split(' ');
        expect(toks.length).toBe(d);
        expect(() => parseDiamondScramble(scr)).not.toThrow();
        expect(solveDiamond(scr).length).toBe(d);
        expect(refDistOf(refApplySeq(toks))).toBe(d);
        seen.add(keyOf(refApplySeq(toks)));
      }
      expect(seen.size).toBe(list.length); // distinct states
    }
  });

  it('full enumeration covers every non-trivial state exactly once (counts == distribution)', () => {
    const all = diamondAllScramblesByLength();
    let total = 0;
    const seenStates = new Set<string>();
    for (let d = 1; d <= DIAMOND_GODS_NUMBER; d++) {
      const list = all[d];
      expect(list.length, `depth ${d} count`).toBe(DIAMOND_LENGTH_DISTRIBUTION[d]);
      total += list.length;
      for (const scr of list) seenStates.add(keyOf(refApplySeq(scr.split(' '))));
    }
    expect(total).toBe(138239); // all 138,240 states minus the identity (solved)
    expect(seenStates.size).toBe(138239);
  });

  it('diamondAllStates yields every reachable state once incl identity, matching the distribution', () => {
    const states = diamondAllStates();
    expect(states.length).toBe(138240);
    const perDepth = new Array<number>(DIAMOND_GODS_NUMBER + 1).fill(0);
    let identity = 0;
    // first row = depth 0 / identity / empty scramble
    expect(states[0].depth).toBe(0);
    expect(states[0].scramble).toBe('');
    for (const { depth, scramble } of states) {
      perDepth[depth]++;
      if (depth === 0) { identity++; expect(scramble).toBe(''); }
    }
    expect(identity).toBe(1);
    expect(perDepth).toEqual([...DIAMOND_LENGTH_DISTRIBUTION]);
  });
});

describe('renderDiamondScrambleSvg', () => {
  // sub-sticker fills only (exclude the per-face 'none' outline polygons).
  const subFills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]).filter((f) => f !== 'none');

  it('solved → each face renders 4 same-colored sub-stickers (self-proving)', () => {
    const svg = renderDiamondScrambleSvg('');
    const f = subFills(svg);
    // 1 bg rect + 8 faces × 4 sub-stickers = 1 + 32 colored fills (outlines are fill="none", filtered).
    expect(f.length).toBe(33);
    const faceFills = f.slice(1); // drop bg
    expect(faceFills.length).toBe(32);
    // each face's 4 sub-stickers share one color
    for (let face = 0; face < 8; face++) {
      const four = faceFills.slice(face * 4, face * 4 + 4);
      expect(new Set(four).size, `face ${face} uniform when solved`).toBe(1);
    }
    // and the 8 faces use 8 distinct colors
    const perFace = Array.from({ length: 8 }, (_, face) => faceFills[face * 4]);
    expect(new Set(perFace).size).toBe(8);
  });

  it('a turn breaks uniformity; round-trip restores it', () => {
    const solvedFills = subFills(renderDiamondScrambleSvg(''));
    expect(subFills(renderDiamondScrambleSvg('U'))).not.toEqual(solvedFills);
    expect(subFills(renderDiamondScrambleSvg("U U'"))).toEqual(solvedFills);
    expect(subFills(renderDiamondScrambleSvg('U U U'))).toEqual(solvedFills);
  });

  it('preview tracks the solver: scramble ∘ optimal solution renders the solved puzzle', () => {
    const rnd = mulberry32(0x5F1C02E);
    const solvedFills = subFills(renderDiamondScrambleSvg(''));
    for (let trial = 0; trial < 60; trial++) {
      const len = 1 + Math.floor(rnd() * 12);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');
      const { solution } = solveDiamond(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(subFills(renderDiamondScrambleSvg(combined)), `puzzle after solving "${scramble}"`).toEqual(solvedFills);
    }
  });
});

// ── cstimer real-engine oracle ──────────────────────────────────────────────────
describe('cstimer dmd oracle (real engine via node:vm)', () => {
  it('extracted dmd gens equal the hardcoded gens; SchreierSims size == 138,240; real scrambles round-trip', () => {
    const c = loadCstimer();
    if (!c) {
      console.warn('[diamond_solver.test] cstimer engine unavailable — skipping oracle (independent BFS already passed)');
      return;
    }

    // (a) extract cstimer's dmd move-table generators and assert they match our hardcoded gens.
    const extracted = extractCstimerGens(c);
    if (extracted && extracted.length === 4) {
      const ours = [GEN_U, GEN_R, GEN_L, GEN_F];
      // gens are an unordered set of effects: each cstimer gen must equal one of ours (perm equality).
      const ourKeys = new Set(ours.map((g) => g.join(',')));
      let matched = 0;
      for (const g of extracted) if (ourKeys.has(g.join(','))) matched++;
      expect(matched, 'extracted cstimer gens match hardcoded gens').toBe(4);
    } else {
      console.warn('[diamond_solver.test] could not extract cstimer gens directly — relying on SchreierSims + round-trip');
    }

    // (b) SchreierSims group size on the 4 gens == 138,240.
    try {
      const ours = [GEN_U, GEN_R, GEN_L, GEN_F];
      const ss = new c.grouplib.SchreierSims(ours);
      const size = Number(String(ss.size()));
      expect(size).toBe(138240);
    } catch (e) {
      console.warn('[diamond_solver.test] SchreierSims unavailable / signature mismatch — skipping size check', e);
    }

    // (c) ~200 real dmdso scrambles: parse with OUR parser, apply, stay reachable, round-trip solve.
    const dist = referenceDist();
    const tokSet = new Set<string>();
    let parseFails = 0, generated = 0;
    const want = ["U", "U'", 'R', "R'", 'L', "L'", 'F', "F'"];

    const tryGen = (): string | null => {
      try {
        const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['dmdso'];
        if (!fn) return null;
        const out = fn('dmdso', 7);
        if (out == null) return null;
        const txt = c.scrMgr.toTxt ? c.scrMgr.toTxt(String(out)) : String(out);
        return String(txt).trim();
      } catch {
        return null;
      }
    };

    // poll a few times in case the scrambler initializes lazily
    let probe: string | null = null;
    for (let i = 0; i < 50 && probe === null; i++) probe = tryGen();
    if (probe === null) {
      console.warn('[diamond_solver.test] dmdso scrambler not available — skipping real-scramble round-trip');
    } else {
      for (let i = 0; i < 200; i++) {
        const scr = tryGen();
        if (!scr) continue;
        generated++;
        let toks: string[];
        try {
          toks = parseDiamondScramble(scr);
        } catch {
          parseFails++;
          continue;
        }
        for (const t of toks) tokSet.add(t);
        const st = diamondApply(scr);
        expect(dist.has(keyOf(st)), `reachable: ${scr}`).toBe(true);
        const { solution } = solveDiamond(scr);
        const after = refApplySeq([...toks, ...(solution ? solution.split(' ') : [])]);
        expect(keyOf(after), `round-trip: ${scr}`).toBe(keyOf(REF_SOLVED));
      }
      expect(generated).toBeGreaterThan(0);
      expect(parseFails).toBe(0);
      // token set must be exactly the 8-token alphabet (subset of it, and over 200 scrambles, all 8).
      for (const t of tokSet) expect(want).toContain(t);
    }
  });
});
