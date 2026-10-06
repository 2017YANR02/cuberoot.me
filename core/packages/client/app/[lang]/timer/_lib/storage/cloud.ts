import { createTimerBackupClient, countTimerBackupSolves, type TimerCloudBackupMeta } from '@cuberoot/shared/timer/backup-client';
import { apiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/admin-api';
import { getSessionToken } from '@/lib/auth-store';
import { exportJson, importJson } from './db';
export type CloudBackupMeta = TimerCloudBackupMeta;
export const countSolves = countTimerBackupSolves;
const client = () => { const headers = authHeaders(); return createTimerBackupClient({ apiUrl, headers: () => headers, fetcher: fetch }); };
export const uploadBackup = () => client().upload(exportJson());
export const downloadBackup = () => client().download();
export const fetchBackupMeta = () => client().meta();
export const deleteBackup = () => client().delete();
export async function restoreFromCloud(canCommit: () => boolean = () => true): Promise<'ok' | 'empty' | 'invalid'> {
  const owner = getSessionToken();
  const data = await client().download();
  if (!canCommit() || owner !== getSessionToken()) throw new Error('Account changed');
  if (!data) return 'empty';
  return importJson(data.blob) ? 'ok' : 'invalid';
}

/** Relative "last synced" label from an epoch-seconds timestamp. */
export function formatSyncTime(epochSec: number, isZh: boolean): string {
  if (!epochSec) return isZh ? '未知' : 'unknown';
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - epochSec);
  if (diffSec < 60) return (isZh ? '刚刚' : 'just now');
  const min = Math.floor(diffSec / 60);
  if (min < 60) return (isZh ? `${min} 分钟前` : `${min} min ago`);
  const hr = Math.floor(min / 60);
  if (hr < 24) return (isZh ? `${hr} 小时前` : `${hr} h ago`);
  const d = new Date(epochSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
