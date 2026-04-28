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
 */

import type { EventId, Solve } from '../types';
import type { StageSegments, SolveMove } from '../reconstruct/stage_segments';
import { computeStageSegments } from '../reconstruct/stage_segments';
import { loadAll, updateSolves } from './db';

/** Events where stageSegments is meaningful (CFOP-style 3x3 solves). */
const RECOGNIZED_EVENTS: ReadonlySet<EventId> = new Set<EventId>([
  '333', '333oh', '333fm', '333mr', 'cross', 'f2l', 'll', 'oll', 'pll',
  'coll', 'cmll', 'zbll', 'eg1', 'eg2', 'custom',
]);

function segsEqual(a: StageSegments | undefined, b: StageSegments | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.crossDoneMs === b.crossDoneMs &&
    a.f2lDoneMs   === b.f2lDoneMs   &&
    a.ollDoneMs   === b.ollDoneMs   &&
    a.solvedMs    === b.solvedMs    &&
    a.crossMs     === b.crossMs     &&
    a.f2lMs       === b.f2lMs       &&
    a.ollMs       === b.ollMs       &&
    a.pllMs       === b.pllMs       &&
    a.crossHtm    === b.crossHtm    &&
    a.f2lHtm      === b.f2lHtm      &&
    a.ollHtm      === b.ollHtm      &&
    a.pllHtm      === b.pllHtm      &&
    a.crossSide   === b.crossSide   &&
    a.ollCase     === b.ollCase     &&
    a.pllCase     === b.pllCase
  );
}

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
  const byEvent = loadAll();
  const eventIds = Object.keys(byEvent) as EventId[];

  // Total = solves we'll actually attempt to recompute (only those with moves
  // on a 3x3-class event). Used for the progress denominator.
  let total = 0;
  for (const ev of eventIds) {
    if (!RECOGNIZED_EVENTS.has(ev)) continue;
    const list = byEvent[ev] ?? [];
    for (const s of list) {
      if (s.moves && s.moves.length > 0) total += 1;
    }
  }

  let scanned = 0;
  let updatedTotal = 0;
  const eventsTouched: string[] = [];

  for (const ev of eventIds) {
    if (!RECOGNIZED_EVENTS.has(ev)) continue;
    const list = byEvent[ev] ?? [];
    if (list.length === 0) continue;

    const dirty: Solve[] = [];
    for (const s of list) {
      if (!s.moves || s.moves.length === 0) continue;
      scanned += 1;

      let next: StageSegments | null = null;
      try {
        next = computeStageSegments(s.scramble, s.moves as SolveMove[], s.timeMs);
      } catch {
        // Defensive: a broken scramble or move stream should skip, not crash
        // the whole migration.
        next = null;
      }

      if (segsEqual(s.stageSegments, next)) continue;

      // next === null + existing was undefined: handled by segsEqual above.
      // next === null + existing was something: clear it.
      const merged: Solve = next === null
        ? { ...s, stageSegments: undefined }
        : { ...s, stageSegments: next };
      dirty.push(merged);
    }

    if (dirty.length > 0) {
      updateSolves(ev, dirty);
      updatedTotal += dirty.length;
      eventsTouched.push(ev);
    }

    onProgress?.({ scanned, total, updated: updatedTotal });
    // Yield to the event loop so the UI can repaint between events.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  return { scanned, updated: updatedTotal, eventsTouched };
}
