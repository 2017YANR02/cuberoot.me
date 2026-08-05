/**
 * F2L, one pair at a time.
 *
 * `stage_segments.ts` reports F2L as a single block, which is the one place our
 * report carries less information than the competition: every platform that
 * cubers actually train on (acubemy, 魔方星球) splits it into four slots,
 * because "F2L took 7.1s" is not actionable and "slot 3 took 2.6s of it, 1.2s
 * of that just finding the pair" is.
 *
 * ── Which move finished a pair ────────────────────────────────────────────
 *
 * Neither "first move after which the slot reads solved" nor "last" survives
 * contact with a real solve:
 *
 *   - FIRST is wrong because a slot can read solved for a moment in passing.
 *   - LAST is wrong because inserting a back pair with B turns takes the OTHER
 *     back pair apart and puts it back. Measured on the fixture solve in
 *     `tests/f2l_slots.test.ts`: pair 1 closes at move 15, F2L-2's `U B' U U B`
 *     breaks it at 16 and restores it at 20, and the backwards scan reports both
 *     pairs as finishing at 20.
 *
 * So we start with the stage walker's high-water mark: when the number of
 * standing pairs exceeds every earlier count, the newly standing pair gets the
 * boundary. One real-solve correction sits on top: if that provisional pair is
 * broken, restored, and followed by a clear recognition pause, the restoration
 * replaces the accidental pass-through. A dip with no pause stays charged to
 * the next insertion, so B-turn disturbances still do not move old boundaries.
 *
 * A pair that is already together when the cross lands (an XCross, or a pair the
 * scramble left standing) never sets a record. Those are reported as `free` with
 * no time or turns attributed — charging the solve for a pair the cuber never
 * solved would flatter the fast slots and hide the slow ones.
 *
 * ── Where the time goes ───────────────────────────────────────────────────
 *
 * Identical to `step_metrics.ts`, which is the point: slots are steps, so they
 * share `metricForRange` rather than growing a second definition of
 * recognition/execution that could drift from the one we adopted from Cubeast.
 * A pair's clock starts when the previous pair's last turn lands.
 *
 * ── What this deliberately does NOT do ────────────────────────────────────
 *
 * It does not name the case (`F2L 4`, `F2L 19`). That numbering is a community
 * convention, not something derivable, and inventing our own mapping would put
 * a wrong number next to a right time. What IS derivable is where the two
 * pieces were when the pair began, so that is what `start` reports — the same
 * taxonomy the numbering groups by, minus the number.
 *
 * Cross side: everything here reads the D layer, exactly like `isCross` /
 * `isF2l` in `cube/cfop_detect.ts`. That used to mean a cross solved on any
 * other face — which is every white-cross solve recorded by a smart cube, since
 * the protocol calls white U no matter how the cuber holds it — was invisible
 * to the whole segmentation layer. It is fixed in one place, `orient.ts`, which
 * rotates the solve into the cross-on-D frame before any of this runs. This
 * function calls it too rather than trusting its caller to have done so.
 */

import type { CubeFaces } from '../cube/state';
import { applyScramble, solved } from '../cube/state';
import type { Face } from '../cube/moves';
import { htmMoves } from './htm';
import type { HtmMove } from './htm';
import { applyOneToken, computeStageSegments } from './stage_segments';
import type { SolveMove, StageSegments } from './stage_segments';
import { normalizeSolve } from './orient';
import { metricForRange } from './step_metrics';

/** The four F2L slots, named by the two side faces that bound them. */
export type F2lSlotId = 'FR' | 'FL' | 'BR' | 'BL';

/**
 * Where the pair's two pieces were when work on it began.
 *
 * The classical taxonomy, which is what the 1-41 numbering groups by. `unknown`
 * is honest rather than a fallback bucket: it means a piece was sitting in
 * ANOTHER slot, which happens constantly while multislotting, and pretending
 * that is a "basic case" would be a lie about the case's difficulty.
 */
export type F2lStart =
  | 'paired-top'      // corner + edge joined, waiting in the U layer
  | 'split-top'       // both in the U layer, apart
  | 'corner-slotted'  // corner already in the slot, edge up top
  | 'edge-slotted'    // edge already in the slot, corner up top
  | 'both-slotted'    // both down in the slot, at least one wrong
  | 'solved'          // nothing to do
  | 'unknown';        // a piece is in some other slot

