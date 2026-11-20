/** Runtime-neutral preference shared by persistence and backup transports. */
export const DEFAULT_TIMER_AUTO_BACKUP_EVERY = 10;
export function normalizeTimerAutoBackupEvery(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(30, Math.trunc(value))) : DEFAULT_TIMER_AUTO_BACKUP_EVERY;
}

/** Read the durable counter once per successful write, including imported groups. */
export function advanceTimerAutoBackupCadence(previous: unknown, addedSolves: number, preference: number) {
  const count = typeof previous === 'number' && Number.isSafeInteger(previous) && previous >= 0 ? previous : 0;
  const added = Number.isSafeInteger(addedSolves) && addedSolves > 0 ? addedSolves : 0;
  const next = Math.min(Number.MAX_SAFE_INTEGER, count + added);
  const every = normalizeTimerAutoBackupEvery(preference);
  return { next, due: added > 0 && every > 0 && Math.floor(next / every) > Math.floor(count / every) };
}
