/**
 * Per-stage CFOP segmentation for post-solve reconstruction.
 *
 * Walks the recorded move stream from the scrambled state, applying each move
 * to a 3x3 face model and recording the timestamp at which the cube *first*
 * reaches Cross / F2L / OLL / Solved. Used by ReconstructModal to split a
 * solve's elapsed time into stage durations and per-stage TPS.
 *
 * In addition to durations and HTM counts, snapshots the cube state at the
 * moment each stage is first completed and runs the exact OLL/PLL recognizer
 * to attach a case label to the OLL/PLL stages. Cross-side is best-effort:
 * we inspect which of the 6 faces happened to have its 4 edges + matching
 * adjacent centers at cross-done time.
 *
 * Edge cases handled:
 *   - empty move stream (manual entry without smartcube data) → returns null,
 *     letting the modal hide the panel.
 *   - the cube goes backward (user undoes cross) — first-reach wins; we never
 *     overwrite an already-set stage timestamp.
 *   - DNF / mid-solve abort — only stages that were actually reached get a
 *     non-null timestamp; later stages stay null.
 *   - unparseable / wide-shorthand / rotation tokens are tolerated and applied
 *     where possible; tokens the parser can't make sense of are silently
 *     skipped rather than crashing.
 *   - recognizers returning null (unrecognized state) → the case label stays
 *     null and renders as omitted in the UI.
 */

import type { Face } from '@cuberoot/puzzle-solvers/cube-moves';
import ollData from '../../data/oll.json';
import { applyOneToken } from './reconstruct/apply-token';
import { detectCfopStage, stageRank, type CfopStage } from './reconstruct/cfop-detect';
import { recognizeOllExact, recognizePllExact } from './reconstruct/cfop-recognize';
import { htmMoves } from './reconstruct/htm';
import { normalizeSolve } from './reconstruct/orient';
import { applyScramble, solved, type CubeFaces, type FaceArr } from './reconstruct/state';
import type { SolveMove, StageSegments } from './stage-segments';
import type { EventId, Solve } from './types';

export type { StageSegments } from './stage-segments';

/**
 * Events where a CFOP segmentation means anything. Single source for everyone
 * who decides whether to run the walk: the solve recorder (attaches segments
 * as the solve lands) and the re-analysis migration (backfills old solves).
 * Keep them in agreement or history and fresh solves disagree about which
 * events carry stage data.
 */
export const STAGE_SEGMENT_EVENTS: ReadonlySet<EventId> = new Set<EventId>([
  '333', '333oh', '333fm', '333mr', 'cross', 'f2l', 'll', 'oll', 'pll',
  'coll', 'cmll', 'zbll', 'eg1', 'eg2', 'custom',
]);

const ROTATION_FAMILIES = new Set(['x', 'y', 'z', 'X', 'Y', 'Z']);
const SLICE_FAMILIES = new Set(['M', 'E', 'S']);

function isFaceTurnToken(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  const head = t[0];
  if (ROTATION_FAMILIES.has(head)) return false;
  if (SLICE_FAMILIES.has(head)) return false;
  return true;
}

/**
 * The one tolerant token-application in the reconstruct layer. It moved to
 * `./reconstruct/apply-token.ts` to break a dependency cycle (orient.ts needs it and
 * this file needs orient.ts); re-exported here so the walkers that already
 * import it from this module keep working.
 */
export { applyOneToken };

function cloneFaces(f: CubeFaces): CubeFaces {
  return {
    U: f.U.slice(), D: f.D.slice(), F: f.F.slice(),
    B: f.B.slice(), L: f.L.slice(), R: f.R.slice(),
  };
}

/**
 * Best-effort cross-side detection: for each of the 6 faces, check whether
 * the 4 edge stickers on that face match its center, AND each of the 4
 * adjacent side stickers matches that side's center. Returns the first
 * matching face label (e.g. "D-cross") or null.
 *
 * Edge layout per face (row-major 3x3): edges are at indices 1, 3, 5, 7.
 * The adjacent sticker on each neighbour is captured by the tables below.
 */
interface CrossSpec {
  /** Face whose center color the cross lives on. */
  face: Face;
  /** 4 (neighbour-face, neighbour-sticker-index) pairs — the side stickers
   *  next to each of the 4 cross edges. Must match the neighbour's center. */
  sides: Array<{ side: Face; idx: number }>;
}

