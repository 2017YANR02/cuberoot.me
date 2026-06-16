/**
 * Admin-only API for editing the canonical alg case database.
 * Replaces what used to be `data/alg_*.json` static files. Only ADMIN_WCA_IDS
 * users can call PUT/POST/DELETE; the server enforces.
 */
import type { AlgCase } from '@cuberoot/shared';
import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi as handle } from './admin-api';

const API_BASE = API_ORIGIN + '/v1/alg/sets';

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
    `${API_BASE}/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}/reorder`,
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
