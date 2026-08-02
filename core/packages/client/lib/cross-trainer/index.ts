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

import type { CubieCube } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';
import {
  COLOR_FACE, CORNER_STEP, EDGE_STEP, FACE_COLOR, FACE_EDGES, MOVE_NAMES, N_MOVES,
  f2lSlots, slotRank, type FaceIdx,
} from './model';
import {
  EOCROSS_MAX_DEPTH, defaultEoAxis, eoCrossDistCapped, eoFrameData, sampleEoCrossState,
  type EoCoord, type EoFrame, type EoFrameData,
} from './eo';
import { crossDist, decodeCross, encodeCross } from './dist';
import { sampleCrossState } from './sample';
import { fillState, type Pin } from './fill';
import {
  frameData, sampleXCoord, xcrossDistCapped, XCROSS_MAX_DEPTH,
  type XCoord,
} from './xcross';
import {
  PAIR_MAX_DEPTH, PSEUDO_PAIR_MAX_DEPTH, pairDistCapped, pairFrameData, pairPins, samplePairCoord,
  type PairFrame,
} from './pair';
import {
  PSEUDO_CROSS_MAX_DEPTH, PSEUDO_XCROSS_PRACTICAL_MAX, XXCROSS_PRACTICAL_MAX,
  pseudoCrossDist, pseudoCrossPins, pseudoXFrameData, pseudoXcrossDistCapped, pseudoXcrossPins,
  samplePseudoCross, samplePseudoXCoord, sampleXXCoord, xxFrameData, xxcrossDistCapped, xxcrossPins,
  type XXCoord, type XXFrame, type XXFrameData,
} from './multi';
import {
  XPAIR_MAX_DEPTH, sampleXPairCoord, xpairDistCapped, xpairFrameData, xpairPins,
} from './xpair';
import { CANON_FACE, CANON_SLOT, ROTATIONS, ROT_FOR_FRAME, inverseRotation, rotForFaceAxis, rotateState } from './rotate';

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
}

