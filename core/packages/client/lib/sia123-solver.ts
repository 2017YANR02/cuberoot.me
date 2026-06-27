/*
 * Siamese 1×2×3 (sia123 / 联体 1×2×3) OPTIMAL solver — pure TS. TIER B (offline precomputed pattern databases).
 *
 * THE PUZZLE — sia123 is two 3×3×3 cubes glued so they share a 1×2×3 block, moving as ONE bonded body.
 * cstimer's scramble (scramble/megascramble.js, key `sia123`) is
 *     #{[["U"],["R","r"]],%c,%l} z2 #{[["U"],["R","r"]],%c,%l}
 * i.e. a block of `%l` turns of cube A drawn from {U,R,r}×{"","2","'"} (face R + inner slice r, NO outer u),
 * the literal whole-puzzle reorientation `z2` (180° about the shared block's long axis — NOT the sia222 `z2 y`),
 * then a block of cube-B turns written in the same U/R/r notation but applied in the z2-reoriented frame.
 *
 * PROVEN STRUCTURE (measured to saturation; see solver/NONWCA_PUZZLE_LOOP.md "sia123" + .tmp/sia123/): the bonded
 * group is a CLEAN DIRECT PRODUCT G = G_A × G_B — every cube-A token acts on a cubie set disjoint from every
 * cube-B token, all A-tokens commute with all B-tokens (0 violations). The shared 1×2×3 block locks faces of each
 * cube, so EACH HALF is a restricted ⟨U,R,r⟩ 3×3×3 with THREE moving piece types:
 *     6 mobile corners (orbit 29,160, diameter 27)   — one extra corner is locked vs sia222's 7
 *     9 mobile edges   (orbit 92,897,280 = 9!·2⁸, diameter 26)
 *     5 centers: the inner slice `r` 4-cycles four face-centers (orbit-4 POSITION); the 5th (R-axis) center is
 *                positionally fixed. U/R only reorient centers. Center ORIENTATION is invisible (single solid
 *                sticker) so the goal does NOT constrain it; but center POSITION couples to corner/edge parity
 *                and must be tracked as a coordinate (a tiny 4-state PDB folded into the max heuristic + goal).
 * Because the halves are independent AND commute, solving the bonded puzzle reduces to:
 *     split the scramble at "z2" → cube-A tokens / cube-B tokens
 *     solve each half independently to OPTIMAL with the restricted-cube engine (corners + edges + center pos)
 *     concatenate (A-solution, then z2, then B-solution)
 * and the concatenation is GLOBALLY OPTIMAL: length = optimal_A + optimal_B, no shorter bonded solution exists.
 * The faithfulness of the split is verified end-to-end in the tests via an independent geometry oracle.
 *
 * ENGINE — a thin specialization of lib/restricted-cube-solver.ts (the MOVE-SET-PARAMETERIZED restricted-3×3×3
 * IDA* solver), GENERALIZED for movable centers (NZ centers tracked POSITION-only; cornerRank/edgeRank ignore
 * them, a centerRank ranks their permutation, isSolvedVec treats center orientation as don't-care). Instantiated
 * with the ⟨U,R,r⟩ half geometry (lib/sia123-consts.ts for cube A, lib/sia123-b-consts.ts for the z2-conjugated
 * cube B). Heuristic = max(corner PDB, two complementary 6-edge PDBs, center-position PDB) — the standard Korf
 * pattern-database approach (R.E. Korf, AAAI 1997). Solves each half optimally in ≤~1s.
 *
 * TIER B / TABLE — the PDBs are built OFFLINE (packages/scramble-stats-build/src/build_sia123_table.ts): a full
 * corner PDB (dense 6!·3⁶, ~512KB), two complementary 6-edge PDBs (~3.7MB each), a tiny 5! center PDB. Cube B's
 * PDBs are byte-checked against cube A's at build time: the projection distances are invariant under the z2
 * isomorphism so the cube-B tables are byte-identical and SHARED (verified — like sia222). The whole set is
 * serialized + gzipped into stats/scramble/opt_sia123.bin.gz (raw ~16.5MB → gz ~5.25MB; cube B is NOT shareable
 * so both halves are stored, doubling the edge tables → > the 2MB repo limit → PUBLISHED to static.cuberoot.me,
 * fetched via statsUrl(), like sia222). The browser fetches + inflates once into resident Uint8Array tables and
 * solves by IDA*. Provably optimal. Desktop-first (the UI shows a "建议桌面端" hint).
 *
 * PRIOR ART / ATTRIBUTION — scramble + bonded geometry from cstimer (cs0x7f/cstimer, megascramble.js); the
 * restricted-⟨U,R,r⟩ IDA*+PDB algorithm is the textbook Korf/Kociemba approach; the direct-product reduction was
 * proven by an in-repo measurement agent. See about/credits_data.json (cstimer entry) + restricted-cube-solver.ts.
 */

