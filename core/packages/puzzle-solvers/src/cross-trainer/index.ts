/*
 * cross-trainer — one entry point for "give me a cube state whose <sub-step> is exactly N
 * optimal HTM moves", the thing the vendored or18 trainers do (tools/cross_trainer/) and the
 * thing the timer's random source needs in order to have a difficulty of its own.
 *
 * Two difficulty semantics, both supported per stage (see TrainerSpec):
 *   fixed  — or18's: one cross colour, and for the paired stages one specific F2L slot.
 *   best   — the site's WCA-difficulty semantics (/scramble/stats, the WCA-real-scramble
 *            filter): the metric is the BEST over the chosen colours (and over the four
 *            slots), so "six-colour cross, 5 moves" means the same thing under both sources.
 *
 * Only the canonical frame (cross on D, slot DFR) ever gets tables built; every other frame is
 * reached by rotating the state (see ./rotate). That is what keeps "best over six colours"
 * affordable — 1 table build instead of 24.
 */

import type { CubieCube } from '../kociemba/cube.js';
import {
  COLOR_FACE, CORNER_STEP, EDGE_STEP, FACE_COLOR, FACE_EDGES, MOVE_NAMES, N_MOVES,
  f2lSlots, slotRank, type FaceIdx,
} from './model.js';
import {
  EOCROSS_MAX_DEPTH, eoCrossDistCapped, eoFrameData, sampleEoCrossState,
  type EoAxis, type EoCoord, type EoFrame, type EoFrameData,
} from './eo.js';
import { crossDist, decodeCross, encodeCross } from './dist.js';
import { sampleCrossLayer } from './sample.js';
import { fillState, type Pin } from './fill.js';
import {
  frameData, sampleXCoord, xcrossDistCapped, XCROSS_MAX_DEPTH,
  type XCoord,
} from './xcross.js';
import {
  PAIR_MAX_DEPTH, PSEUDO_PAIR_MAX_DEPTH, pairDistCapped, pairFrameData, pairPins, samplePairCoord,
  type PairFrame,
} from './pair.js';
import {
  PSEUDO_CROSS_MAX_DEPTH, PSEUDO_XCROSS_MAX_DEPTH, XXCROSS_MAX_DEPTH,
  pseudoCrossDist, pseudoCrossPins, pseudoXFrameData, pseudoXcrossDistCapped, pseudoXcrossPins,
  samplePseudoCross, samplePseudoXCoord, sampleXXCoord, xxFrameData, xxcrossDistCapped, xxcrossPins,
  type XXCoord, type XXFrame, type XXFrameData,
} from './multi.js';
import {
  XPAIR_MAX_DEPTH, sampleXPairCoord, xpairDistCapped, xpairFrameData, xpairPins,
} from './xpair.js';
import { BLOCK222_MAX_DEPTH, block222DistCapped, blockCoordOf, sampleBlockState } from './block.js';
import {
  EOLINE_MAX_DEPTH, EO_MAX_DEPTH, eoDistCapped, eoLineDist, sampleEoLineState, sampleEoState,
} from './eoline.js';
import { CANON_FACE, CANON_SLOT, ROTATIONS, ROT_FOR_FRAME, inverseRotation, rotForFaceAxis, rotateState } from './rotate.js';
import { drawCorpus } from './corpus.js';

// ── vocabulary ───────────────────────────────────────────────────────────────────────────────

/** Colour letters as used by SubsetColorPicker / the scramble stats subset keys. */
export type ColorLetter = 'B' | 'G' | 'O' | 'R' | 'W' | 'Y';
const LETTER_FACE: Record<ColorLetter, FaceIdx> = {
  W: COLOR_FACE.White, Y: COLOR_FACE.Yellow, G: COLOR_FACE.Green,
  B: COLOR_FACE.Blue, R: COLOR_FACE.Red, O: COLOR_FACE.Orange,
};
const FACE_LETTER: Record<number, ColorLetter> = {
  [COLOR_FACE.White]: 'W', [COLOR_FACE.Yellow]: 'Y', [COLOR_FACE.Green]: 'G',
  [COLOR_FACE.Blue]: 'B', [COLOR_FACE.Red]: 'R', [COLOR_FACE.Orange]: 'O',
};

/** Subset key ('W' / 'WY' / 'BGORWY') → cross faces. Unknown letters are dropped. */
export function facesOfSubset(key: string): FaceIdx[] {
  const seen = new Set<FaceIdx>();
  for (const ch of key.toUpperCase()) {
    const f = LETTER_FACE[ch as ColorLetter];
    if (f !== undefined) seen.add(f);
  }
  return [...seen];
}
export const letterOfFace = (f: FaceIdx): ColorLetter => FACE_LETTER[f];
/** Slot names of a cross face, e.g. ['FR','FL','BL','BR'] — the F2L slot picker's options. */
export const slotNamesOf = (f: FaceIdx): string[] => f2lSlots(f).map((s) => s.name);
export { FACE_COLOR };

/** How a stage's difficulty is measured. `slot` is ignored by stages without an F2L pair. */
export interface TrainerSpec {
  variant: string;
  stage: string;
  /** Subset key from SubsetColorPicker, e.g. 'W' (fixed colour) or 'BGORWY' (colour neutral). */
  colors: string;
  /** Index into slotNamesOf(face), or 'best' = the easiest of the four. */
  slot: number | 'best';
  /** Inclusive optimal-length window. */
  lo: number;
  hi: number;
}

export interface TrainerCaps {
  /** The stage pairs a specific F2L slot → the slot picker applies. */
  slots: boolean;
  /** Full reachable range of the metric for one frame. */
  range: [number, number];
  /** Default window when the user first turns difficulty on. */
  band: [number, number];
  /** Table build is seconds, not milliseconds → the UI shows a "preparing" state. */
  heavy: boolean;
}

/**
 * One concrete goal: a cross colour plus whatever else the stage pins (an F2L slot, a pair of
 * them, …). `colour-neutral, best slot` = several frames, and the metric is the best of them.
 */
export interface TrainerFrame {
  face: FaceIdx;
  /** Slot indices this frame pairs (empty for the slotless stages). */
  slots: number[];
  /** The slots have different roles (XCross-pair: first solved, second paired). */
  ordered?: boolean;
  /** EO stages: the axis orientation is measured against — a cross colour admits two of them. */
  axis?: EoAxis;
  /** Pure EO: the axis alone names the frame, the colour that led to it carries no information. */
  axisOnly?: boolean;
}

type Sampler = (spec: ResolvedSpec, rng: () => number, def: StageDef) => Sampled | null;

