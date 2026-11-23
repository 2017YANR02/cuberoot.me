import { createTimerBackupClient } from '@cuberoot/shared/timer/backup-client';
import { parseTimerDatabaseJson } from '@cuberoot/shared/timer/persistence';
import { effectiveMs } from '@cuberoot/shared/timer/types';
import { authHeaders } from './admin-api';
import { apiUrl } from './api-base';
import { sessionFetch } from './session-fetch';

export function stageFromTimerBackup(blob: string): string | null {
  const database = parseTimerDatabaseJson(blob, { nowMs: 0, sessionId: 'default' });
  if (!database) return null;
  const latest = Object.values(database.dataBySession)
    .flatMap(events => events['333'] ?? [])
    .filter(solve => solve.timeMs > 0 && Number.isFinite(effectiveMs(solve)))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 12);
  if (latest.length < 5) return null;
  const times = latest.map(effectiveMs).sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const median = (times[middle]! + times[Math.floor((times.length - 1) / 2)]!) / 2;
  const seconds = [10, 15, 20, 30, 60].find(limit => median <= limit * 1000);
  return seconds === undefined ? 'first-solve' : 'sub' + seconds;
}

// Reuse only the derived result when this account's snapshot is unchanged.
let last: { owner: string; updatedAt: number; bytes: number; count: number; stage: string | null } | undefined;

export async function readTimerStage(owner: string, signal: AbortSignal) {
  signal.throwIfAborted();
  try {
    // Read only the active database, including the versions supported by the timer.
    const blob = localStorage.getItem('cuberoot-timer.v3') ?? localStorage.getItem('cuberoot-timer.v2') ?? localStorage.getItem('cuberoot-timer.v1');
    const local = blob && stageFromTimerBackup(blob);
    if (local) return local;
  } catch { /* Browser storage is optional. */ }
  if (owner === 'guest') return null;
  const client = createTimerBackupClient({
    apiUrl, headers: authHeaders,
    fetcher: (url, init) => sessionFetch(url, { ...init, signal, cache: 'no-store' }),
  });
  const meta = await client.meta();
  if (!meta.exists || (meta.solveCount ?? 0) < 5) return null;
  if (last?.owner === owner && last.updatedAt === meta.updatedAt && last.bytes === meta.byteSize && last.count === meta.solveCount) return last.stage;
  const snapshot = await client.download();
  signal.throwIfAborted();
  if (!snapshot) return null;
  const stage = stageFromTimerBackup(snapshot.blob);
  if (snapshot.updatedAt === meta.updatedAt && snapshot.solveCount === meta.solveCount && meta.byteSize !== undefined) {
    last = { owner, updatedAt: snapshot.updatedAt, bytes: meta.byteSize, count: snapshot.solveCount, stage };
  }
  return stage;
}
