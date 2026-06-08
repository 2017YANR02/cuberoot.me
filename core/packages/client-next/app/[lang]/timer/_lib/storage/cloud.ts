/**
 * Cloud backup client — single-snapshot, login-gated cloud copy of the whole
 * solo-timer DB. Reuses exportJson()/importJson() verbatim (the same blob the
 * user can already download to a file), so there is zero new serialization:
 *
 *   upload  = POST exportJson()
 *   restore = GET blob -> importJson()   (full replace, all sessions + events)
 *
 * Auth + transport reuse lib/admin-api (authHeaders/handleApi) + lib/api-base
 * (apiUrl). Identity is derived server-side from the Bearer JWT — we never send a
 * userId. See server routes/timer_backups.ts.
 */
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { exportJson, importJson } from './db';
import i18n from "@/i18n/i18n-client";

const ENDPOINT = '/v1/timer/backup';

export interface CloudBackupMeta {
  exists: boolean;
  /** byte length of the stored blob (present when exists) */
  byteSize?: number;
  /** total solves across all sessions/events (present when exists) */
  solveCount?: number;
  /** last upload time, epoch seconds (present when exists) */
  updatedAt?: number;
}

/** Count solves across all sessions/events in an exported DbShapeV3 blob. */
export function countSolves(blob: string): number {
  try {
    const db = JSON.parse(blob) as { dataBySession?: Record<string, Record<string, unknown[]>> };
    let n = 0;
    for (const byEvent of Object.values(db.dataBySession ?? {})) {
      for (const list of Object.values(byEvent)) {
        if (Array.isArray(list)) n += list.length;
      }
    }
    return n;
  } catch {
    return 0;
  }
}

/** Push the current local DB to the cloud (replaces the user's snapshot). */
export async function uploadBackup(): Promise<{ updatedAt: number; solveCount: number; byteSize: number }> {
  const blob = exportJson();
  const solveCount = countSolves(blob);
  const res = await fetch(apiUrl(ENDPOINT), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ blob, solveCount }),
  });
  const data = await handleApi<{ ok: boolean; updatedAt: number; solveCount: number; byteSize: number }>(res);
  return {
    updatedAt: data.updatedAt,
    solveCount: data.solveCount ?? solveCount,
    byteSize: data.byteSize ?? new Blob([blob]).size,
  };
}

/** Read the cloud snapshot (blob + meta); null when none exists. */
export async function downloadBackup(): Promise<{ blob: string; updatedAt: number; solveCount: number } | null> {
  const res = await fetch(apiUrl(ENDPOINT), { headers: authHeaders() });
  const data = await handleApi<CloudBackupMeta & { blob?: string }>(res);
  if (!data.exists || typeof data.blob !== 'string') return null;
  return { blob: data.blob, updatedAt: data.updatedAt ?? 0, solveCount: data.solveCount ?? 0 };
}

/** Lightweight metadata fetch (no blob) for the "last synced" label. */
export async function fetchBackupMeta(): Promise<CloudBackupMeta> {
  const res = await fetch(apiUrl(ENDPOINT + '?meta=1'), { headers: authHeaders() });
  return handleApi<CloudBackupMeta>(res);
}

/**
 * Replace the local DB with the cloud snapshot.
 *   'ok'      — restored
 *   'empty'   — no cloud snapshot exists
 *   'invalid' — a snapshot exists but importJson() rejected it (corrupt / unknown shape)
 */
export async function restoreFromCloud(): Promise<'ok' | 'empty' | 'invalid'> {
  const dl = await downloadBackup();
  if (!dl) return 'empty';
  return importJson(dl.blob) ? 'ok' : 'invalid';
}

/** Delete the user's cloud snapshot. */
export async function deleteBackup(): Promise<void> {
  const res = await fetch(apiUrl(ENDPOINT), { method: 'DELETE', headers: authHeaders() });
  await handleApi<{ ok: boolean }>(res);
}

/** Relative "last synced" label from an epoch-seconds timestamp. */
export function formatSyncTime(epochSec: number, isZh: boolean): string {
  if (!epochSec) return isZh ? '未知' : 'unknown';
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - epochSec);
  if (diffSec < 60) return i18n.language === 'zh-Hant' ? ('剛剛') : (isZh ? '刚刚' : 'just now');
  const min = Math.floor(diffSec / 60);
  if (min < 60) return i18n.language === 'zh-Hant' ? (`${min} 分鐘前`) : (isZh ? `${min} 分钟前` : `${min} min ago`);
  const hr = Math.floor(min / 60);
  if (hr < 24) return i18n.language === 'zh-Hant' ? (`${hr} 小時前`) : (isZh ? `${hr} 小时前` : `${hr} h ago`);
  const d = new Date(epochSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