/**
 * Why a draw came back empty. The distinction is the whole difference between an honest
 * "no cube has this difficulty" and a lie: a cold table build or an unlucky rare window must
 * NOT be reported as non-existent, or the UI latches a permanent false notice.
 */
export type DrawOutcome =
  | { ok: true; state: CubieCube; depth: number }
  | { ok: false; reason: 'empty' | 'budget' };
interface StageDef extends TrainerCaps {
  variant: string;
  stage: string;
  /** One frame's sampler walks fully enumerated layers → "nothing came back" proves emptiness. */
  exactLayers?: boolean;
  /** Exactly-uniform draw. Given ONE frame it should use that stage's enumerated layers. */
  sample: Sampler;
  /** The frames a spec covers. */
  frames: (spec: ResolvedSpec) => TrainerFrame[];
  /** Exact optimal length for one frame, or -1 above `cap`. */
  frameDist: (state: CubieCube, frame: TrainerFrame, cap: number) => number;
}

export interface Sampled { state: CubieCube; depth: number }

interface ResolvedSpec {
  faces: FaceIdx[];
  slot: number | 'best';
  lo: number;
  hi: number;
  /** Wall clock a multi-frame draw may spend before reporting "unreachable". */
  budgetMs: number;
  /** Out-param: why the draw failed. Only meaningful when the sampler returned null. */
  fail: { reason: 'empty' | 'budget' };
}

/** The frames of a spec, for a stage with an F2L slot dimension. */
const slotFrames = ({ faces, slot }: ResolvedSpec): TrainerFrame[] =>
  faces.flatMap((face) => (slot === 'best' ? [0, 1, 2, 3] : [slot]).map((s) => ({ face, slots: [s] })));
const faceFrames = ({ faces }: ResolvedSpec): TrainerFrame[] => faces.map((face) => ({ face, slots: [] }));
/** XXCross picks two slots; index 0..5 is a pair, 'best' is all six. */
const XX_PAIRS: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [0, 3], [0, 2], [1, 3]];
const pairFrames = ({ faces, slot }: ResolvedSpec): TrainerFrame[] =>
  faces.flatMap((face) => (slot === 'best' ? XX_PAIRS : [XX_PAIRS[slot] ?? XX_PAIRS[0]]).map((p) => ({ face, slots: [...p] })));

/** Anything carrying the pieces an XCoord tracks — xcross, free pair and pseudo variants alike. */
export interface XLike { crossPieces: number[]; cornerPiece: number; edgePiece: number }

/**
 * Wrap a single-frame exact sampler. One frame (or18's semantics: fixed colour, fixed slot) ->
 * that sampler, which enumerates the layer and is exact. Several frames (a colour subset, or
 * "best slot") -> the metric is a MINIMUM over dependent coordinates, and there are two ways to
 * draw it. We alternate between them, because each one is hopeless exactly where the other wins:
 *
 *   A  uniform cube -> best over the frames, accept if it lands in the window. Exactly uniform,
 *      and the right engine when the window covers the bulk of the distribution.
 *   B  conditional draw: pick a frame f, ask the stage for a state whose length **in f's own
 *      frame** lands in [lo,hi] (every stage can do that exactly), then accept iff no other frame
 *      is shallower - and when another frame ties, only if f is the first of them.
 *
 * Why B is uniform too: its proposal is uniform over the union of the frames' own windows (a
 * SUPERSET of the target set), and the tie-break makes every state in the target the output of
 * exactly one (frame, draw). Uniform over a superset, accept a subset -> uniform over the subset.
 *
 * That is also why B draws the WHOLE window instead of one depth at a time. Conditioning on a
 * single depth is exact only for that depth, so cycling the depths inside the window silently
 * reweighted it: "six colours, 4-6 moves" came back 4 moves 84% of the time against a true 26%,
 * and "0-8 moves" returned an already-solved cross essentially every time.
 *
 * B is what makes the rare end reachable: "six-colour cross, 0 moves" is 1 state in 190,080 for A
 * (~30k draws) and a first-try hit for B - the other five colours cannot be below 0, so the test
 * is free. A stays because a wide window around the mode is exactly where B's "nothing shallower"
 * test throws almost everything away.
 *
 * Known deviation, deliberate: B is uniform only when the frames are conjugate, so that their
 * windows have equal size. That holds wherever frames differ by a colour and/or one slot. It does
 * NOT hold for the two stages whose "best" frames come in two SHAPES - XXCross (4 adjacent slot
 * pairs + 2 diagonal) and XCross+pair - whose layer sizes part ways from depth 2 (see multi.ts).
 * There the diagonal representatives come out ~1-2% under weight.
 *
 * The budget is a wall clock, not a try count: one deep XXCross draw costs milliseconds, and a
 * fixed try count would hang the worker instead of reporting "unreachable".
 */
export const REJECT_BUDGET_MS = 8000;

/** A stage's own draw for ONE frame. `maxTries` is honoured by the stages that reject. */
type FrameSampler =
  (frame: TrainerFrame, lo: number, hi: number, rng: () => number, maxTries?: number) => Sampled | null;

/** Tries a single frame gets before "did not come back" counts as "not there" (the samplers' own
 *  historical default — kept so the drop/empty decisions below mean what they used to). */
const TRY_CAP = 200000;
/** One conditional-layer attempt's slice. B alternates with A, so it may not eat the whole budget. */
const B_SLICE_MS = 120;

/**
 * Draw from one frame under a WALL CLOCK. The stage samplers count tries, but a try costs anywhere
 * from a microsecond (cross) to 1.2 ms (XCross + pair), so a try count bounds nothing: 200k tries
 * of the latter is a four-minute freeze of the worker, which is what "single-colour XCross+pair at
 * 11 moves" used to do. So: ask for a small chunk, time it, and size the next chunk to what is
 * left. `done` means more tries would not help — an enumerating stage said no, or the try cap is
 * spent — as opposed to simply running out of clock.
 */
