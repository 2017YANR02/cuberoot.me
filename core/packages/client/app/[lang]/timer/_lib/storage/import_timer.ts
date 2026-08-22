import type { EventId, Solve } from '../types';

export type TimerImportSource = 'csTimer' | 'dcTimer';

/** One source session preserved as a separate CubeRoot session on bulk import. */
export interface TimerImportSession {
  /** Stable id within the imported file. */
  sessionId: string;
  /** Source display name, including empty sessions. */
  name: string;
  /** Best-effort target event. Falls back to 3x3 when unmatched. */
  event: EventId;
  /** False means the user must choose a target before importing solves. */
  matched: boolean;
  /** Parsed solves, sorted oldest to newest. */
  solves: Solve[];
}

export interface TimerImportPlan {
  sessions: Array<{
    name: string;
    event?: EventId;
    solves: Solve[];
  }>;
  solveCount: number;
  unresolvedSessionIds: string[];
}

/** Resolve user-selected event overrides and identify the only sessions that block atomic import. */
export function planTimerImport(
  sessions: readonly TimerImportSession[],
  targets: Readonly<Record<string, EventId>> = {},
): TimerImportPlan {
  const unresolvedSessionIds: string[] = [];
  let solveCount = 0;
  const plannedSessions = sessions.map((session) => {
    const event = targets[session.sessionId] ?? (session.matched ? session.event : undefined);
    solveCount += session.solves.length;
    if (session.solves.length > 0 && !event) unresolvedSessionIds.push(session.sessionId);
    return {
      name: session.name,
      ...(event ? { event } : {}),
      solves: session.solves,
    };
  });

  return { sessions: plannedSessions, solveCount, unresolvedSessionIds };
}
