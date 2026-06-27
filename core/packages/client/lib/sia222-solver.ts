/*
 * Siamese 2×2×2 (sia222 / 联体 2×2×2) OPTIMAL solver — pure TS. TIER B (offline precomputed pattern databases).
 *
 * THE PUZZLE — sia222 is two 3×3×3 cubes glued so they share a 2×2×2 corner block, moving as ONE bonded body.
 * cstimer's scramble (scramble/megascramble.js, key `sia222`) is
 *     #{[["U"],["R"],["F"]],%c,%l} z2 y #{[["U"],["R"],["F"]],%c,%l}
 * i.e. a block of `%l` face turns of cube A drawn from {U,R,F}×{"","2","'"}, the literal reorientation `z2 y`,
 * then a block of `%l` face turns of cube B (written in the same U/R/F notation but applied in the reoriented
 * frame). With the registered length 12 that is 12 + `z2 y` + 12 tokens.
 *
 * PROVEN STRUCTURE (measured to saturation; see solver/NONWCA_PUZZLE_LOOP.md §3 "D2-13 sia222" + the geometry
 * re-derivation in core/.tmp/sia222/): the bonded group is a DIRECT PRODUCT  G = G_A × G_B  — every cube-A token
 * acts on a cubie set disjoint from every cube-B token, and all A-tokens commute with all B-tokens (0/162
 * violations). The shared 2×2×2 block locks three faces of each cube, so EACH HALF is a restricted ⟨U,R,F⟩
 * 3×3×3: 7 mobile corners (orbit 3,674,160 = 7!·3⁶, diameter 18 in QTM) + 9 mobile edges (orbit 92,897,280 =
 * 9!·2⁸). Because the halves are independent AND commute, solving the bonded puzzle reduces to:
 *     split the scramble at "z2 y" → cube-A tokens / cube-B tokens
 *     solve each half independently to OPTIMAL with the restricted-cube engine
 *     concatenate (A-solution then B-solution)
 * and the concatenation is GLOBALLY OPTIMAL: its length is optimal_A + optimal_B and no shorter bonded solution
 * exists (a bonded solution projects to independent A/B solutions, each ≥ its half-optimum). The faithfulness of
 * the split is verified end-to-end in the tests (recombined per-half solutions return the bonded solved state).
 *
 * ENGINE — this file is a thin specialization of lib/restricted-cube-solver.ts (a MOVE-SET-PARAMETERIZED
 * restricted-3×3×3 IDA* solver) instantiated with the ⟨U,R,F⟩ half geometry (lib/sia222-consts.ts). The same
 * engine will power sia123 / sia113 with their own move masks. Heuristic = max(corner PDB, two complementary
 * 6-edge PDBs) — the standard Korf pattern-database approach (R.E. Korf, AAAI 1997). On real cstimer sia222
 * scrambles this solves each half in ≤~50ms with provably shortest solutions.
 *
 * TIER B / TABLE — the three PDBs are too slow to build in a browser tab (~40–100s) and total ~18.8MB dense, so
 * they are built OFFLINE (packages/scramble-stats-build/src/build_sia222_table.ts) and shipped as a single gzip
 * (~3.0MB, > the 2MB repo limit → PUBLISHED to static.cuberoot.me, fetched via statsUrl — see §3 MANUAL queue,
 * like opt_bic but published not committed). The browser fetches + inflates once (DecompressionStream) into
 * resident Uint8Array distance tables (~18.8MB) and solves by IDA*. Provably optimal (the PDBs hold exact
 * projection distances → an admissible heuristic). Desktop-first (per §0.0 #11 mobile is no longer a hard gate);
 * the UI shows a "建议桌面端" hint.
 *
 * PRIOR ART / ATTRIBUTION — the scramble + bonded geometry are borrowed from cstimer (cs0x7f/cstimer,
 * megascramble.js); the restricted-⟨U,R,F⟩ IDA*+PDB algorithm is the textbook Korf/Kociemba approach. The
 * direct-product reduction was proven by an in-repo measurement agent. See about/credits_data.json (cstimer
 * entry, updated for the siamese family) and the restricted-cube-solver.ts header.
 */

import { statsUrl } from './stats-base';
import {
  buildMoveModel, makeEdgePdbDef, edgeRank, cornerRank, solvedVec, applyTokenVec, isSolvedVec,
  idaSolve, type RestrictedMoveModel, type RestrictedPdbs, type EdgePdbDef,
} from './restricted-cube-solver';
import { SIA222_CONSTS } from './sia222-consts';
import { SIA222_B_CONSTS } from './sia222-b-consts';

