/**
 * One-shot migration: walks all 3x3-class solves that have a recorded move
 * stream and recomputes `stageSegments` from scratch using the current exact
 * recognizer in `reconstruct/stage_segments.ts`. Writes back any solve whose
 * recomputed segments differ from what was stored (or where nothing was
 * stored before).
 *
 * Triggered manually from SettingsPanel — running it twice in a row is a
 * no-op on the second pass because the comparison is structural (same input
 * + same algorithm => same output => `segsEqual` returns true).
 *
 * Since the recorder attaches segments as each solve lands, this is now a
 * BACKFILL for solves recorded before it did (and a re-run after the
 * recognizer changes), not the only way the field ever gets written.
 */

import type { EventId, Solve } from '../types';

import { STAGE_SEGMENT_EVENTS } from '../reconstruct/stage_segments';
import { reanalyzeTimerSolve } from '@cuberoot/shared/timer';
import { getActiveSessionId, loadSessionData, updateSessionSolves } from './db';

export interface ReanalyzeProgress {
  scanned: number;
  total: number;
  updated: number;
}

export interface ReanalyzeResult {
  scanned: number;
  updated: number;
  eventsTouched: string[];
}

/**
 * Walk all solves and recompute their stageSegments. Calls `onProgress` after
 * each event finishes (cheap UI tick — solves-per-event is the IndexedDB
 * batching boundary so we don't yield per solve).
 */
export async function reanalyzeAll(
  onProgress?: (p: ReanalyzeProgress) => void,
): Promise<ReanalyzeResult> {
  const sessionId = getActiveSessionId();
  const byEvent = loadSessionData(sessionId);
  const eventIds = Object.keys(byEvent) as EventId[];

  // Total = solves we'll actually attempt to recompute (only those with moves
  // on a 3x3-class event). Used for the progress denominator.
  let total = 0;
  for (const ev of eventIds) {
    if (!STAGE_SEGMENT_EVENTS.has(ev)) continue;
    const list = byEvent[ev] ?? [];
    for (const s of list) {
      if (s.moves && s.moves.length > 0) total += 1;
    }
  }

  let scanned = 0;
  let updatedTotal = 0;
  const eventsTouched: string[] = [];

  for (const ev of eventIds) {
    if (!STAGE_SEGMENT_EVENTS.has(ev)) continue;
    const list = byEvent[ev] ?? [];
    if (list.length === 0) continue;

    const dirty: Solve[] = [];
    for (const s of list) {
      if (!s.moves || s.moves.length === 0) continue;
      scanned += 1;

      // Same function the recorder uses, so a backfilled solve and a freshly
      // recorded one can never disagree — including on which inputs get no
      // segments at all (a broken scramble or stream skips, it doesn't crash
      // the migration).
      const merged = reanalyzeTimerSolve(s);
      if (merged !== s) dirty.push(merged);
    }

    if (dirty.length > 0) {
      updateSessionSolves(sessionId, ev, dirty);
      updatedTotal += dirty.length;
      eventsTouched.push(ev);
    }

    onProgress?.({ scanned, total, updated: updatedTotal });
    // Yield to the event loop so the UI can repaint between events.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  return { scanned, updated: updatedTotal, eventsTouched };
}
