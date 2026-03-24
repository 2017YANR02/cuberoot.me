/**
 * Recon API 客户端——1:1 移植自 recon/recon_api.js（161 行）
 * NOTE: 封装所有复盘后端 API 调用，使用 fetch + Bearer token 认证
 *
 * 当前指向原有 PHP 后端，后续迁移到 Fastify 只需改 API_BASE
 */
import type {
  ReconSolve, ReconComment, EditHistoryItem,
} from '@cuberoot/shared';

// NOTE: API 基地址——开发环境通过 Vite proxy 转发，生产环境直接指向后端
const API_BASE = import.meta.env.VITE_RECON_API_BASE || 'https://toolkit.cuberoot.me/recon/api/';

// ── 认证 ──

/** 获取 WCA OAuth token（从 localStorage） */
function getToken(): string | null {
  return localStorage.getItem('wca_token');
}

/** 构建带 Bearer token 的 headers */
function authHeaders(): HeadersInit {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ── 通用请求 ──

/** GET 请求 */
async function apiGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString(), {
    headers: authHeaders(),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `API error ${resp.status}`);
  }
  return resp.json();
}

/** POST 请求 */
async function apiPost<T>(action: string, body: unknown, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
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

// ── Recon CRUD ──

/** 获取全部复盘（可按选手 WCA ID 筛选） */
export async function listRecons(wcaId?: string): Promise<ReconSolve[]> {
  return apiGet<ReconSolve[]>('list', wcaId ? { wcaId } : {});
}

/** 获取单条复盘（含编辑覆盖层合并） */
export async function getRecon(id: number): Promise<ReconSolve> {
  return apiGet<ReconSolve>('get', { id: String(id) });
}

/** 新增复盘 */
export async function addRecon(solve: Partial<ReconSolve>): Promise<ReconSolve> {
  return apiPost<ReconSolve>('add', solve);
}

/** 更新复盘指定字段 */
export async function updateRecon(id: number, fields: Partial<ReconSolve>): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('update', fields, { id: String(id) });
}

/** 删除复盘 */
export async function deleteRecon(id: number): Promise<{ ok: boolean }> {
  return apiGet<{ ok: boolean }>('delete', { id: String(id) });
}

// ── 编辑覆盖层 ──

/** 加载所有编辑覆盖 */
export async function loadEdits(): Promise<Record<string, Record<string, unknown>>> {
  return apiGet('edits');
}

/** 保存编辑覆盖 */
export async function saveEdit(solveId: string, fields: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiPost('saveEdit', { solveId, fields });
}

/** 删除编辑覆盖 */
export async function deleteEdit(solveId: string): Promise<{ ok: boolean }> {
  return apiGet('deleteEdit', { id: solveId });
}

// ── 编辑历史 ──

/** 保存编辑历史快照 */
export async function saveEditHistory(
  solveId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  return apiPost('saveHistory', {
    solveId,
    before,
    after,
    editedBy: localStorage.getItem('wca_wcaId') || '',
  });
}

/** 获取编辑历史 */
export async function getEditHistory(solveId: string): Promise<EditHistoryItem[]> {
  return apiGet<EditHistoryItem[]>('getHistory', { id: solveId });
}

// ── 评论 ──

/** 获取复盘的评论列表 */
export async function listComments(reconId: number): Promise<ReconComment[]> {
  return apiGet<ReconComment[]>('listComments', { reconId: String(reconId) });
}

/** 新增评论 */
export async function addComment(reconId: number, content: string): Promise<{ ok: boolean; id: number }> {
  return apiPost('addComment', { reconId, content });
}

/** 更新评论 */
export async function updateComment(commentId: number, content: string): Promise<{ ok: boolean }> {
  return apiPost('updateComment', { content }, { id: String(commentId) });
}

/** 删除评论 */
export async function deleteComment(commentId: number): Promise<{ ok: boolean }> {
  return apiGet('deleteComment', { id: String(commentId) });
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
  return apiGet<DuplicateResult>('checkDuplicate', queryParams);
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
  return apiGet<SolverResult[]>('searchSolvers', { q: query });
}

interface PersonRecord {
  person: string;
  person_id: string;
  person_country: string | null;
}

/** 获取已有选手列表（数据库中有 WCA ID 的选手） */
export async function listPersons(): Promise<PersonRecord[]> {
  return apiGet<PersonRecord[]>('listPersons');
}

/** 获取用户统计 */
export async function getUserStats(wcaId: string): Promise<{ reconCount: number; addedCount: number }> {
  return apiGet('userStats', { wcaId });
}

// ── WCA 代理 ──

/** 获取同轮次成绩（通过后端代理 WCA API） */
export async function getWcaAttempts(
  compId: string,
  personId: string,
): Promise<Record<string, { a: number[] }>> {
  return apiGet('wcaAttempts', { compId, personId });
}

/** 获取 Bilibili 视频封面（通过后端代理） */
export async function getBiliCover(bvid: string): Promise<{ pic: string }> {
  return apiGet('biliCover', { bvid });
}
