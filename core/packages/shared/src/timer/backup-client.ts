/** Existing timer backup protocol; only the database (never App settings) crosses it. */
export interface TimerCloudBackupMeta { exists: boolean; byteSize?: number; solveCount?: number; updatedAt?: number; }
export interface TimerBackupTransport { apiUrl(path: string): string; fetcher: typeof fetch; headers(): HeadersInit; }
export function countTimerBackupSolves(blob: string): number {
  try { const db = JSON.parse(blob); return Object.values(db.dataBySession ?? {}).reduce<number>((total, value) => total + Object.values(value as Record<string, unknown>).reduce<number>((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0), 0); }
  catch { return 0; }
}
export function createTimerBackupClient(transport: TimerBackupTransport) {
  async function request<T>(suffix = '', init?: RequestInit): Promise<T> {
    const response = await transport.fetcher(transport.apiUrl('/v1/timer/backup' + suffix), { ...init, headers: transport.headers() });
    if (!response.ok) throw new Error(`Backup failed: HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }
  return {
    meta: () => request<TimerCloudBackupMeta>('?meta=1'),
    download: async () => {
      const data = await request<TimerCloudBackupMeta & { blob?: string }>();
      if (!data.exists) return null;
      if (typeof data.blob !== 'string') throw new Error('Invalid backup');
      return { blob: data.blob, updatedAt: data.updatedAt ?? 0, solveCount: data.solveCount ?? 0 };
    },
    upload: async (blob: string) => {
      const solveCount = countTimerBackupSolves(blob);
      return request<{ updatedAt: number; solveCount: number; byteSize: number }>('', { method: 'POST', body: JSON.stringify({ blob, solveCount }) });
    },
    delete: () => request<{ ok: boolean }>('', { method: 'DELETE' }),
  };
}
export interface TimerLocalBackupEntry { key: string; ts: number; size: number; }
export const TIMER_BACKUP_KEEP = 10;
export const DEFAULT_TIMER_AUTO_BACKUP_EVERY = 10;
export function normalizeTimerAutoBackupEvery(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(30, Math.trunc(value))) : DEFAULT_TIMER_AUTO_BACKUP_EVERY;
}
