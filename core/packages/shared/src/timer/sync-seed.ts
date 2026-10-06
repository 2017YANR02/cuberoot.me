/** Persisted sequence position. Revision invalidates work after apply/clear/reset. */
export interface TimerSyncSeedSettings {
  syncSeed: string | null;
  syncSeedCounter: number;
  syncSeedRevision: number;
}
export interface TimerSeedTicket {
  seed: string;
  index: number;
  revision: number;
}
export function normalizeTimerSyncSeed(value: Partial<TimerSyncSeedSettings> = {}): TimerSyncSeedSettings {
  const integer = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0;
  return {
    syncSeed: typeof value.syncSeed === 'string' && value.syncSeed.length ? value.syncSeed : null,
    syncSeedCounter: integer(value.syncSeedCounter),
    syncSeedRevision: integer(value.syncSeedRevision),
  };
}
export function resetTimerSyncSeed(current: Partial<TimerSyncSeedSettings>, seed = current.syncSeed ?? null): TimerSyncSeedSettings {
  const state = normalizeTimerSyncSeed(current);
  return { syncSeed: seed || null, syncSeedCounter: 0, syncSeedRevision: state.syncSeedRevision + 1 };
}
export function timerSeedTicket(current: Partial<TimerSyncSeedSettings>): TimerSeedTicket | null {
  const state = normalizeTimerSyncSeed(current);
  return state.syncSeed ? { seed: state.syncSeed, index: state.syncSeedCounter, revision: state.syncSeedRevision } : null;
}
export function consumeTimerSeed(current: Partial<TimerSyncSeedSettings>, ticket: TimerSeedTicket): TimerSyncSeedSettings | null {
  const state = normalizeTimerSyncSeed(current);
  if (state.syncSeed !== ticket.seed || state.syncSeedRevision !== ticket.revision
    || state.syncSeedCounter < ticket.index || ticket.index >= Number.MAX_SAFE_INTEGER) return null;
  return { ...state, syncSeedCounter: Math.max(state.syncSeedCounter, ticket.index + 1) };
}

/** Preserve newer unrelated settings when a full snapshot was superseded during a seed write. */
export function mergeTimerSeedProgress<T extends TimerSyncSeedSettings>(current: T, committed: TimerSyncSeedSettings): T {
  if (current.syncSeed !== committed.syncSeed || current.syncSeedRevision !== committed.syncSeedRevision) return current;
  return { ...current, syncSeedCounter: Math.max(current.syncSeedCounter, committed.syncSeedCounter) };
}
