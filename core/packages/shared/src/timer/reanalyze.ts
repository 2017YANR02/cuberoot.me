import type { Solve } from './types';
import type { TimerSolvesByEvent } from './persistence';
import { STAGE_SEGMENT_EVENTS, stageSegmentsFor, type StageSegments } from './stage-segments-producer';
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


export function reanalyzeTimerSolve(solve: Solve): Solve {
  if (!STAGE_SEGMENT_EVENTS.has(solve.event) || !solve.moves?.length) return solve;
  const next = stageSegmentsFor(solve);
  return segsEqual(solve.stageSegments, next) ? solve : { ...solve, stageSegments: next ?? undefined };
}
export function reanalyzeTimerSession(byEvent: TimerSolvesByEvent) {
  let scanned = 0; let updated = 0;
  const result: TimerSolvesByEvent = {};
  for (const [event, solves] of Object.entries(byEvent)) {
    result[event as Solve['event']] = (solves ?? []).map(solve => {
      if (STAGE_SEGMENT_EVENTS.has(solve.event) && solve.moves?.length) scanned++;
      const next = reanalyzeTimerSolve(solve);
      if (next !== solve) updated++;
      return next;
    });
  }
  return { byEvent: result, scanned, updated };
}