function drawFrame(
  sampleFrame: FrameSampler, frame: TrainerFrame, lo: number, hi: number,
  rng: () => number, budgetMs: number, exact: boolean,
): { got: Sampled | null; done: boolean } {
  // Start tiny. The first chunk is unconditional - it is the one that pays for the table build -
  // so sizing it for a cheap stage (1 us/try) makes an expensive one (3.3 ms/try at the XXCross
  // cap) blow a whole 120 ms slice on its very first call. Growth is geometric, so a cheap stage
  // reaches its stride within a handful of calls.
  let chunk = 32;
  let spent = 0;
  let deadline = 0;
  for (;;) {
    const t0 = Date.now();
    const got = sampleFrame(frame, lo, hi, rng, chunk);
    spent += chunk;
    if (got) return { got, done: false };
    // Enumerated the window: nothing there, ever. That - and only that - is a proof of emptiness.
    // A spent try cap is just a spent try cap; reporting it as `done` would let the UI latch a
    // permanent "this difficulty does not exist" on what is really a slow machine.
    if (exact) return { got: null, done: true };
    const now = Date.now();
    // The clock starts after the first chunk, which is the one that pays for the table build
    // (a cold XXCross build alone outlasts any sampling budget).
    if (!deadline) deadline = now + budgetMs;
    const left = deadline - now;
    if (left <= 0 || spent >= TRY_CAP) return { got: null, done: false };
    const perMs = chunk / Math.max(1, now - t0);
    chunk = Math.max(1, Math.min(chunk * 4, Math.ceil(perMs * left), TRY_CAP - spent));
  }
}

function oneFrame(sampleFrame: FrameSampler): Sampler {
  return (spec, rng, def) => {
    const frames = def.frames(spec);
    if (frames.length === 1) {
      const one = drawFrame(sampleFrame, frames[0], spec.lo, spec.hi, rng, spec.budgetMs, !!def.exactLayers);
      // A single frame enumerates its own layers, so "nothing came back" IS emptiness for the
      // stages that enumerate; the ones that reject internally can only have run out of tries.
      if (!one.got) spec.fail.reason = def.exactLayers ? 'empty' : 'budget';
      return one.got;
    }
    // Frames are conjugate, so one frame proving ITS window empty proves the minimum over frames
    // cannot land in the window either. Only an enumerating stage can prove that.
    let proven = false;
    // The clock starts AFTER the first draw, which is the one that pays for the table build:
    // a cold XXCross build alone outlasts the whole budget, and charging it to the search made
    // the caller report "this difficulty does not exist" for a window that samples in 1 ms warm.
    // No try cap: the budget is the wall clock. A try costs a microsecond for cross and a
    // millisecond for XXCross, so any fixed count either wastes most of a cheap stage's budget
    // (300k cross tries = 1 s of an allotted 3) or freezes an expensive one.
    let deadline = Number.POSITIVE_INFINITY;
    for (let t = 0; ; t++) {
      if (t === 1) deadline = Date.now() + spec.budgetMs;
      if (t & 1) {
        // -- A: uniform cube, keep it if the best frame lands in the window --
        const state = fillState([], [], rng);
        let best = -1;
        for (const fr of frames) {
          const v = def.frameDist(state, fr, best < 0 ? spec.hi : best - 1);
          if (v >= 0 && (best < 0 || v < best)) best = v;
          if (best === 0) break;
        }
        // `<= hi` is checked explicitly: a frameDist that ignores its cap would otherwise hand
        // back a state of the wrong difficulty (pseudo-cross did exactly that).
        if (best >= spec.lo && best <= spec.hi) return { state, depth: best };
        // A is the cheap half - one clock read per 16 of them is enough.
        if ((t & 15) === 15 && Date.now() > deadline) break;
      } else {
        // -- B: draw one frame's own window, accept only if it is the shallowest (first) frame --
        const fi = (rng() * frames.length) | 0;
        const { got, done } = drawFrame(
          sampleFrame, frames[fi], spec.lo, spec.hi, rng, Math.min(B_SLICE_MS, spec.budgetMs),
          !!def.exactLayers,
        );
        if (got) {
          const d = got.depth;
          let ok = true;
          for (let g = 0; g < frames.length && ok; g++) {
            if (g === fi) continue;
            // Earlier frames may not even tie (they would own the state); later ones must be deeper.
            const cap = g < fi ? d : d - 1;
            if (cap >= 0 && def.frameDist(got.state, frames[g], cap) >= 0) ok = false;
          }
          if (ok) return { state: got.state, depth: d };
        } else if (done) {
          proven = true;
          break;
        }
        // B is the expensive half - check the clock after every one of them.
        if (Date.now() > deadline) break;
      }
    }
    // Emptiness has to be PROVEN (an enumerated window came back empty); a spent budget is not a
    // proof, and reporting it as one is what latched a permanent, false "cannot be generated".
    spec.fail.reason = proven ? 'empty' : 'budget';
    return null;
  };
}

/** Carry a state generated in the canonical frame back to the frame the user asked for. */
const unrotate = (state: CubieCube, rot: number): CubieCube => rotateState(state, inverseRotation(rot));

// ── stage: cross ─────────────────────────────────────────────────────────────────────────────

// Cross goes through the same two engines as every other stage. It used to have its own
// multi-colour loop (pure rejection), and that loop could not reach the extremes: "six colours,
// 8 moves" needs ALL SIX crosses at the maximum at once (p ≈ 1e-8 for a uniform cube), while
// engine B starts from one colour's enumerated depth-8 layer and only has to test the other five.
const sampleCross: Sampler = oneFrame((fr, lo, hi, rng) => sampleCrossLayer(fr.face, lo, hi, rng));

/** Best optimal cross length over `faces` (the metric the site's difficulty filter uses). */
export function crossMetric(state: CubieCube, faces: FaceIdx[]): number {
  let best = 99;
  for (const f of faces) best = Math.min(best, crossDistOf(state, f));
  return best;
}

function crossDistOf(state: CubieCube, f: FaceIdx): number {
  return crossDist(f)[crossCoordOf(state, FACE_EDGES[f])];
}

/** Cross coordinate of four tracked edges in a state (ordered as `pieces`). */
export function crossCoordOf(state: CubieCube, pieces: readonly number[]): number {
  const at = (piece: number) => { const s = state.ep.indexOf(piece); return s * 2 + state.eo[s]; };
  return encodeCross(at(pieces[0]), at(pieces[1]), at(pieces[2]), at(pieces[3]));
}

// ── stage: xcross ────────────────────────────────────────────────────────────────────────────

const CANON_FRAME = { face: CANON_FACE, slot: CANON_SLOT } as const;

/** The canonical frame's coordinate of a state (which must already be in that frame). */
export function xcoordOf(state: CubieCube, d: XLike): XCoord {
  const eCoord = (piece: number) => { const s = state.ep.indexOf(piece); return s * 2 + state.eo[s]; };
  const cs = state.cp.indexOf(d.cornerPiece);
  return {
    cross: crossCoordOf(state, d.crossPieces),
    corner: cs * 3 + state.co[cs],
    edge: eCoord(d.edgePiece),
  };
}

