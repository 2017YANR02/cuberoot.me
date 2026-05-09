/**
 * /memo/colpi 后端 API 客户端。所有词数据来自 PG (colpi_words / colpi_votes)。
 * Auth 走 wca_access_token / cuberoot_jwt（同 alg_sets_api 模式）。
 */
import { API_ORIGIN } from './api_base';

const BASE = API_ORIGIN + '/v1/colpi';

export type Category =
  | 'unspecified' | 'object' | 'person' | 'action' | 'place' | 'other';

export interface Submitter {
  wcaId: string;
  name: string;
  country: string | null;
}

export interface ColpiWord {
  id: number;
  pair: string;
  word: string;
  category: Category;
  offensive: boolean;
  score: number;
  submitter?: Submitter;     // 缺省 = 上游镜像
  myVote?: -1 | 1;           // 仅当用户已登录且投过票
  createdAt: string;
  updatedAt: string;
}

function getToken(): string | null {
  return localStorage.getItem('cuberoot_jwt') || localStorage.getItem('wca_access_token');
}

function headers(json = true): HeadersInit {
  const token = getToken();
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || `HTTP ${r.status}`);
  }
  return r.json();
}

export async function fetchWords(): Promise<Record<string, ColpiWord[]>> {
  return handle(await fetch(`${BASE}/words`, { headers: headers(false) }));
}

export async function fetchRecent(limit = 20): Promise<ColpiWord[]> {
  return handle(await fetch(`${BASE}/recent?limit=${limit}`, { headers: headers(false) }));
}

export interface SubmitInput {
  pair: string;
  word: string;
  category: Category;
  country?: string | null;
}

export async function submitWord(body: SubmitInput): Promise<ColpiWord> {
  return handle(await fetch(`${BASE}/words`, {
    method: 'POST', headers: headers(), body: JSON.stringify(body),
  }));
}

export interface PatchInput {
  word?: string;
  category?: Category;
  offensive?: boolean;       // 仅 admin 可改
}

export async function patchWord(id: number, body: PatchInput): Promise<ColpiWord> {
  return handle(await fetch(`${BASE}/words/${id}`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify(body),
  }));
}

export async function deleteWord(id: number): Promise<void> {
  const r = await fetch(`${BASE}/words/${id}`, { method: 'DELETE', headers: headers(false) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || `HTTP ${r.status}`);
  }
}

export async function setVote(id: number, dir: 1 | -1): Promise<{ score: number; myVote: 1 | -1 }> {
  return handle(await fetch(`${BASE}/words/${id}/vote`, {
    method: 'PUT', headers: headers(), body: JSON.stringify({ dir }),
  }));
}

export async function clearVote(id: number): Promise<{ score: number; myVote: null }> {
  return handle(await fetch(`${BASE}/words/${id}/vote`, {
    method: 'DELETE', headers: headers(false),
  }));
}
