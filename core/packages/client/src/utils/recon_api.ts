/**
 * Recon API 客户端
 * NOTE: 对齐 Hono 后端 RESTful 路由（/v1/recon/xxx）
 */
import type {
  ReconSolve, ReconComment, EditHistoryItem, ReconAlternative,
} from '@cuberoot/shared';
import { getWcaId } from '../stores/auth_store';
import { API_ORIGIN } from './api_base';
import { authHeaders, handleApi } from './admin_api';

const API_BASE = API_ORIGIN + '/v1/recon';

// ── 通用请求（RESTful 风格） ──

async function apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
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
// NOTE: 对齐 Hono routes/recon.ts 的 RESTful 路由

/** 获取全部复盘（可按选手 WCA ID 筛选） */
// 后端: GET /v1/recon/list
export async function listRecons(wcaId?: string): Promise<ReconSolve[]> {
  return apiGet<ReconSolve[]>('/list', wcaId ? { wcaId } : {});
}

/** 获取单条复盘（含编辑覆盖层合并） */
// 后端: GET /v1/recon/:id
export async function getRecon(id: number): Promise<ReconSolve> {
  return apiGet<ReconSolve>(`/${id}`);
}

/** 新增复盘 */
// 后端: POST /v1/recon
export async function addRecon(solve: Partial<ReconSolve>): Promise<ReconSolve> {
  return apiPost<ReconSolve>('', solve);
}

/** 更新复盘指定字段 */
// 后端: PUT /v1/recon/:id
export async function updateRecon(id: number, fields: Partial<ReconSolve>): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/${id}`, fields);
}

/** 删除复盘 */
// 后端: DELETE /v1/recon/:id
export async function deleteRecon(id: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/${id}`);
}

// ── 另解 (Alternatives) ──

interface AltsResponse { alternatives: ReconAlternative[] }

/** 追加另解(任何登录用户都能投) */
export async function addAlternative(reconId: number, solution: string): Promise<ReconAlternative[]> {
  const r = await apiPost<AltsResponse>(`/${reconId}/alternatives`, { solution });
  return r.alternatives;
}

/** 改某条另解(只有作者或 admin) */
export async function updateAlternative(reconId: number, idx: number, solution: string): Promise<ReconAlternative[]> {
  const r = await apiPut<AltsResponse>(`/${reconId}/alternatives/${idx}`, { solution });
  return r.alternatives;
}

/** 删某条另解(只有作者或 admin) */
export async function deleteAlternative(reconId: number, idx: number): Promise<ReconAlternative[]> {
  const r = await apiDelete<AltsResponse>(`/${reconId}/alternatives/${idx}`);
  return r.alternatives;
}

// ── 编辑覆盖层 ──

/** 加载所有编辑覆盖 */
// 后端: GET /v1/recon/edits
export async function loadEdits(): Promise<Record<string, Record<string, unknown>>> {
  return apiGet('/edits');
}

/** 保存编辑覆盖 */
// 后端: POST /v1/recon/save-edit
export async function saveEdit(solveId: string, fields: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiPost('/save-edit', { solveId, fields });
}

/** 删除编辑覆盖 */
// 后端: DELETE /v1/recon/edit/:id
export async function deleteEdit(solveId: string): Promise<{ ok: boolean }> {
  return apiDelete(`/edit/${solveId}`);
}

// ── 编辑历史 ──

/** 保存编辑历史快照 */
// 后端: POST /v1/recon/save-history
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

/** 获取编辑历史 */
// 后端: GET /v1/recon/history?id=xxx
export async function getEditHistory(solveId: string): Promise<EditHistoryItem[]> {
  return apiGet<EditHistoryItem[]>('/history', { id: solveId });
}

// ── 评论 ──

/** 获取复盘的评论列表 */
// 后端: GET /v1/recon/comments?reconId=xxx
export async function listComments(reconId: number): Promise<ReconComment[]> {
  return apiGet<ReconComment[]>('/comments', { reconId: String(reconId) });
}

/** 新增评论；parentId 非 null 则为回复（单层 YouTube 风格） */
// 后端: POST /v1/recon/comments
export async function addComment(reconId: number, content: string, parentId: number | null = null): Promise<{ ok: boolean; id: number }> {
  return apiPost('/comments', { reconId, content, parentId });
}

/** 更新评论 */
// 后端: PUT /v1/recon/comments/:id
export async function updateComment(commentId: number, content: string): Promise<{ ok: boolean }> {
  return apiPut(`/comments/${commentId}`, { content });
}

/** 置顶 / 取消置顶评论（仅管理员） */
// 后端: PUT /v1/recon/comments/:id/pin
export async function pinComment(commentId: number, pinned: boolean): Promise<{ ok: boolean }> {
  return apiPut(`/comments/${commentId}/pin`, { pinned });
}

/** 删除评论 */
// 后端: DELETE /v1/recon/comments/:id
export async function deleteComment(commentId: number): Promise<{ ok: boolean }> {
  return apiDelete(`/comments/${commentId}`);
}

// ── 重复检测 ──

interface DuplicateResult {
  exists: boolean;
  id?: number;
}

/** 检查是否存在重复复盘 */
// 后端: GET /v1/recon/check-duplicate
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

// ── 选手/比赛搜索 ──

interface SolverResult {
  name: string;
  iso2: string;
  wcaId: string;
}

/** 搜索选手（通过后端代理 WCA API） */
// 后端: GET /v1/recon/search-solvers
export async function searchSolvers(query: string): Promise<SolverResult[]> {
  if (query.length < 2) return [];
  return apiGet<SolverResult[]>('/search-solvers', { q: query });
}

interface PersonRecord {
  person: string;
  person_id: string;
  person_country: string | null;
}

/** 获取已有选手列表（数据库中有 WCA ID 的选手） */
// 后端: GET /v1/recon/list-persons
export async function listPersons(): Promise<PersonRecord[]> {
  return apiGet<PersonRecord[]>('/list-persons');
}

/** 获取用户统计 */
// 后端: GET /v1/recon/user-stats
export async function getUserStats(wcaId: string): Promise<{ reconCount: number; addedCount: number }> {
  return apiGet('/user-stats', { wcaId });
}

// ── WCA 代理 ──

/** 获取同轮次成绩（通过后端代理 WCA API） */
// 后端: GET /v1/recon/wca-attempts
export async function getWcaAttempts(
  compId: string,
  personId: string,
): Promise<Record<string, { a: number[] }>> {
  return apiGet('/wca-attempts', { compId, personId });
}

/** 获取 Bilibili 视频封面（通过后端代理） */
// 后端: GET /v1/recon/bili-cover
export async function getBiliCover(bvid: string): Promise<{ pic: string }> {
  return apiGet('/bili-cover', { bvid });
}

/** 把 b23.tv 短链展开成完整 bilibili.com URL(通过后端代理 follow redirect) */
// 后端: GET /v1/recon/resolve-shorturl
export async function resolveShortUrl(url: string): Promise<{ url: string }> {
  return apiGet('/resolve-shorturl', { url });
}
