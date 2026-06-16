// Full port of packages/client-vite/src/utils/recon_api.ts to client.
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

// 同一打乱串的其它复盘(轻量,只回匹配行)。详情页「相同打乱的复盘」用,
// 替代旧的「拉全量 /list 再客户端过滤」。
export async function getSameScramble(id: number): Promise<ReconSolve[]> {
  return apiGet<ReconSolve[]>(`/${id}/same-scramble`);
}

// 个人复盘主页:某选手参与的全部 recon(作为选手 / 合作者 / 复盘者 / 添加者)。
// 返回字段含 addedBy/addedById(LIST_COLUMNS 没有,角色筛选用)。
// 端点未部署(dev 打 prod / 前后端部署错位)时降级:用全量列表按 选手/合作者/复盘者
// 过滤(added_by_id 不在 LIST_COLUMNS,降级模式下「添加者」角色暂缺)。
export async function listPersonRecons(wcaId: string): Promise<ReconSolve[]> {
  try {
    return await apiGet<ReconSolve[]>(`/person/${encodeURIComponent(wcaId)}`);
  } catch {
    const all = await listRecons();
    return all.filter(s =>
      s.personId === wcaId
      || s.reconerId === wcaId
      || (s.coPersons?.some(c => c.id === wcaId) ?? false),
    );
  }
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

// 首页「今日复盘」: 最新录入那天的全部 recon(最新在前)。端点缺失/出错时回退到 /latest 单条,
// 保证旧后端 / dev 代理也能渲染。
export async function getTodayRecons(): Promise<ReconSolve[]> {
  try {
    const r = await apiGet<ReconSolve[]>('/today');
    if (Array.isArray(r) && r.length > 0) return r;
  } catch {
    // fall through to latest fallback
  }
  const latest = await getLatestRecon();
  return latest ? [latest] : [];
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