export interface F2lSlotSegment {
  slot: F2lSlotId;
  /** 1-4 in the order the pairs were finished. Free pairs share the front. */
  order: number;
  /** True when the pair was already standing as F2L began (XCross, lucky scramble). */
  free: boolean;
  /** Index of the move that finished the pair; null for a free or unfinished pair. */
  endIdx: number | null;
  /** Where the two pieces were when the pair's clock started. */
  start: F2lStart;
  /** Previous pair's last turn → this pair's first non-AUF turn. */
  recognitionMs: number | null;
  /** First non-AUF turn → the turn that closed the slot. */
  executionMs: number | null;
  /** recognition + execution. 0 for a free pair, null for one never finished. */
  stepMs: number | null;
  /** Timer start → pair finished. */
  cumulativeMs: number | null;
  /** HTM turns spent on this pair. */
  turns: number | null;
  /** turns / executionMs. */
  tps: number | null;
}

export interface F2lSlotsResult {
  /** In the order the pairs were finished. Always four rows. */
  slots: F2lSlotSegment[];
  /** Pairs already standing when the cross landed. */
  freeCount: number;
  /** The walk this came from, so callers need not redo it. */
  segments: StageSegments;
}

// ── Sticker tables ────────────────────────────────────────────────────────
//
// Index convention is `cube/cfop_detect.ts`'s, copied here as the two tables it
// spells out in prose. D row 0 is the front; F/R/B/L row 0 is the top.

interface SlotSpec {
  id: F2lSlotId;
  /** The pair's five stickers, each of which must match its own centre. */
  stickers: ReadonlyArray<readonly [Face, number]>;
  /** The corner's three positions, in (face, index) form. */
  corner: ReadonlyArray<readonly [Face, number]>;
  /** The edge's two positions. */
  edge: ReadonlyArray<readonly [Face, number]>;
}

const SLOT_SPECS: readonly SlotSpec[] = [
  {
    id: 'FR',
    stickers: [['D', 2], ['F', 8], ['R', 6], ['F', 5], ['R', 3]],
    corner: [['D', 2], ['F', 8], ['R', 6]],
    edge: [['F', 5], ['R', 3]],
  },
  {
    id: 'FL',
    stickers: [['D', 0], ['F', 6], ['L', 8], ['F', 3], ['L', 5]],
    corner: [['D', 0], ['F', 6], ['L', 8]],
    edge: [['F', 3], ['L', 5]],
  },
  {
    id: 'BR',
    stickers: [['D', 8], ['B', 6], ['R', 8], ['R', 5], ['B', 3]],
    corner: [['D', 8], ['B', 6], ['R', 8]],
    edge: [['R', 5], ['B', 3]],
  },
  {
    id: 'BL',
    stickers: [['D', 6], ['B', 8], ['L', 6], ['B', 5], ['L', 3]],
    corner: [['D', 6], ['B', 8], ['L', 6]],
    edge: [['B', 5], ['L', 3]],
  },
] as const;

/** Every corner position on the cube, as its three (face, index) stickers. */
const CORNER_POSITIONS: ReadonlyArray<{ top: boolean; at: ReadonlyArray<readonly [Face, number]> }> = [
  { top: true,  at: [['U', 0], ['L', 0], ['B', 2]] },  // ULB
  { top: true,  at: [['U', 2], ['B', 0], ['R', 2]] },  // UBR
  { top: true,  at: [['U', 6], ['F', 0], ['L', 2]] },  // UFL
  { top: true,  at: [['U', 8], ['R', 0], ['F', 2]] },  // URF
  { top: false, at: [['D', 0], ['F', 6], ['L', 8]] },  // DFL
  { top: false, at: [['D', 2], ['F', 8], ['R', 6]] },  // DFR
  { top: false, at: [['D', 6], ['B', 8], ['L', 6]] },  // DBL
  { top: false, at: [['D', 8], ['B', 6], ['R', 8]] },  // DBR
];

/** Every edge position, likewise. */
const EDGE_POSITIONS: ReadonlyArray<{ top: boolean; at: ReadonlyArray<readonly [Face, number]> }> = [
  { top: true,  at: [['U', 1], ['B', 1]] },            // UB
  { top: true,  at: [['U', 3], ['L', 1]] },            // UL
  { top: true,  at: [['U', 5], ['R', 1]] },            // UR
  { top: true,  at: [['U', 7], ['F', 1]] },            // UF
  { top: false, at: [['F', 5], ['R', 3]] },            // FR
  { top: false, at: [['F', 3], ['L', 5]] },            // FL
  { top: false, at: [['R', 5], ['B', 3]] },            // BR
  { top: false, at: [['B', 5], ['L', 3]] },            // BL
  { top: false, at: [['D', 1], ['F', 7]] },            // DF
  { top: false, at: [['D', 3], ['L', 7]] },            // DL
  { top: false, at: [['D', 5], ['R', 7]] },            // DR
  { top: false, at: [['D', 7], ['B', 7]] },            // DB
];

const SPEC_BY_ID = new Map<F2lSlotId, SlotSpec>(SLOT_SPECS.map(s => [s.id, s]));

