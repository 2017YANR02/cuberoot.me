/**
 * Per-stage CFOP segmentation for post-solve reconstruction.
 *
 * Walks the recorded move stream from the scrambled state, applying each move
 * to a 3x3 face model and recording the timestamp at which the cube *first*
 * reaches Cross / F2L / OLL / Solved. Used by ReconstructModal to split a
 * solve's elapsed time into stage durations and per-stage TPS.
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
 */

import { detectCfopStage, stageRank } from '../cube/cfop_detect';
import type { CfopStage } from '../cube/cfop_detect';
import type { CubeFaces } from '../cube/state';
import { applyMoves, applyScramble, solved } from '../cube/state';
import { parseScramble } from '../cube/moves';

export interface SolveMove {
  /** Move token (e.g. "R", "U'", "F2"). */
  m: string;
  /** ms since solve start. */
  ts: number;
}

export interface StageSegments {
  /** ms since solve start at which each stage was first completed. */
  crossDoneMs: number | null;
  f2lDoneMs: number | null;
  ollDoneMs: number | null;
  solvedMs: number | null;
  /** Per-stage durations (ms); null when the stage was not reached. */
  crossMs: number | null;
  f2lMs: number | null;
  ollMs: number | null;
  pllMs: number | null;
  /** HTM count attributable to each stage (face turns within the stage's
   *  move range). null when stage not reached. */
  crossHtm: number | null;
  f2lHtm: number | null;
  ollHtm: number | null;
  pllHtm: number | null;
}

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
 * Apply a single move token to faces in place (returns new state, or the same
 * reference on failure). Defensive: never throws.
 */
function applyOneToken(prev: CubeFaces, token: string): CubeFaces {
  const trimmed = token.trim();
  if (!trimmed) return prev;
  try {
    const parsed = parseScramble(trimmed);
    if (parsed.length === 0) return prev;
    return applyMoves(prev, 3, parsed);
  } catch {
    return prev;
  }
}

export function computeStageSegments(
  scramble: string,
  moves: SolveMove[],
  totalMs: number,
): StageSegments | null {
  if (!moves || moves.length === 0) return null;

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

  // HTM counts per stage. We accumulate into the *current* stage at the time
  // the move is executed (the move that *completes* a stage counts toward the
  // stage being completed, matching how a solver would report it).
  let crossHtm = 0;
  let f2lHtm = 0;
  let ollHtm = 0;
  let pllHtm = 0;

  let lastReached: CfopStage = 'scrambled';

  for (const mv of moves) {
    const wasFace = isFaceTurnToken(mv.m);
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
    if (newRank >= stageRank('cross') && crossDoneMs === null) crossDoneMs = mv.ts;
    if (newRank >= stageRank('f2l')   && f2lDoneMs   === null) f2lDoneMs   = mv.ts;
    if (newRank >= stageRank('oll')   && ollDoneMs   === null) ollDoneMs   = mv.ts;
    if (newRank >= stageRank('pll')   && solvedMs    === null) solvedMs    = mv.ts;

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

  return {
    crossDoneMs,
    f2lDoneMs,
    ollDoneMs,
    solvedMs,
    crossMs,
    f2lMs,
    ollMs,
    pllMs,
    crossHtm: crossDoneMs !== null ? crossHtm : null,
    f2lHtm:   f2lDoneMs   !== null ? f2lHtm   : null,
    ollHtm:   ollDoneMs   !== null ? ollHtm   : null,
    pllHtm:   solvedMs    !== null ? pllHtm   : null,
  };
}
