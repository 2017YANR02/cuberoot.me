/**
 * Alg submissions API client.
 * 任何登录用户都能给 (puzzle, set, case_name) 投 alg;作者 + admin 可改/删。
 */
import type { AlgSubmission } from '@cuberoot/shared';

const API_BASE = import.meta.env.VITE_RECON_API_BASE
  || (window.location.hostname === 'ruiminyan.github.io'
    ? 'https://www.cuberoot.me/api/alg'
    : '/api/alg');

function getToken(): string | null {
  return localStorage.getItem('cuberoot_jwt') || localStorage.getItem('wca_access_token');
}

function authHeaders(json = true): HeadersInit {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handleResponse<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `API error ${resp.status}`);
  }
  return resp.json();
}

/** List every user-submitted alg for one set (puzzle + set slug). */
export async function listSubmissions(puzzle: string, setSlug: string): Promise<AlgSubmission[]> {
  const resp = await fetch(`${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(setSlug)}/submissions`, {
    headers: authHeaders(false),
  });
  return handleResponse<AlgSubmission[]>(resp);
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
  return handleResponse<AlgSubmission>(resp);
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
  return handleResponse<AlgSubmission>(resp);
}

/** Delete your own submission (admins can delete anyone's). */
export async function deleteSubmission(id: number): Promise<{ ok: boolean }> {
  const resp = await fetch(`${API_BASE}/submissions/${id}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  return handleResponse<{ ok: boolean }>(resp);
}