const CROSS_SPECS: CrossSpec[] = [
  // D-cross: D edges 1/3/5/7 (DF, DL, DR, DB); side stickers F[7] R[7] B[7] L[7].
  {
    face: 'D',
    sides: [
      { side: 'F', idx: 7 },
      { side: 'L', idx: 7 },
      { side: 'R', idx: 7 },
      { side: 'B', idx: 7 },
    ],
  },
  // U-cross: U edges 1/3/5/7; side stickers on the top rows of F/R/B/L (idx 1).
  {
    face: 'U',
    sides: [
      { side: 'F', idx: 1 },
      { side: 'L', idx: 1 },
      { side: 'R', idx: 1 },
      { side: 'B', idx: 1 },
    ],
  },
  // F-cross: F edges 1/3/5/7; neighbours U[7], L[5], R[3], D[1].
  {
    face: 'F',
    sides: [
      { side: 'U', idx: 7 },
      { side: 'L', idx: 5 },
      { side: 'R', idx: 3 },
      { side: 'D', idx: 1 },
    ],
  },
  // B-cross: B edges 1/3/5/7; neighbours U[1], R[5], L[3], D[7].
  {
    face: 'B',
    sides: [
      { side: 'U', idx: 1 },
      { side: 'R', idx: 5 },
      { side: 'L', idx: 3 },
      { side: 'D', idx: 7 },
    ],
  },
  // L-cross: L edges 1/3/5/7; neighbours U[3], B[5], F[3], D[3].
  {
    face: 'L',
    sides: [
      { side: 'U', idx: 3 },
      { side: 'B', idx: 5 },
      { side: 'F', idx: 3 },
      { side: 'D', idx: 3 },
    ],
  },
  // R-cross: R edges 1/3/5/7; neighbours U[5], F[5], B[3], D[5].
  {
    face: 'R',
    sides: [
      { side: 'U', idx: 5 },
      { side: 'F', idx: 5 },
      { side: 'B', idx: 3 },
      { side: 'D', idx: 5 },
    ],
  },
];

function detectCrossSide(state: CubeFaces): string | null {
  for (const spec of CROSS_SPECS) {
    const face: FaceArr = state[spec.face];
    const center = face[4];
    if (face[1] !== center || face[3] !== center || face[5] !== center || face[7] !== center) continue;
    let ok = true;
    for (const s of spec.sides) {
      const nbr = state[s.side];
      if (nbr[s.idx] !== nbr[4]) { ok = false; break; }
    }
    if (ok) return `${spec.face}-cross`;
  }
  return null;
}

/** Compact OLL label like "OLL 21 (H)" or "OLL skip"; null on no match. */
function formatOllCase(state: CubeFaces): string | null {
  try {
    const r = recognizeOllExact(state);
    if (!r) return null;
    if (r.case === 'skip') return 'OLL skip';
    const meta = (ollData as Record<string, { name?: string }>)[r.case];
    const name = meta?.name ? ` (${meta.name})` : '';
    return `${r.case}${name}`;
  } catch {
    return null;
  }
}

/** Compact PLL label like "PLL T" or "PLL skip"; null on no match. */
function formatPllCase(state: CubeFaces): string | null {
  try {
    const r = recognizePllExact(state);
    if (!r) return null;
    if (r.case === 'skip') return 'PLL skip';
    return `PLL ${r.case}`;
  } catch {
    return null;
  }
}