import { statsUrl } from './stats-base';
import {
  buildMoveModel, makeEdgePdbDef, edgeRank, cornerRank, centerRank, solvedVec, applyTokenVec, isSolvedVec,
  idaSolve, type RestrictedMoveModel, type RestrictedPdbs, type EdgePdbDef,
} from './restricted-cube-solver';
import { SIA123_CONSTS } from './sia123-consts';
import { SIA123_B_CONSTS } from './sia123-b-consts';

// ── two half-cube models: cube A (⟨U,R,r⟩) + cube B (= cube A conjugated by g="z2"). ──────────────
// Cube B's tokens act as g·(U/R/r)·g on the bonded geometry; the z2 conjugation changes the orientation convention
// (corner twist / edge flip) AND the piece-id / rank coordinate, so cube B keeps its OWN move tables + labels.
// UNLIKE sia222, the cube-B projection DISTANCES-AS-A-FUNCTION-OF-RANK are NOT byte-identical to cube A's (verified
// in build_sia123_table.ts: the z2 conjugation relabels pieces, so the same physical distance lands at a different
// rank). We therefore build/ship/load SEPARATE cube-A and cube-B PDB byte sets. (Note for sia113: re-run the
// builder's share check; if z2 conjugation again relabels, ship separate tables as here.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODEL_A: RestrictedMoveModel = buildMoveModel(SIA123_CONSTS as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODEL_B: RestrictedMoveModel = buildMoveModel(SIA123_B_CONSTS as any);
/** Two complementary 6-edge groups (overlap on edges 3,4,5) — max(corner, edgeA, edgeB, center) heuristic. */
const EDGE_GROUPS: ReadonlyArray<ReadonlyArray<number>> = [
  [MODEL_A.NC + 0, MODEL_A.NC + 1, MODEL_A.NC + 2, MODEL_A.NC + 3, MODEL_A.NC + 4, MODEL_A.NC + 5],
  [MODEL_A.NC + 3, MODEL_A.NC + 4, MODEL_A.NC + 5, MODEL_A.NC + 6, MODEL_A.NC + 7, MODEL_A.NC + 8],
];
const EDGE_DEFS: EdgePdbDef[] = EDGE_GROUPS.map((g) => makeEdgePdbDef(MODEL_A, g));
const EDGE_DEFS_B: EdgePdbDef[] = EDGE_GROUPS.map((g) => makeEdgePdbDef(MODEL_B, g));
/** Reachable corner-orbit size of one half (BFS-saturated). */
export const SIA123_CORNER_ORBIT = 29160;
/** Reachable edge-orbit size of one half (BFS-saturated). */
export const SIA123_EDGE_ORBIT = 92897280;
/** Reachable center-POSITION orbit of one half (the four r-axis face-centers in a single 4-cycle). */
export const SIA123_CENTER_ORBIT = 4;
/** Full visible (center-position-only) reachable size of one half, as a string. */
export const SIA123_HALF_VISIBLE_ORDER = '5,417,769,369,600';
/** Bonded VISIBLE group order |visible_half|² (≫ 2^53 → string, per §0.0 #4). */
export const SIA123_BONDED_GROUP_ORDER = '29,352,224,556,213,070,635,827,560,960,000';
/** Safe hard cap on a single half solution length (each half ≤ its diameter 27; well above any real scramble). */
export const SIA123_MAX_LENGTH = 60;

