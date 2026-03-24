/**
 * Recon API 客户端——1:1 移植自 recon/recon_api.js（161 行）
 * NOTE: 封装所有复盘后端 API 调用，使用 fetch + Bearer token 认证
 *
 * 已迁移到 Fastify RESTful 风格（/api/recon/xxx）
 */
import type {
  ReconSolve, ReconComment, EditHistoryItem,
} from '@cuberoot/shared';
import { getWcaId } from '../stores/auth_store';

// NOTE: API 基础路径
// 开发环境走 Vite proxy（/trainer/api/recon → localhost:3001/api/recon）
// 生产环境可通过环境变量覆盖
const API_BASE = import.meta.env.VITE_RECON_API_BASE || '/trainer/api/recon';

// ── 认证 ──

/** 获取 WCA OAuth token（从 localStorage） */
function getToken(): string | null {
  return localStorage.getItem('wca_access_token');
}

/** 构建带 Bearer token 的 headers */
function authHeaders(json = true): HeadersInit {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ── 通用请求 ──

/** GET 请求（路径段 + query params） */
async function apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString(), { headers: authHeaders(false) });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `API error ${resp.status}`);
  }
  return resp.json();
}

/** POST 请求 */
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`, window.location.origin);
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `API error ${resp.status}`);
  }
  return resp.json();
}

/** PUT 请求 */
async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`, window.location.origin);
  const resp = await fetch(url.toString(), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `API error ${resp.status}`);
  }
  return resp.json();
}

/** DELETE 请求 */
async function apiDelete<T>(path: string): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`, window.location.origin);
  const resp = await fetch(url.toString(), {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `API error ${resp.status}`);
  }
  return resp.json();
}

// ── Recon CRUD ──

/** 获取全部复盘（可按选手 WCA ID 筛选） */
export async function listRecons(wcaId?: string): Promise<ReconSolve[]> {
  return apiGet<ReconSolve[]>('list', wcaId ? { wcaId } : {});
}

/** 获取单条复盘（含编辑覆盖层合并） */
export async function getRecon(id: number): Promise<ReconSolve> {
  return apiGet<ReconSolve>(String(id));
}

/** 新增复盘 */
export async function addRecon(solve: Partial<ReconSolve>): Promise<ReconSolve> {
  return apiPost<ReconSolve>('', solve);
}

/** 更新复盘指定字段 */
export async function updateRecon(id: number, fields: Partial<ReconSolve>): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(String(id), fields);
}

/** 删除复盘 */
export async function deleteRecon(id: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(String(id));
}

// ── 编辑覆盖层（阶段 3 迁移，暂用 PHP） ──

/** 加载所有编辑覆盖 */
export async function loadEdits(): Promise<Record<string, Record<string, unknown>>> {
  return apiGet('edits');
}

/** 保存编辑覆盖 */
export async function saveEdit(solveId: string, fields: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiPost('save-edit', { solveId, fields });
}

/** 删除编辑覆盖 */
export async function deleteEdit(solveId: string): Promise<{ ok: boolean }> {
  return apiDelete(`edit/${solveId}`);
}

// ── 编辑历史（阶段 3 迁移） ──

/** 保存编辑历史快照 */
export async function saveEditHistory(
  solveId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  return apiPost('save-history', {
    solveId,
    before,
    after,
    editedBy: getWcaId(),
  });
}

/** 获取编辑历史 */
export async function getEditHistory(solveId: string): Promise<EditHistoryItem[]> {
  return apiGet<EditHistoryItem[]>('history', { id: solveId });
}

// ── 评论（阶段 2 迁移） ──

/** 获取复盘的评论列表 */
export async function listComments(reconId: number): Promise<ReconComment[]> {
  return apiGet<ReconComment[]>('comments', { reconId: String(reconId) });
}

/** 新增评论 */
export async function addComment(reconId: number, content: string): Promise<{ ok: boolean; id: number }> {
  return apiPost('comments', { reconId, content });
}

/** 更新评论 */
export async function updateComment(commentId: number, content: string): Promise<{ ok: boolean }> {
  return apiPut(`comments/${commentId}`, { content });
}

/** 删除评论 */
export async function deleteComment(commentId: number): Promise<{ ok: boolean }> {
  return apiDelete(`comments/${commentId}`);
}

// ── 重复检测 ──

interface DuplicateResult {
  exists: boolean;
  id?: number;
}

/** 检查是否存在重复复盘 */
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
  return apiGet<DuplicateResult>('check-duplicate', queryParams);
}

// ── 选手/比赛搜索 ──

interface SolverResult {
  name: string;
  iso2: string;
  wcaId: string;
}

/** 搜索选手（通过后端代理 WCA API） */
export async function searchSolvers(query: string): Promise<SolverResult[]> {
  if (query.length < 2) return [];
  return apiGet<SolverResult[]>('search-solvers', { q: query });
}

interface PersonRecord {
  person: string;
  person_id: string;
  person_country: string | null;
}

/** 获取已有选手列表（数据库中有 WCA ID 的选手） */
export async function listPersons(): Promise<PersonRecord[]> {
  return apiGet<PersonRecord[]>('list-persons');
}

/** 获取用户统计 */
export async function getUserStats(wcaId: string): Promise<{ reconCount: number; addedCount: number }> {
  return apiGet('user-stats', { wcaId });
}

// ── WCA 代理（阶段 4 迁移） ──

/** 获取同轮次成绩（通过后端代理 WCA API） */
export async function getWcaAttempts(
  compId: string,
  personId: string,
): Promise<Record<string, { a: number[] }>> {
  return apiGet('wca-attempts', { compId, personId });
}

/** 获取 Bilibili 视频封面（通过后端代理） */
export async function getBiliCover(bvid: string): Promise<{ pic: string }> {
  return apiGet('bili-cover', { bvid });
}