export function computeStageSegments(
  scrambleIn: string,
  movesIn: SolveMove[],
  totalMs: number,
): StageSegments | null {
  if (!movesIn || movesIn.length === 0) return null;

  // Everything below reads the D face — `isCross`, `isF2l`, the OLL/PLL
  // recognizers. A smart cube reports turns in its OWN colour frame (white is
  // always U), so a white cross solved with white DOWN lands on U and none of
  // it fires until the last move, when the solved cube satisfies every stage
  // at once. Rotate the whole problem so the cross is on D first; the token
  // rewrite is 1:1, so every index below still points into the caller's array.
  // Idempotent — a solve already in the standard frame passes through untouched.
  const norm = normalizeSolve(scrambleIn, movesIn);
  const scramble = norm.scramble;
  const moves = norm.moves;

  // Build the scrambled starting state. If parsing the scramble itself fails,
  // we fall back to a solved cube so we at least produce something — though
  // in that case nothing will ever read 'cross' on the way through.
  let state: CubeFaces;
  try {
    state = applyScramble(3, scramble);
  } catch {
    state = solved(3);
  }

  let crossDoneMs: number | null = null;
  let f2lDoneMs: number | null = null;
  let ollDoneMs: number | null = null;
  let solvedMs: number | null = null;
  let crossEndIdx: number | null = null;
  let f2lEndIdx: number | null = null;
  let ollEndIdx: number | null = null;
  let solvedEndIdx: number | null = null;

  // HTM counts per stage. We accumulate into the *current* stage at the time
  // the move is executed (the move that *completes* a stage counts toward the
  // stage being completed, matching how a solver would report it).
  let crossHtm = 0;
  let f2lHtm = 0;
  let ollHtm = 0;
  let pllHtm = 0;

  let lastReached: CfopStage = 'scrambled';

  // State snapshots at the moment each stage is first completed. Used for
  // exact case recognition after the walk.
  let crossDoneState: CubeFaces | null = null;
  let f2lDoneState: CubeFaces | null = null;
  let ollDoneState: CubeFaces | null = null;

  // A real cube reports quarter turns only, so a double turn arrives as two
  // notifications; HTM has to count it once. `htmMoves` merges each run of
  // same-face turns, and a move is accounted where its FIRST quarter turn was
  // made — the stage the cuber was still working on when they started it.
  // A run that cancels starts no counted move at all (see htm.ts).
  const startsCountedMove = new Array<boolean>(moves.length).fill(false);
  for (const h of htmMoves(moves)) startsCountedMove[h.startIdx] = true;

  for (let i = 0; i < moves.length; i++) {
    const mv = moves[i];
    const wasFace = isFaceTurnToken(mv.m) && startsCountedMove[i];
    state = applyOneToken(state, mv.m);
    const stage = detectCfopStage(state);

    // Account this move's HTM to whichever phase we are *currently working on*.
    // While 'scrambled' or 'cross' is the highest reached, we're solving cross.
    // After cross is reached we're working on F2L, etc.
    if (wasFace) {
      const r = stageRank(lastReached);
      if (r <= stageRank('scrambled')) crossHtm += 1;          // working on cross
      else if (r === stageRank('cross')) f2lHtm += 1;          // working on F2L
      else if (r === stageRank('f2l')) ollHtm += 1;            // working on OLL
      else pllHtm += 1;                                        // working on PLL
    }

    // First-reach wins for each stage timestamp. Backfill earlier stages too
    // (e.g. a cross-into-XCross can jump scrambled → f2l in one move).
    const newRank = stageRank(stage);
    if (newRank >= stageRank('cross') && crossDoneMs === null) {
      crossDoneMs = mv.ts;
      crossEndIdx = i;
      crossDoneState = cloneFaces(state);
    }
    if (newRank >= stageRank('f2l')   && f2lDoneMs   === null) {
      f2lDoneMs   = mv.ts;
      f2lEndIdx   = i;
      f2lDoneState = cloneFaces(state);
    }
    if (newRank >= stageRank('oll')   && ollDoneMs   === null) {
      ollDoneMs   = mv.ts;
      ollEndIdx   = i;
      ollDoneState = cloneFaces(state);
    }
    if (newRank >= stageRank('pll')   && solvedMs    === null) {
      solvedMs     = mv.ts;
      solvedEndIdx = i;
    }

    if (newRank > stageRank(lastReached)) {
      lastReached = stage;
    }
  }

  // If the move stream finishes exactly with the cube solved but the last
  // recorded timestamp is slightly before totalMs, prefer totalMs as the
  // canonical end so segment widths sum to the whole solve.
  if (solvedMs !== null && totalMs > solvedMs) {
    solvedMs = totalMs;
  }

  // Per-stage durations. "Cross" is timed from solve start (ts=0), not from
  // the first move — first-move latency is already shown elsewhere in the
  // modal but is part of the cross phase from the solver's perspective.
  const crossMs = crossDoneMs !== null ? Math.max(0, crossDoneMs) : null;
  const f2lMs   = f2lDoneMs   !== null && crossDoneMs !== null
    ? Math.max(0, f2lDoneMs - crossDoneMs)
    : null;
  const ollMs   = ollDoneMs   !== null && f2lDoneMs   !== null
    ? Math.max(0, ollDoneMs - f2lDoneMs)
    : null;
  const pllMs   = solvedMs    !== null && ollDoneMs   !== null
    ? Math.max(0, solvedMs - ollDoneMs)
    : null;

  // Case recognition on the snapshotted states. F2L-done state → OLL case;
  // OLL-done state → PLL case.
  //
  // Cross side comes from the normalization instead of from `detectCrossSide`
  // on the snapshot: the snapshot is taken in the ROTATED frame, where the
  // cross is on D by construction, so scanning it could only ever answer
  // "D-cross". (It could only ever answer that before the rotation existed
  // either — the snapshot was taken when `isCross(D)` first held.) The
  // normalizer knows which face the cuber actually crossed, which is the
  // question this field was always asking. `detectCrossSide` stays as the
  // fallback for a solve the normalizer could not read.
  const crossSide = crossDoneState
    ? (norm.crossFace ? `${norm.crossFace}-cross` : detectCrossSide(crossDoneState))
    : null;
  const ollCase   = f2lDoneState   ? formatOllCase(f2lDoneState)     : null;
  const pllCase   = ollDoneState   ? formatPllCase(ollDoneState)     : null;

  return {
    crossDoneMs,
    f2lDoneMs,
    ollDoneMs,
    solvedMs,
    crossEndIdx,
    f2lEndIdx,
    ollEndIdx,
    solvedEndIdx,
    crossMs,
    f2lMs,
    ollMs,
    pllMs,
    crossHtm: crossDoneMs !== null ? crossHtm : null,
    f2lHtm:   f2lDoneMs   !== null ? f2lHtm   : null,
    ollHtm:   ollDoneMs   !== null ? ollHtm   : null,
    pllHtm:   solvedMs    !== null ? pllHtm   : null,
    crossSide,
    ollCase,
    pllCase,
  };
}