// ── PDB tables (resident dense byte arrays) ─────────────────────────────────────────────────────
// Each half has its own corner + 2 edge + center PDBs (cube B is NOT byte-shareable, see header). The half PDB
// shape is the engine's RestrictedPdbs (corner / edges[] / centers).
export type HalfPdbs = RestrictedPdbs;
export interface Sia123Pdbs { a: HalfPdbs; b: HalfPdbs; }

/** OFFLINE: BFS-build all PDBs for BOTH halves (used by the build script + the test). Slow (~seconds). */
export function sia123BuildPdbs(): Sia123Pdbs {
  return { a: buildHalfPdbs(MODEL_A, EDGE_DEFS), b: buildHalfPdbs(MODEL_B, EDGE_DEFS_B) };
}

function buildHalfPdbs(model: RestrictedMoveModel, edgeDefs: EdgePdbDef[]): HalfPdbs {
  const corner = buildCornerPdbLean(model);
  const edges = edgeDefs.map((def) => ({ def, dist: buildEdgePdbLean(model, def) }));
  const centers = buildCenterPdbLean(model);
  return { corner, edges, centers };
}

function buildCornerPdbLean(model: RestrictedMoveModel): Uint8Array {
  const NC = model.NC;
  const size = factorial(NC) * pow3(NC);
  const dist = new Uint8Array(size).fill(255);
  const start = solvedVec(model);
  const startC = start.subarray(0, NC).slice();
  dist[cornerRank(model, start)] = 0;
  let frontier: Int32Array[] = [startC];
  let d = 0;
  while (frontier.length) {
    const next: Int32Array[] = [];
    for (const w of frontier) {
      for (let t = 0; t < model.tokens.length; t++) {
        const o = applyCornerOnly(model, t, w);
        const r = cornerRankOfCornerVec(model, o);
        if (dist[r] === 255) { dist[r] = d + 1; next.push(o); }
      }
    }
    frontier = next; d++;
  }
  return dist;
}
function applyCornerOnly(model: RestrictedMoveModel, t: number, w: Int32Array): Int32Array {
  const act = model.acts[t]; const NC = model.NC;
  const out = new Int32Array(NC);
  for (let j = 0; j < NC; j++) {
    const c = w[j]; const o = c % 24; const piece = (c / 24) | 0;
    const m = act[j * 24 + o]; const to = (m / 24) | 0;
    if (to < NC) out[to] = piece * 24 + (m % 24);
  }
  return out;
}
function cornerRankOfCornerVec(model: RestrictedMoveModel, w: Int32Array): number {
  const NC = model.NC;
  let r = 0; const seen = new Array<boolean>(NC).fill(false); const cp = new Array<number>(NC);
  for (let j = 0; j < NC; j++) cp[j] = (w[j] / 24) | 0;
  for (let i = 0; i < NC; i++) { let s = 0; for (let k = 0; k < cp[i]; k++) if (!seen[k]) s++; r = r * (NC - i) + s; seen[cp[i]] = true; }
  let tw = 0; for (let j = 0; j < NC; j++) tw = tw * 3 + model.cornerTwP[cp[j]][j][w[j] % 24];
  return r * pow3(NC) + tw;
}
function buildEdgePdbLean(model: RestrictedMoveModel, def: EdgePdbDef): Uint8Array {
  const dist = new Uint8Array(def.size).fill(255);
  const start = solvedVec(model);
  dist[edgeRank(model, def, start)] = 0;
  let frontier: Int32Array[] = [start];
  let d = 0;
  while (frontier.length) {
    const next: Int32Array[] = [];
    for (const v of frontier) {
      for (let t = 0; t < model.tokens.length; t++) {
        const o = applyTokenVec(model, t, v);
        const r = edgeRank(model, def, o);
        if (dist[r] === 255) { dist[r] = d + 1; next.push(o); }
      }
    }
    frontier = next; d++;
  }
  return dist;
}
function buildCenterPdbLean(model: RestrictedMoveModel): Uint8Array {
  const NZ = model.NZ ?? 0;
  const dist = new Uint8Array(factorial(NZ)).fill(255);
  const start = solvedVec(model);
  dist[centerRank(model, start)] = 0;
  let frontier: Int32Array[] = [start];
  let d = 0;
  while (frontier.length) {
    const next: Int32Array[] = [];
    for (const v of frontier) {
      for (let t = 0; t < model.tokens.length; t++) {
        const o = applyTokenVec(model, t, v);
        const r = centerRank(model, o);
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
export const SIA123_TABLE_PATH = '/stats/scramble/opt_sia123.bin.gz';
const SIA123_TABLE_MAGIC = 'SI13';

/**
 * On-disk layout (gzip applied by the build script). Two half blocks (cube A then cube B), each:
 *   uint32 LE cornerSize, uint32 LE edgeCount, uint32 LE centerSize, then edgeCount × uint32 LE edge sizes,
 *   then corner dist bytes, center dist bytes, each edge dist bytes.
 * Overall: [0..4) magic "SI13", then half-A block, then half-B block. Deterministic — no Date.now/Math.random.
 */
function serializeHalf(p: HalfPdbs): Uint8Array {
  const edgeCount = p.edges.length;
  const centerSize = p.centers ? p.centers.length : 0;
  const header = 12 + 4 * edgeCount;
  let total = header + p.corner.length + centerSize;
  for (const e of p.edges) total += e.dist.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, p.corner.length, true);
  dv.setUint32(4, edgeCount, true);
  dv.setUint32(8, centerSize, true);
  for (let i = 0; i < edgeCount; i++) dv.setUint32(12 + 4 * i, p.edges[i].dist.length, true);
  let off = header;
  out.set(p.corner, off); off += p.corner.length;
  if (p.centers) { out.set(p.centers, off); off += centerSize; }
  for (const e of p.edges) { out.set(e.dist, off); off += e.dist.length; }
  return out;
}
function deserializeHalf(bytes: Uint8Array, off0: number, defs: EdgePdbDef[]): { half: HalfPdbs; next: number } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cornerSize = dv.getUint32(off0, true);
  const edgeCount = dv.getUint32(off0 + 4, true);
  const centerSize = dv.getUint32(off0 + 8, true);
  if (edgeCount !== defs.length) throw new Error(`sia123 table: edgeCount ${edgeCount} != ${defs.length}`);
  const edgeSizes: number[] = [];
  for (let i = 0; i < edgeCount; i++) edgeSizes.push(dv.getUint32(off0 + 12 + 4 * i, true));
  let off = off0 + 12 + 4 * edgeCount;
  const corner = new Uint8Array(bytes.subarray(off, off + cornerSize)); off += cornerSize;
  let centers: Uint8Array | undefined;
  if (centerSize > 0) { centers = new Uint8Array(bytes.subarray(off, off + centerSize)); off += centerSize; }
  const edges = defs.map((def, i) => {
    if (edgeSizes[i] !== def.size) throw new Error(`sia123 table: edge ${i} size ${edgeSizes[i]} != ${def.size}`);
    const dist = new Uint8Array(bytes.subarray(off, off + edgeSizes[i])); off += edgeSizes[i];
    return { def, dist };
  });
  return { half: { corner, edges, centers }, next: off };
}

export function serializeSia123Pdbs(p: Sia123Pdbs): Uint8Array {
  const a = serializeHalf(p.a), b = serializeHalf(p.b);
  const out = new Uint8Array(4 + a.length + b.length);
  for (let i = 0; i < 4; i++) out[i] = SIA123_TABLE_MAGIC.charCodeAt(i);
  out.set(a, 4); out.set(b, 4 + a.length);
  return out;
}

export function deserializeSia123Pdbs(bytes: Uint8Array): Sia123Pdbs {
  for (let i = 0; i < 4; i++) if (bytes[i] !== SIA123_TABLE_MAGIC.charCodeAt(i)) throw new Error('sia123 table: bad magic');
  const ra = deserializeHalf(bytes, 4, EDGE_DEFS);
  const rb = deserializeHalf(bytes, ra.next, EDGE_DEFS_B);
  return { a: ra.half, b: rb.half };
}

let PDBS: Sia123Pdbs | null = null;
let PDBS_PROMISE: Promise<Sia123Pdbs> | null = null;
const GZIP0 = 0x1f, GZIP1 = 0x8b;
const MAGIC0 = SIA123_TABLE_MAGIC.charCodeAt(0);

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DS = (globalThis as any).DecompressionStream;
  if (typeof DS !== 'function') throw new Error('DecompressionStream unavailable (gzip table cannot be inflated)');
  const stream = new Response(new Blob([bytes as BlobPart])).body!.pipeThrough(new DS('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lazily fetch + inflate + decode the PDBs (cached). Throws a clear error on failure (no in-browser BFS fallback). */
export async function loadSia123Pdbs(): Promise<Sia123Pdbs> {
  if (PDBS) return PDBS;
  if (PDBS_PROMISE) return PDBS_PROMISE;
  PDBS_PROMISE = (async () => {
    const url = statsUrl(SIA123_TABLE_PATH);
    let res: Response;
    try { res = await fetch(url); }
    catch (e) { throw new Error(`无法加载联体 1×2×3 距离表 / failed to fetch the Siamese 1×2×3 table: ${String((e as Error)?.message ?? e)}`); }
    if (!res.ok) throw new Error(`无法加载联体 1×2×3 距离表 (HTTP ${res.status}) / failed to fetch the Siamese 1×2×3 table (HTTP ${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let raw: Uint8Array;
    if (bytes[0] === GZIP0 && bytes[1] === GZIP1) raw = await gunzip(bytes);
    else if (bytes[0] === MAGIC0) raw = bytes;
    else raw = await gunzip(bytes);
    const p = deserializeSia123Pdbs(raw);
    PDBS = p;
    return p;
  })();
  try { return await PDBS_PROMISE; }
  catch (e) { PDBS_PROMISE = null; throw e; }
}

/** Test/diagnostic only: inject already-built PDBs (skips fetch). */
export function _setSia123PdbsForTest(p: Sia123Pdbs | null): void { PDBS = p; PDBS_PROMISE = null; }

// ── scramble parsing + A/B split ────────────────────────────────────────────────────────────────
const HALF_TOKEN_RE = /^[URr](2|')?$/;

export interface Sia123Split { aTokens: string[]; bTokens: string[]; }

/**
 * Parse a cstimer sia123 scramble into its cube-A and cube-B token blocks, separated by the literal whole-puzzle
 * reorientation `z2`. Throws Error('bad: <tok>') on any token outside U/R/r·{"","2","'"} or a missing `z2`.
 */
export function parseSia123Scramble(scramble: string): Sia123Split {
  const s = scramble.trim();
  const toks = s.split(/\s+/).filter(Boolean);
  const zi = toks.indexOf('z2');
  if (zi < 0) throw new Error("bad: missing 'z2' separator");
  const parse = (part: string[]): string[] => {
    const out: string[] = [];
    for (const tok of part) {
      if (!tok) continue;
      if (!HALF_TOKEN_RE.test(tok)) throw new Error(`bad: ${tok}`);
      out.push(tok);
    }
    return out;
  };
  return { aTokens: parse(toks.slice(0, zi)), bTokens: parse(toks.slice(zi + 1)) };
}

/** Apply a list of half tokens to a fresh half state in the given model, returning the state vector. */
function applyHalf(model: RestrictedMoveModel, tokens: ReadonlyArray<string>): Int32Array {
  const idx = new Map<string, number>(model.tokens.map((t, i) => [t, i]));
  let v = solvedVec(model);
  for (const tok of tokens) v = applyTokenVec(model, idx.get(tok)!, v);
  return v;
}

// ── public solve API ────────────────────────────────────────────────────────────────────────────
export interface Sia123Solution {
  /** Full bonded optimal solution: A-solution, then `z2`, then B-solution (the same notation cstimer uses). */
  solution: string;
  /** Total optimal move count (= optimal_A + optimal_B). */
  length: number;
  /** Per-half optimal lengths [A, B]. */
  halfLengths: [number, number];
}

/** Solve a parsed scramble's two halves with already-built PDBs (synchronous core). Provably optimal per half. */
export function solveSia123WithPdbs(pdbs: Sia123Pdbs, scramble: string): Sia123Solution {
  const { aTokens, bTokens } = parseSia123Scramble(scramble);
  const va = applyHalf(MODEL_A, aTokens);
  const vb = applyHalf(MODEL_B, bTokens);
  const ra = idaSolve(MODEL_A, pdbs.a, va, { maxDepth: SIA123_MAX_LENGTH });
  const rb = idaSolve(MODEL_B, pdbs.b, vb, { maxDepth: SIA123_MAX_LENGTH });
  if (!ra || !rb) throw new Error('sia123: no solution within bound (unexpected — report this scramble)');
  const aSol = ra.path.map((t) => MODEL_A.tokens[t]);
  const bSol = rb.path.map((t) => MODEL_B.tokens[t]);
  // The full bonded solution is the A-solution then (after the same z2 reorientation) the B-solution, written in
  // the cube-B frame exactly as cstimer writes the B-block. We present it the same way: "<A> z2 <B>".
  const parts: string[] = [];
  if (aSol.length) parts.push(aSol.join(' '));
  parts.push('z2');
  if (bSol.length) parts.push(bSol.join(' '));
  return {
    solution: parts.join(' '),
    length: ra.length + rb.length,
    halfLengths: [ra.length, rb.length],
  };
}

/** Solve a sia123 scramble optimally (async: lazily fetch+inflate the PDB table on first call). */
export async function solveSia123(scramble: string): Promise<Sia123Solution> {
  parseSia123Scramble(scramble); // eager validation (reject bad tokens without fetching)
  const pdbs = await loadSia123Pdbs();
  return solveSia123WithPdbs(pdbs, scramble);
}

// ── helpers for the offline sampled-distribution build + tests ────────────────────────────────────
/** The cube-A engine model + edge defs (for tests that re-derive ranks / build PDBs). */
export function sia123Model(): RestrictedMoveModel { return MODEL_A; }
/** The cube-B engine model (z2-conjugated frame). */
export function sia123ModelB(): RestrictedMoveModel { return MODEL_B; }
export function sia123EdgeDefs(): ReadonlyArray<EdgePdbDef> { return EDGE_DEFS; }
export function sia123EdgeDefsB(): ReadonlyArray<EdgePdbDef> { return EDGE_DEFS_B; }
export {
  solvedVec as sia123SolvedVec, applyTokenVec as sia123ApplyToken, isSolvedVec as sia123IsSolved,
  cornerRank as sia123CornerRank, edgeRank as sia123EdgeRank, centerRank as sia123CenterRank,
};

/**
 * Generate a cstimer-style random sia123 scramble (deterministic via the passed rng) for offline sampling: a block
 * of `len` cube-A tokens, `z2`, then `len` cube-B tokens (no consecutive same-AXIS within a block — cstimer treats
 * R and r as the same axis). Matches the cstimer megascramble shape used by the sampled-distribution build script.
 */
export function randomSia123Scramble(len: number, rng: () => number): string {
  // cstimer move-set: two axes — U-axis {U}, Rr-axis {R, r}. No two consecutive tokens from the same axis.
  const AXES = [['U'], ['R', 'r']];
  const suff = ['', '2', "'"];
  const block = (): string => {
    const out: string[] = []; let lastAxis = -1;
    for (let i = 0; i < len; i++) {
      let ax: number; do { ax = Math.floor(rng() * 2); } while (ax === lastAxis);
      lastAxis = ax;
      const faces = AXES[ax];
      const f = faces[Math.floor(rng() * faces.length)];
      out.push(f + suff[Math.floor(rng() * 3)]);
    }
    return out.join(' ');
  };
  return `${block()} z2 ${block()}`;
}

/**
 * Solve a scramble with pre-built PDBs and return { length, optimal:true } — adapter shape for the offline
 * sampled-distribution build script (build_puzzle_sampled_dist.ts). Always optimal (per-half IDA*).
 */
export function solveSia123Length(pdbs: Sia123Pdbs, scramble: string): { length: number; optimal: boolean } {
  return { length: solveSia123WithPdbs(pdbs, scramble).length, optimal: true };
}
