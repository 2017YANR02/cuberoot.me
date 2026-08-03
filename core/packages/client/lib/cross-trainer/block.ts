/*
 * cross-trainer/block — the 2×2×2 block: one corner plus its three edges, home and oriented.
 *
 * This is the cheapest stage in the directory and the reason is arithmetic: the block tracks four
 * pieces, so its coordinate is 24 corner placements × 24·22·20 ordered edge placements = 253,440
 * states. A full BFS fills that in a few milliseconds and answers every depth exactly — no
 * rejection sampler, no admissible search, no depth that is "too rare". Compare EOCross's
 * 24,330,240 (a 24 MB table and ~2 s) or XCross's per-frame build.
 *
 * Frames work exactly as they do for XCross: a block is named by (cross face, F2L slot) — the
 * slot's corner is the block's corner, the slot's edge is one of its three edges, and the other
 * two are the cross edges adjacent to that corner. So the 24 frames are the 24 (face, slot) pairs
 * ./rotate already collapses onto the canonical one (D cross, FR slot = the DFR block), and this
 * file only ever builds that one table.
 *
 * Note the 24 frames name only 8 distinct blocks — each corner is reachable from each of its three
 * faces. Callers that minimise over frames must therefore deduplicate (see `blockFrames` in
 * ./index), or two thirds of a conditional draw is spent on frames that can never win the
 * lowest-index tie-break.
 */

import type { CubieCube } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';
import {
  CORNER_STEP, EDGE_STEP, FACE_CORNERS, FACE_EDGES, f2lSlots, slotRank, slotUnrank, type FaceIdx,
} from './model';
import { CANON_FACE, CANON_SLOT } from './rotate';
import { fillState, type Pin } from './fill';

/** Corner placements: slot·3 + twist. */
const CORNER_STATES = 24;
/** Ordered placements of the three tracked edges: 12·11·10 slot triples × 2³ flips. */
export const BLOCK_EDGE_STATES = 12 * 11 * 10 * 8;   // 10,560
export const BLOCK222_STATES = CORNER_STATES * BLOCK_EDGE_STATES;   // 253,440
/**
 * Diameter of the 2×2×2 block, from the BFS below — an exhaustive count, not a search bound.
 * `tests/cross_trainer_block.test.ts` re-derives it, so a change here is a change in the table.
 */
export const BLOCK222_MAX_DEPTH = 8;

/** Faces a corner belongs to (same derivation ./model uses: membership = "the face's turn moves it"). */
const CORNER_FACES: number[][] = Array.from({ length: 8 }, (_, c) =>
  [0, 1, 2, 3, 4, 5].filter((f) => FACE_CORNERS[f].includes(c)));

/**
 * The pieces a (face, slot) block is made of: the slot's corner, the slot's edge, and the two
 * cross edges that corner touches — derived from face membership, so there is no table to get
 * wrong. For (D, FR) that is corner DFR with edges DF, DR, FR.
 */
export function blockPieces(face: FaceIdx, slot: number): { corner: number; edges: number[] } {
  const s = f2lSlots(face)[slot];
  const sides = CORNER_FACES[s.corner].filter((f) => f !== face);
  const cross = FACE_EDGES[face].filter((e) => sides.some((f) => FACE_EDGES[f].includes(e)));
  return { corner: s.corner, edges: [...cross, s.edge].sort((a, b) => a - b) };
}

/** The canonical frame this file's table is built for: D cross, FR slot → the DFR block. */
export const CANON_BLOCK = blockPieces(CANON_FACE, CANON_SLOT);

/**
 * The two Roux openers' whole histograms, from ./tracked's BFS. Exported because
 * /scramble/stats ships them as exhaustive datasets and both places must read one number;
 * `tests/cross_trainer_tracked.test.ts` re-derives them from every frame on every run.
 */
export const SQUARE122_HISTOGRAM: readonly number[] = [1, 9, 78, 590, 2922, 6523, 2525, 24];
export const BLOCK123_HISTOGRAM: readonly number[] =
  [1, 12, 132, 1406, 14099, 122279, 797145, 2638638, 1715068, 33460];

/** The face opposite `f` — kociemba's order is U R F D L B, so it is a fixed offset. */
const opposite = (f: FaceIdx): FaceIdx => ((f + 3) % 6) as FaceIdx;
/** The edge piece shared by two adjacent faces. */
const sharedEdge = (a: FaceIdx, b: FaceIdx): number =>
  FACE_EDGES[a].find((e) => FACE_EDGES[b].includes(e))!;

