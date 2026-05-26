// Minimal port of packages/client/src/utils/recon_api.ts for read-only recon pages.
// Auth + write endpoints intentionally not ported — recon submit/edit is deferred
// until the OAuth flow + WCIF parser are ported into client-next.

import type {
  ReconSolve, ReconComment, EditHistoryItem,
} from '@cuberoot/shared';
import { API_ORIGIN } from './api-base';

const API_BASE = API_ORIGIN + '/v1/recon';

async function apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export async function listRecons(wcaId?: string): Promise<ReconSolve[]> {
  return apiGet<ReconSolve[]>('/list', wcaId ? { wcaId } : {});
}

export async function getRecon(id: number): Promise<ReconSolve> {
  return apiGet<ReconSolve>(`/${id}`);
}

export interface CommentsResponse {
  comments: ReconComment[];
}

export async function listComments(reconId: number): Promise<ReconComment[]> {
  const r = await apiGet<CommentsResponse>(`/${reconId}/comments`);
  return r.comments;
}

export async function listEditHistory(reconId: number): Promise<EditHistoryItem[]> {
  return apiGet<EditHistoryItem[]>(`/${reconId}/edits`);
}