/** Exact XCross length for one frame, or -1 when it exceeds `cap`. */
export function xcrossFrameDist(state: CubieCube, face: FaceIdx, slot: number, cap: number): number {
  const d = frameData(CANON_FRAME);
  return xcrossDistCapped(d, xcoordOf(rotateState(state, ROT_FOR_FRAME[face][slot]), d), cap);
}

/** Best XCross over the chosen frames, or -1 when every frame exceeds `cap`. */
export function xcrossMetric(state: CubieCube, faces: FaceIdx[], slot: number | 'best', cap: number): number {
  let best = -1;
  for (const f of faces) {
    const slots = slot === 'best' ? [0, 1, 2, 3] : [slot];
    for (const s of slots) {
      const v = xcrossFrameDist(state, f, s, best < 0 ? cap : best - 1);
      if (v >= 0 && (best < 0 || v < best)) best = v;
      if (best === 0) return 0;
    }
  }
  return best;
}

const sampleXcross = oneFrame((fr, lo, hi, rng, tries) => {
  // Exact + O(1) for the shallow layers, rejection above — and no wasted work, since the
  // canonical frame's answer is carried back to the requested frame by one relabel.
  const got = sampleXCoord(CANON_FRAME, lo, Math.min(hi, XCROSS_MAX_DEPTH), rng, tries);
  if (!got) return null;
  const d = frameData(CANON_FRAME);
  const state = fillState(...pinsOfXCoord(d, got.coord), rng);
  return { state: unrotate(state, ROT_FOR_FRAME[fr.face][fr.slots[0]]), depth: got.depth };
});

/** Cross edges + the tracked pair, as fill.ts pins (shared by xcross / pair / pseudo xcross). */
function pinsOfXCoord(d: XLike, coord: XCoord): [Pin[], Pin[]] {
  const cur = new Int8Array(4);
  decodeCross(coord.cross, cur);
  const edgePins: Pin[] = d.crossPieces.map((piece, k) => ({ piece, slot: cur[k] >> 1, ori: cur[k] & 1 }));
  edgePins.push({ piece: d.edgePiece, slot: coord.edge >> 1, ori: coord.edge & 1 });
  return [edgePins, [{ piece: d.cornerPiece, slot: (coord.corner / 3) | 0, ori: coord.corner % 3 }]];
}

// ── stage: EOCross ───────────────────────────────────────────────────────────────────────────

/**
 * A cross colour admits BOTH axes perpendicular to it, and the site takes the better of the two —
 * `EOCrossSolver::get_stats` measures each colour twice (the view, and the view after a y) and
 * folds the pair with a min. Pinning ZZ's own choice, `(face + 2) % 3`, made "EOCross, yellow"
 * mean something the rest of the site does not mean by it, and reproduced only 959 of the 1,344
 * columns in stats/scramble/comp_steps_eo (see cross_trainer_parity.test.ts).
 *
 * One table still serves everything: the canonical frame is D cross with the F/B axis, and
 * `rotForFaceAxis` carries any (colour, axis) onto it.
 */
/** The one EOCross frame every table here is built for: D cross, F/B orientation axis. */
export const CANON_EO_FRAME: EoFrame = { face: CANON_FACE, axis: 2 };

/** EOCross coordinate of a state, read in `d`'s own frame (no rotation applied). */
export function eoCoordOf(state: CubieCube, d: EoFrameData): EoCoord {
  const slots = new Int8Array(4);
  for (let k = 0; k < 4; k++) slots[k] = state.ep.indexOf(d.pieces[k]);
  let word = 0;
  for (let s = 0; s < 12; s++) word |= (state.eo[s] ^ d.delta[state.ep[s] * 12 + s]) << s;
  return { pos: slotRank(slots, 4), eo: word >> 1 }; // bit 0 is redundant (even parity)
}

/** Exact EOCross length for one (cross colour, orientation axis) frame, or -1 above `cap`. */
export function eoFrameDist(state: CubieCube, face: FaceIdx, axis: EoAxis, cap: number): number {
  const d = eoFrameData(CANON_EO_FRAME);
  return eoCrossDistCapped(d, eoCoordOf(rotateState(state, rotForFaceAxis(face, axis)), d), cap);
}

/**
 * EOCross draws in the canonical frame (one 24 MB table for all six colours) and rotates the
 * result onto the requested colour. It goes through `oneFrame` like every other stage, which is
 * what gives the colour-neutral rare end (EO solved + a cross already done = 0 moves) a
 * conditional draw instead of a hopeless global rejection.
 */
const sampleEo: Sampler = oneFrame((fr, lo, hi, rng) => {
  const got = sampleEoCrossState(CANON_EO_FRAME, lo, hi, rng);
  if (!got) return null;
  const rot = inverseRotation(rotForFaceAxis(fr.face, fr.axis!));
  return { state: rotateState(got.state, rot), depth: got.depth };
});

// ── stages: free pair / pseudo cross / pseudo xcross / pseudo pair ───────────────────────────

const CANON_PAIR: PairFrame = { face: CANON_FACE, slot: CANON_SLOT };
const CANON_PSEUDO_PAIR: PairFrame = { face: CANON_FACE, slot: CANON_SLOT, pseudo: true };

/** Exact length of an XCoord-shaped stage for one frame, evaluated in the canonical frame. */
const xLikeDist = (
  d: XLike, dist: (st: XCoord, cap: number) => number,
) => (state: CubieCube, fr: TrainerFrame, cap: number): number =>
  dist(xcoordOf(rotateState(state, ROT_FOR_FRAME[fr.face][fr.slots[0]]), d), cap);

const pairDistOf = (pseudo: boolean) => {
  const frame = pseudo ? CANON_PSEUDO_PAIR : CANON_PAIR;
  return (state: CubieCube, fr: TrainerFrame, cap: number) => {
    const d = pairFrameData(frame);
    return xLikeDist(d, (st, c) => pairDistCapped(d, st, c))(state, fr, cap);
  };
};

const samplePair = (pseudo: boolean): Sampler => oneFrame((fr, lo, hi, rng, tries) => {
  const frame = pseudo ? CANON_PSEUDO_PAIR : CANON_PAIR;
  const got = samplePairCoord(frame, lo, hi, rng, tries);
  if (!got) return null;
  const d = pairFrameData(frame);
  const { edgePins, cornerPins } = pairPins(d, got.coord);
  return {
    state: unrotate(fillState(edgePins, cornerPins, rng), ROT_FOR_FRAME[fr.face][fr.slots[0]]),
    depth: got.depth,
  };
});

