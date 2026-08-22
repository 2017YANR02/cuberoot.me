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
