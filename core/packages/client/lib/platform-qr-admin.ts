import { sessionFetch } from '@/lib/session-fetch';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import type { PlatformEntity } from './platform-types';

export interface QrAdminRow {
  id: string; code: string; label: string; title: string; status: string;
  type: 'redirect' | 'landing'; targetKind: string; targetValue: string;
  scanCount: string; createdAt: string; updatedAt: string;
}
export interface QrAdminPage { items: QrAdminRow[]; page: number; pageSize: number; total: number }
export interface QrTemplate {
  id: string; templateKey: string; nameZh: string; nameEn: string; status: string; sortOrder: number;
  template: { body?: string; dimension?: string; category?: string };
}
export interface QrStats {
  items: { day: string; scanCount: string; uniqueVisitors: string }[];
  summary: { totalCodes: string; totalScans: string; uniqueVisitors: string };
  byCode: { id: string; code: string; label: string; status: string; scanCount: string; uniqueVisitors: string; lastScanAt: string | null }[];
  byBatch: { label: string; codes: string; scanCount: string; uniqueVisitors: string }[];
  coverage: { dailySince: string | null; timeZone: string; historicalDailyUnavailable: boolean };
}
export async function qrAdminRequest<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  return handleApi<T>(await sessionFetch(apiUrl(`/v1/platform/admin/qr${path}`), {
    method: options.method ?? 'GET', cache: 'no-store', signal: options.signal,
    headers: { ...authHeaders(options.body !== undefined), ...(options.method ? { 'Idempotency-Key': crypto.randomUUID() } : {}) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  }));
}
export function qrAdminEntity(row: QrAdminRow): PlatformEntity {
  return { id: row.id, title: row.title, status: row.status, updatedAt: row.updatedAt, data: { ...row } };
}
