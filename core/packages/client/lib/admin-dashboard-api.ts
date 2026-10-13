import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';

export interface AdminDashboardData {
  from: string;
  to: string;
  timeZone: 'UTC';
  updatedAt: string;
  pending: { feedback: number; threads: number; posts: number; reports: number; sponsorClaims: number } | null;
  revenue: Array<{ date: string; currency: string; receivedMinor: string; refundedMinor: string }> | null;
  sponsors: Array<{ currency: string; amount: string }> | null;
  traffic: {
    windowStart: string;
    windowEnd: string;
    stale: boolean;
    sources: Array<{ source: string; coverage: 'observed' | 'no_matching_requests' | 'not_connected'; requests: number; pageCandidates: number; unexpected5xx: number }>;
  } | null;
}

export async function fetchAdminDashboard(days: number, signal?: AbortSignal): Promise<AdminDashboardData> {
  return handleApi<AdminDashboardData>(await sessionFetch(apiUrl(`/v1/admin/dashboard?days=${days}`), {
    headers: authHeaders(false), cache: 'no-store', signal,
  }));
}
