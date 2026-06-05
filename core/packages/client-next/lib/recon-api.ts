// Full port of packages/client/src/utils/recon_api.ts to client-next.
// Auth + write endpoints included.

import type {
  ReconSolve, ReconComment, EditHistoryItem, ReconAlternative,
} from '@cuberoot/shared';
import { API_ORIGIN } from './api-base';
import { getWcaId } from './auth-store';
import { authHeaders, handleApi } from './admin-api';

const API_BASE = API_ORIGIN + '/v1/recon';

function originForUrl(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

async function apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, originForUrl());
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return handleApi<T>(await fetch(url.toString(), { headers: authHeaders(false) }));
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return handleApi<T>(await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
  }));
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return handleApi<T>(await fetch(`${API_BASE}${path}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
  }));
}

async function apiDelete<T>(path: string): Promise<T> {
  return handleApi<T>(await fetch(`${API_BASE}${path}`, {
    method: 'DELETE', headers: authHeaders(false),
  }));
}

// ── Recon CRUD ──

export async function listRecons(wcaId?: string): Promise<ReconSolve[]> {
  return apiGet<ReconSolve[]>('/list', wcaId ? { wcaId } : {});
}

export async function getRecon(id: number): Promise<ReconSolve> {
  return apiGet<ReconSolve>(`/${id}`);
}

// 首页「今日复盘」: 最新一条。主用轻量 /latest 端点; 端点缺失/出错时回退到 /list 取首条
// (list 已按 id DESC 排序), 保证旧后端 / dev 代理也能渲染。
export async function getLatestRecon(): Promise<ReconSolve | null> {
  try {
    const r = await apiGet<ReconSolve | null>('/latest');
    if (r && r.id) return r;
  } catch {
    // fall through to list fallback
  }
  const list = await listRecons();
  return list.length > 0 ? list[0] : null;
}

export async function addRecon(solve: Partial<ReconSolve>): Promise<ReconSolve> {
  return apiPost<ReconSolve>('', solve);
}

export async function updateRecon(id: number, fields: Partial<ReconSolve>): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/${id}`, fields);
}

export async function deleteRecon(id: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/${id}`);
}

// ── Alternatives ──

interface AltsResponse { alternatives: ReconAlternative[] }

export async function addAlternative(reconId: number, solution: string): Promise<ReconAlternative[]> {
  const r = await apiPost<AltsResponse>(`/${reconId}/alternatives`, { solution });
  return r.alternatives;
}

export async function updateAlternative(reconId: number, idx: number, solution: string): Promise<ReconAlternative[]> {
  const r = await apiPut<AltsResponse>(`/${reconId}/alternatives/${idx}`, { solution });
  return r.alternatives;
}

export async function deleteAlternative(reconId: number, idx: number): Promise<ReconAlternative[]> {
  const r = await apiDelete<AltsResponse>(`/${reconId}/alternatives/${idx}`);
  return r.alternatives;
}

// ── Edit overlay ──

export async function loadEdits(): Promise<Record<string, Record<string, unknown>>> {
  return apiGet('/edits');
}

export async function saveEdit(solveId: string, fields: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiPost('/save-edit', { solveId, fields });
}

export async function deleteEdit(solveId: string): Promise<{ ok: boolean }> {
  return apiDelete(`/edit/${solveId}`);
}

// ── Edit history ──

export async function saveEditHistory(
  solveId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  return apiPost('/save-history', {
    solveId,
    before,
    after,
    editedBy: getWcaId(),
  });
}

export async function getEditHistory(solveId: string): Promise<EditHistoryItem[]> {
  return apiGet<EditHistoryItem[]>('/history', { id: solveId });
}

// alias used by detail pages
export async function listEditHistory(reconId: number): Promise<EditHistoryItem[]> {
  return apiGet<EditHistoryItem[]>(`/${reconId}/edits`);
}

// ── Comments ──

export interface CommentsResponse { comments: ReconComment[] }

export async function listComments(reconId: number): Promise<ReconComment[]> {
  // detail page used { comments } envelope; submit endpoints return list directly via /comments?reconId=…
  // Use envelope shape first, then fall back to list.
  try {
    const r = await apiGet<CommentsResponse>(`/${reconId}/comments`);
    return r.comments;
  } catch {
    return apiGet<ReconComment[]>('/comments', { reconId: String(reconId) });
  }
}

export async function addComment(reconId: number, content: string, parentId: number | null = null): Promise<{ ok: boolean; id: number }> {
  return apiPost('/comments', { reconId, content, parentId });
}

export async function updateComment(commentId: number, content: string): Promise<{ ok: boolean }> {
  return apiPut(`/comments/${commentId}`, { content });
}

export async function pinComment(commentId: number, pinned: boolean): Promise<{ ok: boolean }> {
  return apiPut(`/comments/${commentId}/pin`, { pinned });
}

export async function deleteComment(commentId: number): Promise<{ ok: boolean }> {
  return apiDelete(`/comments/${commentId}`);
}

// ── Duplicate detection ──

interface DuplicateResult { exists: boolean; id?: number }

export async function checkDuplicate(params: {
  comp: string;
  event: string;
  person?: string;
  personId?: string;
  round: string;
  solveNum: string;
  excludeId?: number;
}): Promise<DuplicateResult> {
  const queryParams: Record<string, string> = {
    comp: params.comp,
    event: params.event,
    round: params.round,
    solveNum: params.solveNum,
  };
  if (params.personId) queryParams.personId = params.personId;
  if (params.person) queryParams.person = params.person;
  if (params.excludeId) queryParams.excludeId = String(params.excludeId);
  return apiGet<DuplicateResult>('/check-duplicate', queryParams);
}

// ── Person / comp search ──

interface SolverResult { name: string; iso2: string; wcaId: string }

export async function searchSolvers(query: string): Promise<SolverResult[]> {
  if (query.length < 2) return [];
  return apiGet<SolverResult[]>('/search-solvers', { q: query });
}

interface PersonRecord {
  person: string;
  person_id: string;
  person_country: string | null;
}

export async function listPersons(): Promise<PersonRecord[]> {
  return apiGet<PersonRecord[]>('/list-persons');
}

export async function getUserStats(wcaId: string): Promise<{ reconCount: number; addedCount: number }> {
  return apiGet('/user-stats', { wcaId });
}

// ── WCA proxy ──

export async function getWcaAttempts(
  compId: string,
  personId: string,
): Promise<Record<string, { a: number[] }>> {
  return apiGet('/wca-attempts', { compId, personId });
}

export async function getBiliCover(bvid: string): Promise<{ pic: string }> {
  return apiGet('/bili-cover', { bvid });
}

export async function resolveShortUrl(url: string): Promise<{ url: string }> {
  return apiGet('/resolve-shorturl', { url });
}
