/**
 * Admin-only API for editing the canonical alg case database.
 * Replaces what used to be `data/alg_*.json` static files. Only ADMIN_WCA_IDS
 * users can call PUT/POST/DELETE; the server enforces.
 */
import type { AlgCase } from '@cuberoot/shared';

const API_BASE = import.meta.env.VITE_RECON_API_BASE
  || (window.location.hostname === 'ruiminyan.github.io'
    ? 'https://www.cuberoot.me/api/alg/sets'
    : '/api/alg/sets');

function getToken(): string | null {
  return localStorage.getItem('cuberoot_jwt') || localStorage.getItem('wca_access_token');
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `API error ${resp.status}`);
  }
  return resp.json();
}

export interface AlgCaseInput {
  caseName: string;
  subgroup: string;
  setup: string;
  standard: string | null;
  sticker: unknown;
  algs: unknown;
  oriNames?: string[] | null;
  trainerKey?: string | null;
}

export async function createCase(puzzle: string, set: string, body: AlgCaseInput): Promise<AlgCase> {
  const r = await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}/cases`,
    { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) },
  );
  return handle<AlgCase>(r);
}

export async function updateCase(puzzle: string, set: string, id: number, body: AlgCaseInput): Promise<AlgCase> {
  const r = await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}/cases/${id}`,
    { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) },
  );
  return handle<AlgCase>(r);
}

export async function reorderCases(puzzle: string, set: string, ids: number[]): Promise<{ ok: boolean }> {
  const r = await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}/cases/order`,
    { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ ids }) },
  );
  return handle<{ ok: boolean }>(r);
}

export async function deleteCase(puzzle: string, set: string, id: number): Promise<{ ok: boolean }> {
  const r = await fetch(
    `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}/cases/${id}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  return handle<{ ok: boolean }>(r);
}