type Sampler = (spec: ResolvedSpec, rng: () => number, def: StageDef) => Sampled | null;
interface StageDef extends TrainerCaps {
  variant: string;
  stage: string;
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
 * Wrap a single-frame exact sampler: one frame → that sampler; several (colour neutral, best
 * slot) → rejection on uniform cubes, because the frames of one cube are dependent and there is
 * no layer left to enumerate. The budget is a wall clock, not a try count: a deep XXCross draw
 * costs milliseconds, and 300k of those would hang the worker instead of reporting "unreachable".
 */
const REJECT_BUDGET_MS = 8000;
function oneFrame(
  sampleFrame: (frame: TrainerFrame, lo: number, hi: number, rng: () => number) => Sampled | null,
): Sampler {
  return (spec, rng, def) => {
    const frames = def.frames(spec);
    if (frames.length === 1) return sampleFrame(frames[0], spec.lo, spec.hi, rng);
    const deadline = Date.now() + REJECT_BUDGET_MS;
    for (let t = 0; t < 300000; t++) {
      const state = fillState([], [], rng);
      let best = -1;
      for (const fr of frames) {
        const v = def.frameDist(state, fr, best < 0 ? spec.hi : best - 1);
        if (v >= 0 && (best < 0 || v < best)) best = v;
        if (best === 0) break;
      }
      if (best >= spec.lo) return { state, depth: best };
      if ((t & 63) === 63 && Date.now() > deadline) break;
    }
    return null;
  };
}

/** Carry a state generated in the canonical frame back to the frame the user asked for. */
const unrotate = (state: CubieCube, rot: number): CubieCube => rotateState(state, inverseRotation(rot));

// ── stage: cross ─────────────────────────────────────────────────────────────────────────────

const sampleCross: Sampler = ({ faces, lo, hi }, rng) => {
  const state = sampleCrossState({ faces, lo, hi }, rng);
  if (!state) return null;
  // The requested depth IS the metric here (sampleCrossState is exact), so re-derive it
  // rather than trusting the window: a one-colour draw returns some depth inside [lo,hi].
  return { state, depth: crossMetric(state, faces) };
};

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

const sampleXcross = oneFrame((fr, lo, hi, rng) => {
  // Exact + O(1) for the shallow layers, rejection above — and no wasted work, since the
  // canonical frame's answer is carried back to the requested frame by one relabel.
  const got = sampleXCoord(CANON_FRAME, lo, Math.min(hi, XCROSS_MAX_DEPTH), rng);
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

/** ZZ convention: edges oriented against the axis perpendicular to the cross, F/B for a D cross. */
const CANON_EO_FRAME: EoFrame = { face: CANON_FACE, axis: 2 };
const rotForEo = (f: FaceIdx): number => rotForFaceAxis(f, defaultEoAxis(f));

/** EOCross coordinate of a state, read in `d`'s own frame (no rotation applied). */
export function eoCoordOf(state: CubieCube, d: EoFrameData): EoCoord {
  const slots = new Int8Array(4);
  for (let k = 0; k < 4; k++) slots[k] = state.ep.indexOf(d.pieces[k]);
  let word = 0;
  for (let s = 0; s < 12; s++) word |= (state.eo[s] ^ d.delta[state.ep[s] * 12 + s]) << s;
  return { pos: slotRank(slots, 4), eo: word >> 1 }; // bit 0 is redundant (even parity)
}

/** Exact EOCross length for one cross colour, or -1 above `cap`. */
export function eoFrameDist(state: CubieCube, face: FaceIdx, cap: number): number {
  const d = eoFrameData(CANON_EO_FRAME);
  return eoCrossDistCapped(d, eoCoordOf(rotateState(state, rotForEo(face)), d), cap);
}

const sampleEo: Sampler = ({ faces, lo, hi }, rng) => {
  if (faces.length === 1) {
    const got = sampleEoCrossState(CANON_EO_FRAME, lo, hi, rng);
    if (!got) return null;
    return { state: rotateState(got.state, inverseRotation(rotForEo(faces[0]))), depth: got.depth };
  }
  for (let t = 0; t < 300000; t++) {
    const state = fillState([], [], rng);
    let best = -1;
    for (const f of faces) {
      const v = eoFrameDist(state, f, best < 0 ? hi : best - 1);
      if (v >= 0 && (best < 0 || v < best)) best = v;
      if (best === 0) break;
    }
    if (best >= lo) return { state, depth: best };
  }
  return null;
};

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

const samplePair = (pseudo: boolean): Sampler => oneFrame((fr, lo, hi, rng) => {
  const frame = pseudo ? CANON_PSEUDO_PAIR : CANON_PAIR;
  const got = samplePairCoord(frame, lo, hi, rng);
  if (!got) return null;
  const d = pairFrameData(frame);
  const { edgePins, cornerPins } = pairPins(d, got.coord);
  return {
    state: unrotate(fillState(edgePins, cornerPins, rng), ROT_FOR_FRAME[fr.face][fr.slots[0]]),
    depth: got.depth,
  };
});

/** Pseudo cross keeps its own per-colour table (190 KB) — no frame machinery needed. */
const pseudoCrossDistOf = (state: CubieCube, fr: TrainerFrame): number =>
  pseudoCrossDist(fr.face)[crossCoordOf(state, FACE_EDGES[fr.face])];

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

const samplePseudoXcross: Sampler = oneFrame((fr, lo, hi, rng) => {
  const got = samplePseudoXCoord(CANON_FRAME, lo, hi, rng);
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

const sampleXpair: Sampler = oneFrame((fr, lo, hi, rng) => {
  const { rot, frame } = xpRotFor(fr.face, fr.slots);
  const got = sampleXPairCoord(frame, lo, hi, rng);
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

const sampleXxcross: Sampler = oneFrame((fr, lo, hi, rng) => {
  const { rot, frame } = xxRotFor(fr.face, fr.slots);
  const got = sampleXXCoord(frame, lo, Math.min(hi, XXCROSS_PRACTICAL_MAX), rng);
  if (!got) return null;
  const { edgePins, cornerPins } = xxcrossPins(xxFrameData(frame), got.coord);
  return { state: unrotate(fillState(edgePins, cornerPins, rng), rot), depth: got.depth };
});

// ── registry ─────────────────────────────────────────────────────────────────────────────────

const STAGES: StageDef[] = [
  {
    variant: 'std', stage: 'cross',
    slots: false, range: [0, 8], band: [4, 6], heavy: false,
    sample: sampleCross,
    frames: faceFrames,
    frameDist: (state, fr) => crossDistOf(state, fr.face),
  },
  {
    variant: 'std', stage: 'xcross',
    slots: true, range: [0, XCROSS_MAX_DEPTH], band: [7, 8], heavy: true,
    sample: sampleXcross,
    frames: slotFrames,
    frameDist: (state, fr, cap) => xcrossFrameDist(state, fr.face, fr.slots[0], cap),
  },
  {
    // or18's XXCross. Depth 12 exists (p ≈ 1e-4, ~30 s to hit) and 13 is unreachable by
    // rejection, so the slider stops at the deepest one we can actually deliver.
    variant: 'std', stage: 'xxcross',
    slots: true, range: [0, XXCROSS_PRACTICAL_MAX], band: [9, 10], heavy: true,
    sample: sampleXxcross,
    frames: pairFrames,
    frameDist: xxDist,
  },
  {
    variant: 'eo', stage: 'eo_cross',
    slots: false, range: [0, EOCROSS_MAX_DEPTH], band: [7, 8], heavy: true,
    sample: sampleEo,
    frames: faceFrames,
    frameDist: (state, fr, cap) => eoFrameDist(state, fr.face, cap),
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
    variant: 'pseudo', stage: 'pseudo_cross',
    slots: false, range: [0, PSEUDO_CROSS_MAX_DEPTH], band: [4, 5], heavy: false,
    sample: samplePseudoCrossStage,
    frames: faceFrames,
    frameDist: pseudoCrossDistOf,
  },
  {
    variant: 'pseudo', stage: 'pseudo_xcross',
    slots: true, range: [0, PSEUDO_XCROSS_PRACTICAL_MAX], band: [7, 8], heavy: true,
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

/** Human name of a frame: the cross colour, plus the slot(s) when the stage pairs any. */
export function frameLabel(frame: TrainerFrame, isZh: boolean): string {
  const color = FACE_COLOR[frame.face];
  const name = isZh ? COLOR_ZH[color] : color;
  if (!frame.slots.length) return name;
  const names = slotNamesOf(frame.face);
  return `${name} ${frame.slots.map((s) => names[s]).join(frame.ordered ? '→' : '+')}`;
}

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
export function sampleTrainerState(spec: TrainerSpec, rng: () => number = Math.random): Sampled | null {
  const def = byKey.get(`${spec.variant}/${spec.stage}`);
  if (!def) return null;
  const resolved = resolve(spec, def);
  return resolved ? def.sample(resolved, rng, def) : null;
}

/** Clamp a spec into what the stage can actually do; null when nothing is left. */
function resolve(spec: TrainerSpec, def: StageDef): ResolvedSpec | null {
  const faces = facesOfSubset(spec.colors);
  if (!faces.length) return null;
  const [rLo, rHi] = def.range;
  const lo = Math.max(spec.lo, rLo), hi = Math.min(spec.hi, rHi);
  if (lo > hi) return null;
  const nSlots = slotOptionCount(def);
  const slot = def.slots
    ? (spec.slot === 'best' ? 'best' : Math.min(Math.max(spec.slot, 0), nSlots - 1))
    : 0;
  return { faces, slot, lo, hi };
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