/** Pseudo cross keeps its own per-colour table (190 KB) — no frame machinery needed. */
// The table is exact and complete, but the cap still has to be honoured: callers read -1 as
// "deeper than cap", and a stage that always answers breaks the multi-frame draw's tie-breaking.
const pseudoCrossDistOf = (state: CubieCube, fr: TrainerFrame, cap: number): number => {
  const v = pseudoCrossDist(fr.face)[crossCoordOf(state, FACE_EDGES[fr.face])];
  return v <= cap ? v : -1;
};

const samplePseudoCrossStage: Sampler = oneFrame((fr, lo, hi, rng) => {
  const got = samplePseudoCross(fr.face, lo, hi, rng);
  if (!got) return null;
  const { edgePins, cornerPins } = pseudoCrossPins(fr.face, got.coord);
  return { state: fillState(edgePins, cornerPins, rng), depth: got.depth };
});

const pseudoXDist = (state: CubieCube, fr: TrainerFrame, cap: number): number => {
  const d = pseudoXFrameData(CANON_FRAME);
  return xLikeDist(d, (st, c) => pseudoXcrossDistCapped(d, st, c))(state, fr, cap);
};

const samplePseudoXcross: Sampler = oneFrame((fr, lo, hi, rng, tries) => {
  const got = samplePseudoXCoord(CANON_FRAME, lo, hi, rng, tries);
  if (!got) return null;
  const { edgePins, cornerPins } = pseudoXcrossPins(pseudoXFrameData(CANON_FRAME), got.coord);
  return {
    state: unrotate(fillState(edgePins, cornerPins, rng), ROT_FOR_FRAME[fr.face][fr.slots[0]]),
    depth: got.depth,
  };
});

// ── stage: XCross + free pair ────────────────────────────────────────────────────────────────

/** Slot A (solved) and slot B (paired) are different roles, so all 12 ordered pairs are distinct
 *  frames — unlike XXCross, where the two slots are interchangeable. */
const XP_PAIRS: Array<[number, number]> = [
  [0, 1], [0, 2], [0, 3], [1, 0], [1, 2], [1, 3],
  [2, 0], [2, 1], [2, 3], [3, 0], [3, 1], [3, 2],
];
const xpFrames = ({ faces, slot }: ResolvedSpec): TrainerFrame[] =>
  faces.flatMap((face) => (slot === 'best' ? XP_PAIRS : [XP_PAIRS[slot] ?? XP_PAIRS[0]]).map((p) => ({ face, slots: [...p], ordered: true })));

/** Ordered pairs mean the canonical frame is reached by rotating slot A onto slot 0. */
const xpRotFor = (face: FaceIdx, pair: number[]): { rot: number; frame: XXFrame } => {
  const rot = ROT_FOR_FRAME[face][pair[0]];
  const other = canonSlotOf(ROTATIONS[rot].cMap[f2lSlots(face)[pair[1]].corner]);
  return { rot, frame: { face: CANON_FACE, slots: [CANON_SLOT, other] } };
};

const xpDist = (state: CubieCube, fr: TrainerFrame, cap: number): number => {
  const { rot, frame } = xpRotFor(fr.face, fr.slots);
  const d = xpairFrameData(frame);
  return xpairDistCapped(d, xxcoordOf(rotateState(state, rot), d), cap);
};

const sampleXpair: Sampler = oneFrame((fr, lo, hi, rng, tries) => {
  const { rot, frame } = xpRotFor(fr.face, fr.slots);
  const got = sampleXPairCoord(frame, lo, hi, rng, tries);
  if (!got) return null;
  const { edgePins, cornerPins } = xpairPins(xpairFrameData(frame), got.coord);
  return { state: unrotate(fillState(edgePins, cornerPins, rng), rot), depth: got.depth };
});

// ── stage: XXCross ───────────────────────────────────────────────────────────────────────────

/** Two canonical frames, because a slot PAIR has two shapes and the rotations cannot mix them. */
const CANON_XX_ADJACENT: XXFrame = { face: CANON_FACE, slots: [0, 1] };
const CANON_XX_DIAGONAL: XXFrame = { face: CANON_FACE, slots: [0, 2] };

const canonSlotOf = (corner: number): number => f2lSlots(CANON_FACE).findIndex((s) => s.corner === corner);

/**
 * The rotation taking (face, {s,t}) onto a canonical pair. Rotations preserve the cyclic order of
 * the four slots, so mapping one of the two slots onto slot 0 lands the other on 1 (adjacent),
 * 2 (diagonal) or 3 — and in the last case the other choice lands it on 1.
 */
function xxRotFor(face: FaceIdx, pair: number[]): { rot: number; frame: XXFrame } {
  const slots = f2lSlots(face);
  for (const [a, b] of [[pair[0], pair[1]], [pair[1], pair[0]]]) {
    const rot = ROT_FOR_FRAME[face][a];
    const other = canonSlotOf(ROTATIONS[rot].cMap[slots[b].corner]);
    if (other === 1) return { rot, frame: CANON_XX_ADJACENT };
    if (other === 2) return { rot, frame: CANON_XX_DIAGONAL };
  }
  throw new Error(`no canonical rotation for XXCross frame ${face}:${pair}`);
}

/** The canonical frame's XXCross coordinate of a state already in that frame. */
export function xxcoordOf(
  state: CubieCube, d: Pick<XXFrameData, 'crossPieces' | 'cornerPieces' | 'edgePieces'>,
): XXCoord {
  const e = (piece: number) => { const s = state.ep.indexOf(piece); return s * 2 + state.eo[s]; };
  const c = (piece: number) => { const s = state.cp.indexOf(piece); return s * 3 + state.co[s]; };
  return {
    cross: crossCoordOf(state, d.crossPieces),
    c0: c(d.cornerPieces[0]), c1: c(d.cornerPieces[1]),
    e0: e(d.edgePieces[0]), e1: e(d.edgePieces[1]),
  };
}

const xxDist = (state: CubieCube, fr: TrainerFrame, cap: number): number => {
  const { rot, frame } = xxRotFor(fr.face, fr.slots);
  const d = xxFrameData(frame);
  return xxcrossDistCapped(d, xxcoordOf(rotateState(state, rot), d), cap);
};

const sampleXxcross: Sampler = oneFrame((fr, lo, hi, rng, tries) => {
  const { rot, frame } = xxRotFor(fr.face, fr.slots);
  const got = sampleXXCoord(frame, lo, hi, rng, tries);
  if (!got) return null;
  const { edgePins, cornerPins } = xxcrossPins(xxFrameData(frame), got.coord);
  return { state: unrotate(fillState(edgePins, cornerPins, rng), rot), depth: got.depth };
});