/** Colour set of a position, as a sorted key so it compares by contents. */
function colorsAt(faces: CubeFaces, at: ReadonlyArray<readonly [Face, number]>): string {
  return at.map(([f, i]) => faces[f][i]).slice().sort().join('');
}

/** The centres a slot's pair belongs to, as the same sorted key. */
function slotCornerKey(faces: CubeFaces, spec: SlotSpec): string {
  return spec.corner.map(([f]) => faces[f][4]).slice().sort().join('');
}

function slotEdgeKey(faces: CubeFaces, spec: SlotSpec): string {
  return spec.edge.map(([f]) => faces[f][4]).slice().sort().join('');
}

/** True when every one of the pair's five stickers matches its own centre. */
export function isSlotSolved(faces: CubeFaces, id: F2lSlotId): boolean {
  const spec = SPEC_BY_ID.get(id);
  if (!spec) return false;
  for (const [f, i] of spec.stickers) {
    if (faces[f][i] !== faces[f][4]) return false;
  }
  return true;
}

/**
 * Where the pair's pieces are sitting right now.
 *
 * Pure geometry on the facelet model: find the position holding the corner's
 * three colours and the one holding the edge's two, then read off whether each
 * is in the U layer, in its own slot, or somewhere else entirely.
 */
export function classifySlotStart(faces: CubeFaces, id: F2lSlotId): F2lStart {
  const spec = SPEC_BY_ID.get(id);
  if (!spec) return 'unknown';
  if (isSlotSolved(faces, id)) return 'solved';

  const cornerKey = slotCornerKey(faces, spec);
  const edgeKey = slotEdgeKey(faces, spec);
  const cornerHome = colorsAt(faces, spec.corner);
  const edgeHome = colorsAt(faces, spec.edge);

  const cornerIn = cornerHome === cornerKey;
  const edgeIn = edgeHome === edgeKey;
  const cornerTop = !cornerIn
    && CORNER_POSITIONS.some(p => p.top && colorsAt(faces, p.at) === cornerKey);
  const edgeTop = !edgeIn
    && EDGE_POSITIONS.some(p => p.top && colorsAt(faces, p.at) === edgeKey);

  if (cornerIn && edgeIn) return 'both-slotted';
  if (cornerIn && edgeTop) return 'corner-slotted';
  if (edgeIn && cornerTop) return 'edge-slotted';
  if (cornerTop && edgeTop) return pairedInTop(faces, cornerKey, edgeKey) ? 'paired-top' : 'split-top';
  return 'unknown';
}

/**
 * Both pieces are in the U layer — are they joined?
 *
 * Joined means they sit next to each other AND their side colours line up, i.e.
 * the pair could be inserted with one U-move plus one trigger. We test it the
 * way a cuber sees it: the two pieces share a side face and the stickers facing
 * that side are the same colour.
 */
function pairedInTop(
  faces: CubeFaces,
  cornerKey: string,
  edgeKey: string,
): boolean {
  const corner = CORNER_POSITIONS.find(p => p.top && colorsAt(faces, p.at) === cornerKey);
  const edge = EDGE_POSITIONS.find(p => p.top && colorsAt(faces, p.at) === edgeKey);
  if (!corner || !edge) return false;
  // Side stickers only — the U sticker tells us about orientation, not adjacency.
  const cornerSides = corner.at.filter(([f]) => f !== 'U');
  const edgeSides = edge.at.filter(([f]) => f !== 'U');
  for (const [cf, ci] of cornerSides) {
    for (const [ef, ei] of edgeSides) {
      if (cf === ef && faces[cf][ci] === faces[ef][ei]) return true;
    }
  }
  return false;
}

/** Slot mask after each move; index -1 is the state the solve started from. */
function walkSlotStates(scramble: string, moves: SolveMove[]): CubeFaces[] {
  let state: CubeFaces;
  try {
    state = applyScramble(3, scramble);
  } catch {
    state = solved(3);
  }
  const out: CubeFaces[] = [state];
  for (const mv of moves) {
    state = applyOneToken(state, mv.m);
    out.push(state);
  }
  return out; // out[i + 1] is the state after moves[i]
}

/**
 * Per-pair segmentation of the F2L phase.
 *
 * Returns null when there is nothing to split: no moves, no segmentation, or a
 * solve that never finished the cross (there is no F2L phase to divide).
 * A solve that died mid-F2L still gets rows — the pairs that WERE finished are
 * exactly what you want to see on a DNF.
 */