// ── two half-cube models: cube A (⟨U,R,F⟩) + cube B (= cube A conjugated by g="z2 y"). ────────────
// Cube B's tokens act as g·(U/R/F)·g on the bonded geometry; solving cube B in cube A's frame is PERMUTATION-
// correct but leaves some edges FLIPPED (the conjugation changes the edge-flip convention), so we keep a
// separate cube-B model with its own move tables + orientation labels. The two models share ONE PDB table:
// the corner / 6-edge projection DISTANCES are invariant under the group isomorphism, so the cube-B PDBs are
// BYTE-IDENTICAL to cube-A's (measured) — we build/ship/load only one set and rank-index it with each model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODEL_A: RestrictedMoveModel = buildMoveModel(SIA222_CONSTS as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODEL_B: RestrictedMoveModel = buildMoveModel(SIA222_B_CONSTS as any);
/** Two complementary 6-edge groups (overlap on edges 3,4,5) — max(corner, edgeA, edgeB) heuristic. */
const EDGE_GROUPS: ReadonlyArray<ReadonlyArray<number>> = [
  [MODEL_A.NC + 0, MODEL_A.NC + 1, MODEL_A.NC + 2, MODEL_A.NC + 3, MODEL_A.NC + 4, MODEL_A.NC + 5],
  [MODEL_A.NC + 3, MODEL_A.NC + 4, MODEL_A.NC + 5, MODEL_A.NC + 6, MODEL_A.NC + 7, MODEL_A.NC + 8],
];
const EDGE_DEFS: EdgePdbDef[] = EDGE_GROUPS.map((g) => makeEdgePdbDef(MODEL_A, g));
const EDGE_DEFS_B: EdgePdbDef[] = EDGE_GROUPS.map((g) => makeEdgePdbDef(MODEL_B, g));
/** The shared PDB byte tables are addressed by whichever model's rank we pass — they only need the def sizes. */
function pdbsForModel(pdbs: Sia222Pdbs, defs: EdgePdbDef[]): Sia222Pdbs {
  return { corner: pdbs.corner, edges: defs.map((def, i) => ({ def, dist: pdbs.edges[i].dist })) };
}
/** Back-compat single-model alias (cube A) for the builder/test helpers below. */
const MODEL = MODEL_A;

/** Reachable corner-orbit size of one half (BFS-saturated). */
export const SIA222_CORNER_ORBIT = 3674160;
/** Reachable edge-orbit size of one half (BFS-saturated). */
export const SIA222_EDGE_ORBIT = 92897280;
/** Reachable size of one full half (⟨U,R,F⟩ Rubik subgroup order), as a string (< 2^53 but kept explicit). */
export const SIA222_HALF_GROUP_ORDER = '170,659,735,142,400';
/** Bonded group order |G_A|² (≫ 2^53 → string, per §0.0 #4). */
export const SIA222_BONDED_GROUP_ORDER = '29,124,745,198,874,117,548,277,760,000';
/** Safe hard cap on a single solution length (each half ≤ its diameter; well above any real scramble). */
export const SIA222_MAX_LENGTH = 60;

// ── PDB table (resident dense byte arrays) ──────────────────────────────────────────────────────
export interface Sia222Pdbs extends RestrictedPdbs {}

/** OFFLINE: BFS-build all PDBs (used by the build script + the test). Slow (~40–100s) — never call in-browser. */
export function sia222BuildPdbs(): Sia222Pdbs {
  // local lean BFS (avoids the engine's per-state Int32Array allocations for the big corner orbit).
  const corner = buildCornerPdbLean();
  const edges = EDGE_DEFS.map((def) => ({ def, dist: buildEdgePdbLean(def) }));
  return { corner, edges };
}

