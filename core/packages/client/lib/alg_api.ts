/**
 * Alg submissions API client — ported from packages/client-vite/src/utils/alg_api.ts.
 * 任何登录用户都能给 (puzzle, set, case_name) 投 alg;作者 + admin 可改/删。
 */
import type { AlgSubmission } from '@cuberoot/shared';
import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi } from './admin-api';

const API_BASE = API_ORIGIN + '/v1/alg';

/** List every user-submitted alg for one set (puzzle + set slug). */
export async function listSubmissions(puzzle: string, setSlug: string): Promise<AlgSubmission[]> {
  const resp = await fetch(`${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(setSlug)}/submissions`, {
    headers: authHeaders(false),
  });
  return handleApi<AlgSubmission[]>(resp);
}

/** Submit a new alg under (puzzle, set, caseName). Requires login. */
export async function addSubmission(
  puzzle: string,
  setSlug: string,
  caseName: string,
  alg: string,
  notes?: string,
): Promise<AlgSubmission> {
  const path = `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(setSlug)}/${encodeURIComponent(caseName)}/submit`;
  const resp = await fetch(path, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ alg, notes }),
  });
  return handleApi<AlgSubmission>(resp);
}

/** Edit your own submission (admins can edit anyone's, and admins can also re-target caseName). */
export async function updateSubmission(
  id: number,
  fields: { alg: string; notes?: string; caseName?: string },
): Promise<AlgSubmission> {
  const resp = await fetch(`${API_BASE}/submissions/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(fields),
  });
  return handleApi<AlgSubmission>(resp);
}

/** Delete your own submission (admins can delete anyone's). */
export async function deleteSubmission(id: number): Promise<{ ok: boolean }> {
  const resp = await fetch(`${API_BASE}/submissions/${id}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  return handleApi<{ ok: boolean }>(resp);
}

// ── admin: new-submission notification ──────────────────────────────────────

/** Admin: count of submissions newer than this admin's read watermark (excludes own). */
export async function fetchAdminUnreadSubmissions(): Promise<number> {
  const resp = await fetch(`${API_BASE}/submissions/admin/unread`, {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  const data = await handleApi<{ count: number }>(resp);
  return data.count ?? 0;
}

/** Admin: most recent submissions across all sets (for the notification dropdown). */
export async function fetchRecentSubmissions(limit = 30): Promise<AlgSubmission[]> {
  const resp = await fetch(`${API_BASE}/submissions/admin/recent?limit=${limit}`, {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  return handleApi<AlgSubmission[]>(resp);
}

/** Admin: mark all current submissions as seen (clears the badge). Best-effort. */
export async function markSubmissionsSeen(): Promise<void> {
  await fetch(`${API_BASE}/submissions/admin/seen`, {
    method: 'POST',
    headers: authHeaders(),
  }).catch(() => {});
}