export function computeF2lSlots(
  scrambleIn: string,
  movesIn: SolveMove[],
  totalMs: number,
  precomputed?: StageSegments | null,
): F2lSlotsResult | null {
  if (!movesIn || movesIn.length === 0) return null;
  // The four slots are read off the D layer, so this walk needs the same
  // cross-on-D frame `computeStageSegments` puts itself in — otherwise the
  // boundaries come from one frame and the slot states from another, which is
  // worse than either being wrong alone. 1:1 rewrite: indices still line up.
  const { scramble, moves } = normalizeSolve(scrambleIn, movesIn);
  const segments = precomputed ?? computeStageSegments(scramble, moves, totalMs);
  if (!segments) return null;
  const crossEndIdx = segments.crossEndIdx ?? null;
  if (crossEndIdx === null) return null;

  // Horizon: F2L done, or as far as the solve got. A pair still unsolved at the
  // horizon was never finished, and says so rather than borrowing a time.
  const horizon = segments.f2lEndIdx ?? moves.length - 1;
  const states = walkSlotStates(scramble, moves);
  const solvedAt = (i: number, id: F2lSlotId): boolean => isSlotSolved(states[i + 1], id);

  const standing = (i: number): F2lSlotId[] =>
    SLOT_SPECS.filter(s => solvedAt(i, s.id)).map(s => s.id);

  // Pairs already up when the cross landed. They set no record and cost nothing.
  const free = new Set(standing(crossEndIdx));
  // High water mark. A slot can also look solved for one move in the middle of
  // an insertion, fall out, then be restored immediately before the cuber stops
  // to inspect the next pair. That long pause is the observable difference
  // between an accidental pass-through and the intended finish, so a settled
  // recovery may replace the provisional boundary. Brief dips while inserting
  // the next pair do not: without a pause, the original high-water mark stays.
  const closedAt = new Map<F2lSlotId, number>();
  let peak = free.size;
  const frozen = new Set(free);
  let currentLevel: F2lSlotId[] = [];
  let dipped = false;
  const SETTLED_GAP_MS = 900;
  for (let i = crossEndIdx + 1; i <= horizon; i++) {
    const cur = standing(i);
    if (cur.length > peak) {
      for (const id of currentLevel) frozen.add(id);
      peak = cur.length;
      currentLevel = cur.filter(id => !frozen.has(id));
      for (const id of currentLevel) closedAt.set(id, i);
      dipped = false;
      continue;
    }
    if (cur.length < peak) {
      dipped = true;
      continue;
    }
    const nextTs = moves[i + 1]?.ts ?? totalMs;
    if (dipped
      && nextTs - moves[i].ts >= SETTLED_GAP_MS
      && [...frozen].every(id => cur.includes(id))) {
      for (const id of currentLevel) closedAt.delete(id);
      currentLevel = cur.filter(id => !frozen.has(id));
      for (const id of currentLevel) closedAt.set(id, i);
      dipped = false;
    }
  }

  interface Found { id: F2lSlotId; endIdx: number | null; free: boolean }
  const found: Found[] = SLOT_SPECS.map(({ id }) => ({
    id,
    endIdx: closedAt.get(id) ?? null,
    free: free.has(id),
  }));

  // Solve order: free pairs first (they were there before any of the work), then
  // by the move that closed them. Two pairs closed by the same move (multislotting)
  // fall back to the table's own order, which is stable and arbitrary — there is
  // no fact of the matter about which of them "came first".
  const ordered = found.slice().sort((a, b) => {
    if (a.free !== b.free) return a.free ? -1 : 1;
    if (a.endIdx === null || b.endIdx === null) return a.endIdx === null ? 1 : -1;
    return a.endIdx - b.endIdx;
  });

  const counted: HtmMove[] = htmMoves(moves);
  let prevEndIdx = crossEndIdx;
  let prevEndTs = moves[crossEndIdx].ts;

  const slots: F2lSlotSegment[] = ordered.map((f, i) => {
    const startState = states[prevEndIdx + 1];
    const start = classifySlotStart(startState, f.id);
    if (f.free) {
      return {
        slot: f.id, order: i + 1, free: true, endIdx: null, start: 'solved',
        recognitionMs: null, executionMs: null, stepMs: 0,
        cumulativeMs: moves[crossEndIdx].ts, turns: 0, tps: null,
      };
    }
    if (f.endIdx === null) {
      return {
        slot: f.id, order: i + 1, free: false, endIdx: null, start,
        recognitionMs: null, executionMs: null, stepMs: null,
        cumulativeMs: null, turns: null, tps: null,
      };
    }
    const m = metricForRange(moves, counted, prevEndIdx, prevEndTs, f.endIdx);
    prevEndIdx = f.endIdx;
    prevEndTs = moves[f.endIdx].ts;
    return {
      slot: f.id, order: i + 1, free: false, endIdx: f.endIdx, start,
      recognitionMs: m.recognitionMs, executionMs: m.executionMs, stepMs: m.stepMs,
      cumulativeMs: m.cumulativeMs, turns: m.turns, tps: m.tps,
    };
  });

  return { slots, freeCount: slots.filter(s => s.free).length, segments };
}