/**
 * The segmentation a solve should carry, or null when it should carry none.
 *
 * Owns the whole decision — event class, presence of a move stream, and a
 * scramble or stream the walker chokes on — so the solve recorder and anything
 * else attaching segments cannot drift apart on the rules. A throw here must
 * never cost the caller its solve, so a failed walk reads as "no segments"
 * and leaves the solve for the re-analysis pass to pick up later.
 */
export function stageSegmentsFor(
  solve: Pick<Solve, 'event' | 'moves' | 'scramble' | 'timeMs'>,
): StageSegments | null {
  if (!solve.moves || solve.moves.length === 0) return null;
  if (!STAGE_SEGMENT_EVENTS.has(solve.event)) return null;
  try {
    return computeStageSegments(solve.scramble, solve.moves as SolveMove[], solve.timeMs);
  } catch {
    return null;
  }
}

/**
 * Per-stage personal averages computed from a recent window of solves.
 * Each field is the mean of that stage's `*Ms` over solves where it's
 * defined; null when no solve in the window has data for the stage.
 */
export interface StageAverages {
  crossMs: number | null;
  f2lMs: number | null;
  ollMs: number | null;
  pllMs: number | null;
  /** Number of solves actually used (after filtering DNF / missing segs). */
  sampleSize: number;
}

/**
 * Compute the user's recent per-stage averages, restricted to the most
 * recent `windowSize` non-DNF solves that have `stageSegments` populated.
 * Each stage averages independently over solves where that stage was
 * actually reached (e.g. PLL may have fewer samples than Cross if some
 * solves DNF'd before PLL).
 */
export function computeStageAverages(
  history: Solve[],
  windowSize: number,
): StageAverages {
  // Filter to non-DNF solves with stageSegments populated, then take the
  // last `windowSize` by ts (history may not be sorted; sort defensively).
  const eligible = history
    .filter(s => s.penalty !== 'DNF' && s.stageSegments)
    .slice()
    .sort((a, b) => a.ts - b.ts);
  const window = eligible.slice(-windowSize);

  const sums = { cross: 0, f2l: 0, oll: 0, pll: 0 };
  const counts = { cross: 0, f2l: 0, oll: 0, pll: 0 };
  for (const s of window) {
    const seg = s.stageSegments!;
    if (seg.crossMs !== null) { sums.cross += seg.crossMs; counts.cross += 1; }
    if (seg.f2lMs   !== null) { sums.f2l   += seg.f2lMs;   counts.f2l   += 1; }
    if (seg.ollMs   !== null) { sums.oll   += seg.ollMs;   counts.oll   += 1; }
    if (seg.pllMs   !== null) { sums.pll   += seg.pllMs;   counts.pll   += 1; }
  }

  return {
    crossMs: counts.cross > 0 ? sums.cross / counts.cross : null,
    f2lMs:   counts.f2l   > 0 ? sums.f2l   / counts.f2l   : null,
    ollMs:   counts.oll   > 0 ? sums.oll   / counts.oll   : null,
    pllMs:   counts.pll   > 0 ? sums.pll   / counts.pll   : null,
    sampleSize: window.length,
  };
}