/**
 * Roux's first block, the 1×2×3 standing on face `f` against side face `s`: face s's two
 * corners that also touch f, plus its three edges that avoid the face opposite f. Derived from
 * membership like the 2×2×2 above, so the four side faces of a colour come out for free —
 * `solver/src/bin/roux_analyzer.rs` measures exactly those four ("每底色 4 个侧立块最小").
 */
export function block123Pieces(f: FaceIdx, s: FaceIdx): { corners: number[]; edges: number[] } {
  if (s === f || s === opposite(f)) throw new Error(`side face ${s} is not adjacent to ${f}`);
  const opp = opposite(f);
  return {
    corners: FACE_CORNERS[s].filter((c) => FACE_CORNERS[f].includes(c)),
    edges: FACE_EDGES[s].filter((e) => !FACE_EDGES[opp].includes(e)),
  };
}

/**
 * Roux's square, the 1×2×2 half of that block: one of its two corners, the f–s edge, and the
 * edge joining s to that corner's third face. `which` picks the half (0/1 = the two corners in
 * ascending piece order) — the eight targets a colour has in the analyzer are these two halves
 * over the four side faces.
 */
export function square122Pieces(f: FaceIdx, s: FaceIdx, which: 0 | 1): { corners: number[]; edges: number[] } {
  const corner = block123Pieces(f, s).corners[which];
  const third = CORNER_FACES[corner].find((x) => x !== f && x !== s)! as FaceIdx;
  return { corners: [corner], edges: [sharedEdge(f, s), sharedEdge(s, third)].sort((a, b) => a - b) };
}

// ── coordinate ───────────────────────────────────────────────────────────────────────────────

/** Pack three edge placements (each `slot*2 + ori`, in tracked-piece order) into 0..10,559. */
export function packBlockEdges(a: number, b: number, c: number): number {
  const slots = [a >> 1, b >> 1, c >> 1];
  return slotRank(slots, 3) * 8 + ((a & 1) << 2 | (b & 1) << 1 | (c & 1));
}

const unpackBlockEdges = (idx: number, out: Int8Array): void => {
  const flips = idx & 7;
  slotUnrank((idx / 8) | 0, 3, out);
  for (let k = 0; k < 3; k++) out[k] = out[k] * 2 + ((flips >> (2 - k)) & 1);
};

/** Table index of a (corner, edges) coordinate. Corner-major: the edge block stays in cache. */
export const blockPack = (corner: number, edges: number): number => corner * BLOCK_EDGE_STATES + edges;

/** The canonical block's coordinate of a state that is already in the canonical frame. */
export function blockCoordOf(state: CubieCube, pieces = CANON_BLOCK): number {
  const cs = state.cp.indexOf(pieces.corner);
  const e = (piece: number) => { const s = state.ep.indexOf(piece); return s * 2 + state.eo[s]; };
  const [p, q, r] = pieces.edges;
  return blockPack(cs * 3 + state.co[cs], packBlockEdges(e(p), e(q), e(r)));
}

// ── transitions + the exact table ────────────────────────────────────────────────────────────

interface BlockTable {
  dist: Uint8Array;
  hist: number[];
  /** Every index, sorted by depth — `layer[start[d] .. start[d+1])` is layer d, so draws are O(1). */
  layer: Int32Array;
  start: Int32Array;
}

let cache: BlockTable | null = null;

/** edgeNext[idx*18 + m] over the 10,560 packed edge triples. */
function buildEdgeNext(): Int32Array {
  const t = new Int32Array(BLOCK_EDGE_STATES * 18);
  const cur = new Int8Array(3);
  for (let i = 0; i < BLOCK_EDGE_STATES; i++) {
    unpackBlockEdges(i, cur);
    for (let m = 0; m < 18; m++) {
      const step = EDGE_STEP[m];
      t[i * 18 + m] = packBlockEdges(step[cur[0]], step[cur[1]], step[cur[2]]);
    }
  }
  return t;
}

