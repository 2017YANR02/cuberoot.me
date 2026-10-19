/** Runtime-neutral preference shared by persistence and backup transports. */
export const DEFAULT_TIMER_AUTO_BACKUP_EVERY = 10;
export function normalizeTimerAutoBackupEvery(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(30, Math.trunc(value))) : DEFAULT_TIMER_AUTO_BACKUP_EVERY;
}
