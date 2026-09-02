import type {
  EventId,
  ScrambleHistory,
  TimerScrambleErrorCode,
  TimerScrambleSourceKind,
  TimerScrambleSourceSnapshot,
} from '@cuberoot/shared/timer';

import type { RealScramble } from './data/real-scramble-pool';

export type MobileScrambleSource = TimerScrambleSourceKind;
export type MobileScrambleAvailability =
  | 'ready'
  | 'loading'
  | 'unsupported'
  | 'empty'
  | 'error';

export type MobileScrambleFailure =
  | Readonly<{ kind: 'generation'; code: TimerScrambleErrorCode; retryable: boolean }>
  | Readonly<{ kind: 'optimal' }>
  | Readonly<{ kind: 'real-empty' }>
  | Readonly<{ kind: 'real-exhausted' }>;

/**
 * One immutable displayed slot. `sourceIdentity` is the generation context
 * used for stale-result rejection, while `sourceSnapshot` is what the attempt
 * persists (an official WCA occurrence identity once a real row is dispensed).
 */
export interface MobileScrambleHistoryEntry {
  readonly id: number;
  readonly event: EventId;
  readonly source: MobileScrambleSource;
  readonly sourceIdentity: string;
  readonly sourceSnapshot: TimerScrambleSourceSnapshot;
  readonly scramble: string;
  readonly caseId: string | null;
  /** Full official occurrence provenance; identical move text is not enough. */
  readonly currentReal: RealScramble | null;
  readonly availability: MobileScrambleAvailability;
  readonly failure: MobileScrambleFailure | null;
}

export type MobileScrambleHistoryEntryPatch = Partial<Pick<
  MobileScrambleHistoryEntry,
  'availability' | 'caseId' | 'currentReal' | 'failure' | 'scramble' | 'sourceSnapshot'
>>;

export interface MobileScrambleAttemptSnapshot {
  readonly caseId: string | null;
  readonly event: EventId;
  readonly scramble: string;
  readonly scrambleSource: TimerScrambleSourceSnapshot;
}

export interface MobileScrambleHistoryDisplayPlan {
  readonly history: ScrambleHistory<MobileScrambleHistoryEntry>;
  /** The exact visible slot whose cancelled async fill must be restarted. */
  readonly refillEntry: MobileScrambleHistoryEntry | null;
}

let nextEntryId = 0;

export function createMobileScrambleHistoryEntry(
  event: EventId,
  source: MobileScrambleSource,
  sourceIdentity: string,
): MobileScrambleHistoryEntry {
  return Object.freeze({
    id: ++nextEntryId,
    event,
    source,
    sourceIdentity,
    sourceSnapshot: Object.freeze({
      kind: source,
      identity: sourceIdentity,
    }),
    scramble: '',
    caseId: null,
    currentReal: null,
    failure: null,
    availability: 'loading',
  });
}

/** Replace only the exact async slot/context pair; stale completions are no-ops. */
export function replaceMobileScrambleHistoryEntry(
  history: ScrambleHistory<MobileScrambleHistoryEntry>,
  id: number,
  sourceIdentity: string,
  patch: MobileScrambleHistoryEntryPatch,
): ScrambleHistory<MobileScrambleHistoryEntry> {
  const index = history.list.findIndex((entry) => (
    entry.id === id && entry.sourceIdentity === sourceIdentity
  ));
  if (index < 0) return history;
  const list = [...history.list];
  const sourceSnapshot = patch.sourceSnapshot
    ? Object.freeze({ ...patch.sourceSnapshot })
    : list[index]!.sourceSnapshot;
  const currentReal = patch.currentReal === undefined
    ? list[index]!.currentReal
    : patch.currentReal === null
      ? null
      : Object.freeze({ ...patch.currentReal });
  const availability = patch.availability ?? list[index]!.availability;
  const failure = availability === 'loading' || availability === 'ready'
    ? null
    : patch.failure === undefined
      ? list[index]!.failure
      : patch.failure;
  list[index] = Object.freeze({
    ...list[index]!,
    ...patch,
    availability,
    currentReal,
    failure,
    sourceSnapshot,
  });
  return { list, idx: history.idx };
}

export function planMobileScrambleHistoryDisplay(
  history: ScrambleHistory<MobileScrambleHistoryEntry>,
): MobileScrambleHistoryDisplayPlan {
  const entry = history.list[history.idx] ?? null;
  return {
    history,
    refillEntry: entry?.availability === 'loading' ? entry : null,
  };
}

/** Freeze the displayed slot into a solve attempt without consulting settings. */
export function mobileScrambleAttemptSnapshot(
  entry: MobileScrambleHistoryEntry,
): MobileScrambleAttemptSnapshot {
  return Object.freeze({
    caseId: entry.caseId,
    event: entry.event,
    scramble: entry.scramble,
    scrambleSource: entry.sourceSnapshot,
  });
}