// ── stages: pure EO / EOLine / 2×2×2 block ───────────────────────────────────────────────────

/**
 * A cross colour names a face, and orientation is measured against an axis — so a colour admits
 * the TWO axes perpendicular to it, and the site's metric (`solver/src/eoline_solver.rs`, and the
 * `eoline` columns of stats/scramble/distribution.json) is the better of the two. Not one axis:
 * that would be ZZ's own convention for a D cross, but it is not what the rest of the site means
 * by "EO, yellow".
 *
 * Consequences worth stating because the reach table shows them: one colour = 2 axes, an opposite
 * PAIR = the same 2 (opposite faces share an axis, hence share their perpendiculars), and four
 * colours already saturate all 3 — so the four- and six-colour rows of pure EO are identical.
 * The duplicates are dropped here rather than left to `oneFrame`'s tie-break: it would still be
 * correct (each state is awarded to the lowest-index frame achieving the minimum) but every
 * conditional draw from a duplicate frame is thrown away.
 */
const perpAxes = (face: FaceIdx): EoAxis[] =>
  ([0, 1, 2] as EoAxis[]).filter((a) => a !== (face % 3));

const axisFrames = ({ faces }: ResolvedSpec): TrainerFrame[] => {
  const seen = new Set<EoAxis>();
  const out: TrainerFrame[] = [];
  for (const face of faces) {
    for (const axis of perpAxes(face)) {
      if (seen.has(axis)) continue;
      seen.add(axis);
      out.push({ face, slots: [], axis, axisOnly: true });
    }
  }
  return out;
};

/**
 * The frames of a stage measured against an axis while still naming a cross face: every chosen
 * colour paired with each of its two perpendicular axes. Shared by EOCross and EOLine — for
 * EOLine the axis also picks WHICH line of the face (DF/DB vs DL/DR), for EOCross it is the
 * orientation axis alone. No deduplication here: unlike pure EO, these frames differ by face too.
 */
const perpFrames = ({ faces }: ResolvedSpec): TrainerFrame[] =>
  faces.flatMap((face) => perpAxes(face).map((axis) => ({ face, slots: [], axis })));

const sampleEoStage: Sampler = oneFrame((fr, lo, hi, rng) => sampleEoState(fr.axis!, lo, hi, rng));
const sampleEoLine: Sampler = oneFrame((fr, lo, hi, rng) => sampleEoLineState(fr.face, fr.axis!, lo, hi, rng));

/**
 * A block is named by (cross colour, F2L slot) — but each of the 8 blocks is reachable from each
 * of its three faces, so the 24 frames name 8 problems. Same deduplication, same reason as above;
 * note it also means two OPPOSITE colours already cover all eight blocks, which is why the two-,
 * four- and six-colour rows of this stage's reach table are identical.
 */
const blockFrames = ({ faces, slot }: ResolvedSpec): TrainerFrame[] => {
  const seen = new Set<number>();
  const out: TrainerFrame[] = [];
  for (const face of faces) {
    for (const s of slot === 'best' ? [0, 1, 2, 3] : [slot]) {
      const corner = f2lSlots(face)[s].corner;
      if (seen.has(corner)) continue;
      seen.add(corner);
      out.push({ face, slots: [s] });
    }
  }
  return out;
};

const blockDist = (state: CubieCube, fr: TrainerFrame, cap: number): number =>
  block222DistCapped(blockCoordOf(rotateState(state, ROT_FOR_FRAME[fr.face][fr.slots[0]])), cap);

const sampleBlock: Sampler = oneFrame((fr, lo, hi, rng) => {
  const got = sampleBlockState(lo, hi, rng);
  if (!got) return null;
  return { state: unrotate(got.state, ROT_FOR_FRAME[fr.face][fr.slots[0]]), depth: got.depth };
});

// ── registry ─────────────────────────────────────────────────────────────────────────────────

const STAGES: StageDef[] = [
  {
    variant: 'std', stage: 'cross', exactLayers: true,
    slots: false, range: [0, 8], band: [4, 6], heavy: false,
    sample: sampleCross,
    frames: faceFrames,
    // The cap is not decoration: engine B's tie-break reads -1 as "deeper than cap", and a
    // frameDist that always answers would reject every conditional draw.
    frameDist: (state, fr, cap) => { const v = crossDistOf(state, fr.face); return v <= cap ? v : -1; },
  },
  {
    variant: 'std', stage: 'xcross',
    slots: true, range: [0, XCROSS_MAX_DEPTH], band: [7, 8], heavy: true,
    sample: sampleXcross,
    frames: slotFrames,
    frameDist: (state, fr, cap) => xcrossFrameDist(state, fr.face, fr.slots[0], cap),
  },
  {
    // `range` is the stage's THEORETICAL span; what the slider offers and what it greys out
    // are reach.ts's business (depth 12 exists — 161 of the 1.27M xcross_2_col_10f corpus).
    variant: 'std', stage: 'xxcross',
    slots: true, range: [0, XXCROSS_MAX_DEPTH], band: [9, 10], heavy: true,
    sample: sampleXxcross,
    frames: pairFrames,
    frameDist: xxDist,
  },
  {
    variant: 'eo', stage: 'eo_cross', exactLayers: true,
    slots: false, range: [0, EOCROSS_MAX_DEPTH], band: [7, 8], heavy: true,
    sample: sampleEo,
    frames: perpFrames,
    frameDist: (state, fr, cap) => eoFrameDist(state, fr.face, fr.axis!, cap),
  },
  {
    // "Free pair": cross + the slot's pair BUILT but not necessarily inserted (or18's Pairing).
    variant: 'pair', stage: 'cross_pair',
    slots: true, range: [0, PAIR_MAX_DEPTH], band: [6, 7], heavy: true,
    sample: samplePair(false),
    frames: slotFrames,
    frameDist: pairDistOf(false),
  },
  {
    // or18's XCross Pairing: one slot solved, a second one paired up.
    variant: 'pair', stage: 'xcross_pair',
    slots: true, range: [0, XPAIR_MAX_DEPTH], band: [7, 8], heavy: true,
    sample: sampleXpair,
    frames: xpFrames,
    frameDist: xpDist,
  },
  {
    // Pseudo = the cross may sit D-rotated (a "wrong-AUF" cross that F2L still works from).
    variant: 'pseudo', stage: 'pseudo_cross', exactLayers: true,
    slots: false, range: [0, PSEUDO_CROSS_MAX_DEPTH], band: [4, 5], heavy: false,
    sample: samplePseudoCrossStage,
    frames: faceFrames,
    frameDist: pseudoCrossDistOf,
  },
  {
    variant: 'pseudo', stage: 'pseudo_xcross',
    slots: true, range: [0, PSEUDO_XCROSS_MAX_DEPTH], band: [7, 8], heavy: true,
    sample: samplePseudoXcross,
    frames: slotFrames,
    frameDist: pseudoXDist,
  },
  {
    variant: 'pseudo_pair', stage: 'pseudo_cross_pseudo_pair',
    slots: true, range: [0, PSEUDO_PAIR_MAX_DEPTH], band: [5, 6], heavy: true,
    sample: samplePair(true),
    frames: slotFrames,
    frameDist: pairDistOf(true),
  },
  // The three stages small enough to enumerate outright (./eoline, ./block): one BFS each, every
  // layer indexed, so a single frame draws any depth in microseconds and `range` is the true
  // diameter rather than a search bound.
  {
    variant: 'eoline', stage: 'eo', exactLayers: true,
    slots: false, range: [0, EO_MAX_DEPTH], band: [4, 5], heavy: false,
    sample: sampleEoStage,
    frames: axisFrames,
    frameDist: (state, fr, cap) => eoDistCapped(state, fr.axis!, cap),
  },
  {
    variant: 'eoline', stage: 'eoline', exactLayers: true,
    slots: false, range: [0, EOLINE_MAX_DEPTH], band: [6, 7], heavy: false,
    sample: sampleEoLine,
    frames: perpFrames,
    frameDist: (state, fr, cap) => eoLineDist(state, fr.face, fr.axis!, cap),
  },
  {
    // `slots` is on so or18's fixed semantics stay available (one colour, one named block); the
    // site's own metric is the best of a layer's four, which is what 'best' produces.
    variant: '222', stage: 'block222', exactLayers: true,
    slots: true, range: [0, BLOCK222_MAX_DEPTH], band: [5, 6], heavy: false,
    sample: sampleBlock,
    frames: blockFrames,
    frameDist: blockDist,
  },
];