function build(): BlockTable {
  const edgeNext = buildEdgeNext();
  const cornerNext = new Int32Array(CORNER_STATES * 18);
  for (let c = 0; c < CORNER_STATES; c++) {
    for (let m = 0; m < 18; m++) cornerNext[c * 18 + m] = CORNER_STEP[m][c];
  }

  const { corner, edges } = CANON_BLOCK;
  const goal = blockPack(
    corner * 3,
    packBlockEdges(edges[0] * 2, edges[1] * 2, edges[2] * 2),
  );

  const dist = new Uint8Array(BLOCK222_STATES).fill(255);
  dist[goal] = 0;
  const hist = [1];
  let frontier = [goal];
  let filled = 1;
  for (let depth = 0; filled < BLOCK222_STATES; depth++) {
    const next: number[] = [];
    for (const v of frontier) {
      const c = (v / BLOCK_EDGE_STATES) | 0, e = v % BLOCK_EDGE_STATES;
      const crow = c * 18, erow = e * 18;
      for (let m = 0; m < 18; m++) {
        const t = cornerNext[crow + m] * BLOCK_EDGE_STATES + edgeNext[erow + m];
        if (dist[t] === 255) { dist[t] = depth + 1; next.push(t); }
      }
    }
    hist.push(next.length);
    filled += next.length;
    frontier = next;
  }

  const start = new Int32Array(hist.length + 1);
  for (let d = 0; d < hist.length; d++) start[d + 1] = start[d] + hist[d];
  const cursor = start.slice();
  const layer = new Int32Array(BLOCK222_STATES);
  for (let i = 0; i < BLOCK222_STATES; i++) layer[cursor[dist[i]]++] = i;
  return { dist, hist, layer, start };
}

const table = (): BlockTable => (cache ??= build());

/** Exact optimal length of every 2×2×2-block coordinate (253,440 bytes). */
export const block222Dist = (): Uint8Array => table().dist;
/** Depth histogram, index = optimal length. Sums to 253,440. */
export const block222Histogram = (): number[] => table().hist.slice();

/** Exact length of a coordinate, or -1 above `cap` (the contract every frameDist honours). */
export function block222DistCapped(coord: number, cap: number): number {
  const v = table().dist[coord];
  return v <= cap ? v : -1;
}

// ── sampling ─────────────────────────────────────────────────────────────────────────────────

/**
 * A uniformly random coordinate whose optimal length is in [lo,hi], drawn straight out of the
 * enumerated layers — every depth costs the same, including the deepest.
 */
export function sampleBlockCoord(
  lo: number, hi: number, rng: () => number,
): { coord: number; depth: number } | null {
  const { hist, layer, start } = table();
  const top = Math.min(hi, hist.length - 1);
  if (lo > top || lo < 0) return null;
  let total = 0;
  for (let d = lo; d <= top; d++) total += hist[d];
  if (!total) return null;
  // An rng that can return exactly 1 would land r on `total` and fall out of the loop — and for an
  // `exactLayers` stage a null draw is read as PROOF the difficulty does not exist, which the UI
  // then latches. Clamp instead: a one-in-2^32 bias beats a permanent false notice.
  let r = Math.min((rng() * total) | 0, total - 1);
  for (let d = lo; d <= top; d++) {
    if (r < hist[d]) return { coord: layer[start[d] + r], depth: d };
    r -= hist[d];
  }
  return null;
}

/** The block's four pieces as fill.ts pins. */
export function blockPins(coord: number, pieces = CANON_BLOCK): { edgePins: Pin[]; cornerPins: Pin[] } {
  const corner = (coord / BLOCK_EDGE_STATES) | 0;
  const cur = new Int8Array(3);
  unpackBlockEdges(coord % BLOCK_EDGE_STATES, cur);
  return {
    edgePins: pieces.edges.map((piece, k) => ({ piece, slot: cur[k] >> 1, ori: cur[k] & 1 })),
    cornerPins: [{ piece: pieces.corner, slot: (corner / 3) | 0, ori: corner % 3 }],
  };
}

/** One uniformly random legal cube whose canonical-frame block is exactly `depth` moves. */
export function sampleBlockState(
  lo: number, hi: number, rng: () => number,
): { state: CubieCube; depth: number } | null {
  const got = sampleBlockCoord(lo, hi, rng);
  if (!got) return null;
  const { edgePins, cornerPins } = blockPins(got.coord);
  return { state: fillState(edgePins, cornerPins, rng), depth: got.depth };
}
