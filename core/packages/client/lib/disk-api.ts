import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export interface DiskReport {
  capacity: { totalBytes: number; usedBytes: number; availableBytes: number; reservedBytes: number; measuredAt: string };
  snapshot: {
    path: string; bytes: number; children: { path: string; bytes: number }[];
    ownBytes: number; omittedBytes: number; omittedCount: number; partial: boolean; scannedAt: string;
  } | null;
  scanning: boolean;
  busy: boolean;
  error: boolean;
  refreshAfter: string | null;
}

export async function fetchDiskReport(path: string, refresh: boolean, signal: AbortSignal): Promise<DiskReport> {
  const query = new URLSearchParams({ path });
  if (refresh) query.set('refresh', '1');
  return handleApi<DiskReport>(await fetch(apiUrl(`/v1/admin/disk?${query}`), {
    headers: authHeaders(false), cache: 'no-store', signal,
  }));
}