const byKey = new Map(STAGES.map((s) => [`${s.variant}/${s.stage}`, s]));

/** Methods with at least one generatable stage, in the site's canonical order. */
export const trainerVariants = (): string[] => [...new Set(STAGES.map((s) => s.variant))];
/** Generatable stages of a method. */
export const trainerStagesOf = (variant: string): string[] =>
  STAGES.filter((s) => s.variant === variant).map((s) => s.stage);
/** Capabilities of a (method, stage), or null when we cannot generate it. */
export const trainerCaps = (variant: string, stage: string): TrainerCaps | null => {
  const d = byKey.get(`${variant}/${stage}`);
  return d ? { slots: d.slots, range: d.range, band: d.band, heavy: d.heavy } : null;
};
export const canTrain = (variant: string, stage: string): boolean => byKey.has(`${variant}/${stage}`);

// ── solving the case (what makes it a trainer and not just a scramble source) ────────────────

/** The state after move `m` (kociemba move index), using the same tables the coordinates do. */
export function applyMove(c: CubieCube, m: number): CubieCube {
  const ep = new Array<number>(12), eo = new Array<number>(12);
  const cp = new Array<number>(8), co = new Array<number>(8);
  const es = EDGE_STEP[m], cs = CORNER_STEP[m];
  for (let s = 0; s < 12; s++) {
    const t = es[s * 2];
    ep[t >> 1] = c.ep[s];
    eo[t >> 1] = c.eo[s] ^ (t & 1);
  }
  for (let s = 0; s < 8; s++) {
    const t = cs[s * 3];
    cp[(t / 3) | 0] = c.cp[s];
    co[(t / 3) | 0] = (c.co[s] + (t % 3)) % 3;
  }
  return { cp, co, ep, eo };
}

export interface TrainerSolution {
  /** The frame it solves — with colour neutrality that is the winning colour/slot. */
  frame: TrainerFrame;
  /** Optimal move sequence, in kociemba move indices. */
  moves: number[];
  notation: string;
}

/**
 * One optimal solution of the stage for `state`, plus which frame it solves.
 * Descends the frame's own exact distance, so the result is optimal by construction — there is
 * no search to get wrong, and a colour-neutral case is answered for the colour that actually won.
 */
export function trainerSolution(spec: TrainerSpec, state: CubieCube): TrainerSolution | null {
  const def = byKey.get(`${spec.variant}/${spec.stage}`);
  if (!def) return null;
  const resolved = resolve(spec, def);
  if (!resolved) return null;
  const frames = def.frames(resolved);
  const cap = def.range[1];
  let best: TrainerFrame | null = null;
  let depth = cap + 1;
  for (const fr of frames) {
    const v = def.frameDist(state, fr, Math.min(cap, depth - 1));
    if (v >= 0 && v < depth) { depth = v; best = fr; }
  }
  if (!best) return null;
  const moves: number[] = [];
  let cur = state;
  while (depth > 0) {
    let next: CubieCube | null = null;
    for (let m = 0; m < N_MOVES; m++) {
      const child = applyMove(cur, m);
      if (def.frameDist(child, best, depth - 1) === depth - 1) { moves.push(m); next = child; break; }
    }
    if (!next) return null; // an exact distance always has a descending move; guard anyway
    cur = next;
    depth--;
  }
  return { frame: best, moves, notation: moves.map((m) => MOVE_NAMES[m]).join(' ') };
}

/**
 * Human name of a frame: the cross colour, plus the slot(s) when the stage pairs any and the axis
 * when the stage measures orientation. Pure EO is the one frame with no colour in it at all — the
 * colours that were picked only chose which axes to try, and naming one of them would suggest the
 * answer depends on a face it does not depend on.
 */
export function frameLabel(frame: TrainerFrame, isZh: boolean): string {
  const axis = frame.axis === undefined ? '' : AXIS_LABEL[frame.axis];
  if (frame.axisOnly) return axis;
  const color = FACE_COLOR[frame.face];
  const name = isZh ? COLOR_ZH[color] : color;
  if (axis) return `${name} ${axis}`;
  if (!frame.slots.length) return name;
  const names = slotNamesOf(frame.face);
  return `${name} ${frame.slots.map((s) => names[s]).join(frame.ordered ? '→' : '+')}`;
}

/** EO axes, in ./eo's numbering. */
const AXIS_LABEL = ['U/D', 'R/L', 'F/B'];

const COLOR_ZH: Record<string, string> = {
  White: '白', Yellow: '黄', Green: '绿', Blue: '蓝', Red: '红', Orange: '橙',
};