function buildCornerPdbLean(): Uint8Array {
  const NC = MODEL.NC;
  const size = factorial(NC) * pow3(NC);
  const dist = new Uint8Array(size).fill(255);
  const start = solvedVec(MODEL);
  // track only the NC corner codes (corners stay among corner slots under face turns).
  const startC = start.subarray(0, NC).slice();
  dist[cornerRank(MODEL, start)] = 0;
  let frontier: Int32Array[] = [startC];
  let d = 0;
  while (frontier.length) {
    const next: Int32Array[] = [];
    for (const w of frontier) {
      for (let t = 0; t < MODEL.tokens.length; t++) {
        const o = applyCornerOnly(t, w);
        const r = cornerRankOfCornerVec(o);
        if (dist[r] === 255) { dist[r] = d + 1; next.push(o); }
      }
    }
    frontier = next; d++;
  }
  return dist;
}
function applyCornerOnly(t: number, w: Int32Array): Int32Array {
  const act = MODEL.acts[t]; const NC = MODEL.NC;
  const out = new Int32Array(NC);
  for (let j = 0; j < NC; j++) {
    const c = w[j]; const o = c % 24; const piece = (c / 24) | 0;
    const m = act[j * 24 + o]; const to = (m / 24) | 0;
    if (to < NC) out[to] = piece * 24 + (m % 24);
  }
  return out;
}
function cornerRankOfCornerVec(w: Int32Array): number {
  const NC = MODEL.NC;
  let r = 0; const seen = new Array<boolean>(NC).fill(false); const cp = new Array<number>(NC);
  for (let j = 0; j < NC; j++) cp[j] = (w[j] / 24) | 0;
  for (let i = 0; i < NC; i++) { let s = 0; for (let k = 0; k < cp[i]; k++) if (!seen[k]) s++; r = r * (NC - i) + s; seen[cp[i]] = true; }
  let tw = 0; for (let j = 0; j < NC; j++) tw = tw * 3 + MODEL.cornerTwP[cp[j]][j][w[j] % 24];
  return r * pow3(NC) + tw;
}
function buildEdgePdbLean(def: EdgePdbDef): Uint8Array {
  const dist = new Uint8Array(def.size).fill(255);
  const start = solvedVec(MODEL);
  dist[edgeRank(MODEL, def, start)] = 0;
  let frontier: Int32Array[] = [start];
  let d = 0;
  while (frontier.length) {
    const next: Int32Array[] = [];
    for (const v of frontier) {
      for (let t = 0; t < MODEL.tokens.length; t++) {
        const o = applyTokenVec(MODEL, t, v);
        const r = edgeRank(MODEL, def, o);
        if (dist[r] === 255) { dist[r] = d + 1; next.push(o); }
      }
    }
    frontier = next; d++;
  }
  return dist;
}
function factorial(n: number): number { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
function pow3(n: number): number { let p = 1; for (let i = 0; i < n; i++) p *= 3; return p; }

// ── serialize / load (TIER B) ───────────────────────────────────────────────────────────────────
export const SIA222_TABLE_PATH = '/stats/scramble/opt_sia222.bin.gz';
const SIA222_TABLE_MAGIC = 'SI22';

/**
 * On-disk layout (gzip applied by the build script):
 *   [0..4)   magic "SI22"
 *   [4..8)   uint32 LE cornerSize
 *   [8..12)  uint32 LE edgeCount (= number of edge PDBs)
 *   then per edge PDB: uint32 LE size
 *   then the corner dist bytes, then each edge dist bytes (all parallel to their dense ranks).
 * Deterministic — no Date.now / Math.random.
 */
export function serializeSia222Pdbs(p: Sia222Pdbs): Uint8Array {
  const edgeCount = p.edges.length;
  const header = 12 + 4 * edgeCount;
  let total = header + p.corner.length;
  for (const e of p.edges) total += e.dist.length;
  const out = new Uint8Array(total);
  for (let i = 0; i < 4; i++) out[i] = SIA222_TABLE_MAGIC.charCodeAt(i);
  const dv = new DataView(out.buffer);
  dv.setUint32(4, p.corner.length, true);
  dv.setUint32(8, edgeCount, true);
  for (let i = 0; i < edgeCount; i++) dv.setUint32(12 + 4 * i, p.edges[i].dist.length, true);
  let off = header;
  out.set(p.corner, off); off += p.corner.length;
  for (const e of p.edges) { out.set(e.dist, off); off += e.dist.length; }
  return out;
}

export function deserializeSia222Pdbs(bytes: Uint8Array): Sia222Pdbs {
  for (let i = 0; i < 4; i++) if (bytes[i] !== SIA222_TABLE_MAGIC.charCodeAt(i)) throw new Error('sia222 table: bad magic');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cornerSize = dv.getUint32(4, true);
  const edgeCount = dv.getUint32(8, true);
  if (edgeCount !== EDGE_DEFS.length) throw new Error(`sia222 table: edgeCount ${edgeCount} != ${EDGE_DEFS.length}`);
  const edgeSizes: number[] = [];
  for (let i = 0; i < edgeCount; i++) edgeSizes.push(dv.getUint32(12 + 4 * i, true));
  let off = 12 + 4 * edgeCount;
  const corner = bytes.subarray(off, off + cornerSize); off += cornerSize;
  const edges = EDGE_DEFS.map((def, i) => {
    if (edgeSizes[i] !== def.size) throw new Error(`sia222 table: edge ${i} size ${edgeSizes[i]} != ${def.size}`);
    const dist = bytes.subarray(off, off + edgeSizes[i]); off += edgeSizes[i];
    return { def, dist: new Uint8Array(dist) };
  });
  return { corner: new Uint8Array(corner), edges };
}

let PDBS: Sia222Pdbs | null = null;
let PDBS_PROMISE: Promise<Sia222Pdbs> | null = null;
const GZIP0 = 0x1f, GZIP1 = 0x8b;
const MAGIC0 = SIA222_TABLE_MAGIC.charCodeAt(0);

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DS = (globalThis as any).DecompressionStream;
  if (typeof DS !== 'function') throw new Error('DecompressionStream unavailable (gzip table cannot be inflated)');
  const stream = new Response(new Blob([bytes as BlobPart])).body!.pipeThrough(new DS('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lazily fetch + inflate + decode the PDBs (cached). Throws a clear error on failure (no in-browser BFS fallback). */
export async function loadSia222Pdbs(): Promise<Sia222Pdbs> {
  if (PDBS) return PDBS;
  if (PDBS_PROMISE) return PDBS_PROMISE;
  PDBS_PROMISE = (async () => {
    const url = statsUrl(SIA222_TABLE_PATH);
    let res: Response;
    try { res = await fetch(url); }
    catch (e) { throw new Error(`无法加载联体 2×2×2 距离表 / failed to fetch the Siamese 2×2×2 table: ${String((e as Error)?.message ?? e)}`); }
    if (!res.ok) throw new Error(`无法加载联体 2×2×2 距离表 (HTTP ${res.status}) / failed to fetch the Siamese 2×2×2 table (HTTP ${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let raw: Uint8Array;
    if (bytes[0] === GZIP0 && bytes[1] === GZIP1) raw = await gunzip(bytes);
    else if (bytes[0] === MAGIC0) raw = bytes;
    else raw = await gunzip(bytes);
    const p = deserializeSia222Pdbs(raw);
    PDBS = p;
    return p;
  })();
  try { return await PDBS_PROMISE; }
  catch (e) { PDBS_PROMISE = null; throw e; }
}

/** Test/diagnostic only: inject already-built PDBs (skips fetch). */
export function _setSia222PdbsForTest(p: Sia222Pdbs | null): void { PDBS = p; PDBS_PROMISE = null; }

// ── scramble parsing + A/B split ────────────────────────────────────────────────────────────────
const HALF_TOKEN_RE = /^[URF](2|')?$/;

export interface Sia222Split { aTokens: string[]; bTokens: string[]; }

/**
 * Parse a cstimer sia222 scramble into its cube-A and cube-B token blocks. The two blocks are separated by the
 * literal reorientation `z2 y`. Throws Error('bad: <tok>') on any token outside U/R/F·{"","2","'"} or a missing
 * `z2 y` separator.
 */
export function parseSia222Scramble(scramble: string): Sia222Split {
  const s = scramble.trim();
  const idx = s.indexOf('z2 y');
  if (idx < 0) throw new Error("bad: missing 'z2 y' separator");
  const aPart = s.slice(0, idx).trim();
  const bPart = s.slice(idx + 'z2 y'.length).trim();
  const parse = (part: string): string[] => {
    const out: string[] = [];
    for (const tok of part.split(/\s+/)) {
      if (!tok) continue;
      if (!HALF_TOKEN_RE.test(tok)) throw new Error(`bad: ${tok}`);
      out.push(tok);
    }
    return out;
  };
  return { aTokens: parse(aPart), bTokens: parse(bPart) };
}

/** Apply a list of half tokens to a fresh half state in the given model, returning the state vector. */
function applyHalf(model: RestrictedMoveModel, tokens: ReadonlyArray<string>): Int32Array {
  const idx = new Map<string, number>(model.tokens.map((t, i) => [t, i]));
  let v = solvedVec(model);
  for (const tok of tokens) v = applyTokenVec(model, idx.get(tok)!, v);
  return v;
}

// ── public solve API ────────────────────────────────────────────────────────────────────────────
export interface Sia222Solution {
  /** Full bonded optimal solution: A-solution, then `z2 y`, then B-solution (the same notation cstimer uses). */
  solution: string;
  /** Total optimal move count (= optimal_A + optimal_B). */
  length: number;
  /** Per-half optimal lengths [A, B]. */
  halfLengths: [number, number];
}

/** Solve a parsed scramble's two halves with already-built PDBs (synchronous core). Provably optimal per half. */
export function solveSia222WithPdbs(pdbs: Sia222Pdbs, scramble: string): Sia222Solution {
  const { aTokens, bTokens } = parseSia222Scramble(scramble);
  // cube A in MODEL_A, cube B in MODEL_B; both index the SAME shared PDB bytes (their projection distances are
  // identical under the group isomorphism — verified byte-equal), each with its own edge defs / orientation.
  const va = applyHalf(MODEL_A, aTokens);
  const vb = applyHalf(MODEL_B, bTokens);
  const ra = idaSolve(MODEL_A, pdbsForModel(pdbs, EDGE_DEFS), va, { maxDepth: SIA222_MAX_LENGTH });
  const rb = idaSolve(MODEL_B, pdbsForModel(pdbs, EDGE_DEFS_B), vb, { maxDepth: SIA222_MAX_LENGTH });
  if (!ra || !rb) throw new Error('sia222: no solution within bound (unexpected — report this scramble)');
  const aSol = ra.path.map((t) => MODEL_A.tokens[t]);
  const bSol = rb.path.map((t) => MODEL_B.tokens[t]);
  // The full bonded solution is A-solution then (after the same z2 y reorientation) the B-solution, written in
  // the cube-B frame exactly as cstimer writes the B-block. We present it the same way: "<A> z2 y <B>".
  const parts: string[] = [];
  if (aSol.length) parts.push(aSol.join(' '));
  parts.push('z2 y');
  if (bSol.length) parts.push(bSol.join(' '));
  return {
    solution: parts.join(' '),
    length: ra.length + rb.length,
    halfLengths: [ra.length, rb.length],
  };
}

/** Solve a sia222 scramble optimally (async: lazily fetch+inflate the PDB table on first call). */
export async function solveSia222(scramble: string): Promise<Sia222Solution> {
  parseSia222Scramble(scramble); // eager validation (reject bad tokens without fetching)
  const pdbs = await loadSia222Pdbs();
  return solveSia222WithPdbs(pdbs, scramble);
}

// ── helpers for the offline sampled-distribution build + tests ────────────────────────────────────
/** The cube-A engine model + edge defs (for tests that re-derive ranks / build PDBs). */
export function sia222Model(): RestrictedMoveModel { return MODEL_A; }
/** The cube-B engine model (conjugated frame). */
export function sia222ModelB(): RestrictedMoveModel { return MODEL_B; }
export function sia222EdgeDefs(): ReadonlyArray<EdgePdbDef> { return EDGE_DEFS; }
export function sia222EdgeDefsB(): ReadonlyArray<EdgePdbDef> { return EDGE_DEFS_B; }
export { pdbsForModel as sia222PdbsForModel };
export { solvedVec as sia222SolvedVec, applyTokenVec as sia222ApplyToken, isSolvedVec as sia222IsSolved, cornerRank as sia222CornerRank, edgeRank as sia222EdgeRank };

/**
 * Generate a cstimer-style random sia222 scramble (deterministic via the passed rng) for offline sampling: a
 * block of `len` cube-A tokens, `z2 y`, then `len` cube-B tokens (no consecutive same-face within a block). This
 * matches the cstimer megascramble shape used by the sampled-distribution build script.
 */
export function randomSia222Scramble(len: number, rng: () => number): string {
  const faces = ['U', 'R', 'F'];
  const suff = ['', '2', "'"];
  const block = (): string => {
    const out: string[] = []; let last = '';
    for (let i = 0; i < len; i++) {
      let f: string; do { f = faces[Math.floor(rng() * 3)]; } while (f === last);
      last = f;
      out.push(f + suff[Math.floor(rng() * 3)]);
    }
    return out.join(' ');
  };
  return `${block()} z2 y ${block()}`;
}

/**
 * Solve a scramble with pre-built PDBs and return { length, optimal:true } — adapter shape for the offline
 * sampled-distribution build script (build_puzzle_sampled_dist.ts). Always optimal (per-half IDA*).
 */
export function solveSia222Length(pdbs: Sia222Pdbs, scramble: string): { length: number; optimal: boolean } {
  return { length: solveSia222WithPdbs(pdbs, scramble).length, optimal: true };
}