/** Stable identity of a spec — the scramble pool's buffer key. */
export const trainerSpecKey = (s: TrainerSpec): string =>
  `${s.variant}/${s.stage}|${[...s.colors].sort().join('')}|${s.slot}|${s.lo}.${s.hi}`;

/**
 * A uniformly random cube state whose `stage` metric falls in [lo,hi], plus the metric value.
 * Returns null when the combination is unreachable or the rejection budget ran out — callers
 * must show that honestly rather than substitute an unfiltered scramble.
 */
export function sampleTrainerState(
  spec: TrainerSpec, rng: () => number = Math.random, budgetMs = REJECT_BUDGET_MS,
): Sampled | null {
  const got = drawTrainerState(spec, rng, budgetMs);
  return got.ok ? { state: got.state, depth: got.depth } : null;
}

/**
 * Same draw, but says WHY it failed. `empty` is a proof that no cube has this difficulty;
 * `budget` only means this attempt ran out of time (cold tables, a rare window, a busy phone) —
 * callers must retry rather than tell the user the combination does not exist.
 */
export function drawTrainerState(
  spec: TrainerSpec, rng: () => number = Math.random, budgetMs = REJECT_BUDGET_MS,
): DrawOutcome {
  const def = byKey.get(`${spec.variant}/${spec.stage}`);
  if (!def) return { ok: false, reason: 'empty' };
  const resolved = resolve(spec, def, budgetMs);
  if (!resolved) return { ok: false, reason: 'empty' };
  // A window pinned to ONE depth that happens to be an enumerated class: serve it from the list.
  // Those are the difficulties no sampler reaches — six-colour cross at 8 is 40 states in 9.8e11 —
  // so this is not an optimisation, it is the only way they come out at all. Deliberately limited
  // to lo === hi: over a wider window the true conditional gives the deep end a weight of ~1e-11,
  // and honouring that (i.e. never producing it) is correct — asking for it means asking for it
  // alone, which is exactly what dragging both slider handles onto that tick does.
  if (resolved.lo === resolved.hi) {
    // `resolve` parks a slotless stage's slot at 0; that is a placeholder, not "the fixed slot",
    // and passing it through would look up a fixed-slot class that cross does not have.
    const state = drawCorpus(
      spec.variant, spec.stage, resolved.faces, def.slots ? resolved.slot : 'best', resolved.lo, rng,
    );
    if (state) return { ok: true, state, depth: resolved.lo };
  }
  const got = def.sample(resolved, rng, def);
  return got ? { ok: true, state: got.state, depth: got.depth } : { ok: false, reason: resolved.fail.reason };
}

/**
 * Monte-Carlo histogram of a spec's metric over uniform cubes — how often each optimal length
 * turns up naturally. This is what says "six-colour cross never needs 8 moves" or "best-slot
 * XCross tops out around 9", i.e. where the slider should stop; the generator itself can reach
 * the rare LOW end that this histogram will never show (that is engine B's job).
 * The last bin counts states deeper than the stage's declared range.
 */
export function trainerMetric(spec: TrainerSpec, samples: number, rng: () => number = Math.random): number[] {
  const def = byKey.get(`${spec.variant}/${spec.stage}`);
  if (!def) return [];
  const resolved = resolve(spec, def);
  if (!resolved) return [];
  const frames = def.frames({ ...resolved, lo: def.range[0], hi: def.range[1] });
  const hist = new Array<number>(def.range[1] + 2).fill(0);
  for (let i = 0; i < samples; i++) {
    const best = bestOverFrames(def, frames, fillState([], [], rng));
    hist[best >= 0 ? best : hist.length - 1]++;
  }
  return hist;
}

/**
 * The stage's difficulty of a given state: the best over the spec's frames, which is what the
 * site means by "EO, yellow" or "XCross, six-colour". -1 when the stage is unknown or every frame
 * exceeds its own range (which cannot happen for a legal cube).
 *
 * This is the read-only half of the generator, and the tests use it to hold the whole thing to the
 * site's Rust engine: run it over real WCA scrambles and it must reproduce
 * `stats/scramble/comp_steps*` column for column.
 */
export function stageMetric(
  variant: string, stage: string, state: CubieCube, colors: string, slot: number | 'best' = 'best',
): number {
  const def = byKey.get(`${variant}/${stage}`);
  if (!def) return -1;
  const resolved = resolve({ variant, stage, colors, slot, lo: 0, hi: def.range[1] }, def);
  return resolved ? bestOverFrames(def, def.frames(resolved), state) : -1;
}

function bestOverFrames(def: StageDef, frames: TrainerFrame[], state: CubieCube): number {
  let best = -1;
  for (const fr of frames) {
    // Each frame is asked only whether it beats the running best, so the deep frames stop early.
    const v = def.frameDist(state, fr, best < 0 ? def.range[1] : best - 1);
    if (v >= 0 && (best < 0 || v < best)) best = v;
    if (best === 0) break;
  }
  return best;
}

/** Clamp a spec into what the stage can actually do; null when nothing is left. */
function resolve(spec: TrainerSpec, def: StageDef, budgetMs = REJECT_BUDGET_MS): ResolvedSpec | null {
  const faces = facesOfSubset(spec.colors);
  if (!faces.length) return null;
  const [rLo, rHi] = def.range;
  const lo = Math.max(spec.lo, rLo), hi = Math.min(spec.hi, rHi);
  if (lo > hi) return null;
  const nSlots = slotOptionCount(def);
  const slot = def.slots
    ? (spec.slot === 'best' ? 'best' : Math.min(Math.max(spec.slot, 0), nSlots - 1))
    : 0;
  return { faces, slot, lo, hi, budgetMs, fail: { reason: 'budget' } };
}

const slotOptionCount = (def: StageDef): number => (
  def.stage === 'xxcross' ? XX_PAIRS.length : def.stage === 'xcross_pair' ? XP_PAIRS.length : 4);

/** Slot picker options for a (stage, cross colour) — pair names for XXCross, single otherwise. */
export function trainerSlotOptions(variant: string, stage: string, face: FaceIdx): string[] {
  const def = byKey.get(`${variant}/${stage}`);
  if (!def?.slots) return [];
  const names = slotNamesOf(face);
  if (def.stage === 'xxcross') return XX_PAIRS.map(([a, b]) => `${names[a]}+${names[b]}`);
  // XCross-pair: the first slot is the SOLVED one, the second is only paired up.
  if (def.stage === 'xcross_pair') return XP_PAIRS.map(([a, b]) => `${names[a]}→${names[b]}`);
  return names;
}
