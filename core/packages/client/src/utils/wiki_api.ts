/**
 * /v1/wiki/* client wrapper.
 *
 * 协作模型:
 *   - seed 词条 (source='seed') 谁都不能改 (admin 例外)
 *   - 用户创建的 term: owner / admin 可改
 *   - 任何登录用户可在任意 term 下增补 (wiki_additions)
 *   - 增补的 owner / admin 可改可软删
 */
import { apiUrl } from './api_base';
import { authHeaders, handleApi as handle } from './admin_api';

export interface WikiAddition {
  id: number;
  termId: number;
  body: string;
  ownerWcaId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikiTerm {
  id: number;
  letter: string;
  position: number;
  head: string;
  body: string;
  source: 'seed' | 'user';
  ownerWcaId: string | null;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  additions: WikiAddition[];
}

export interface WikiSection {
  letter: string;
  entries: WikiTerm[];
}

export interface WikiList { sections: WikiSection[] }

export async function fetchWikiTerms(): Promise<WikiList> {
  // cache: 'no-store' 兜底 — 即使 server header 被中间层覆盖,写操作后的 reload
  // 也保证拿到 fresh 数据。
  const r = await fetch(apiUrl('/v1/wiki/terms'), { cache: 'no-store' });
  return handle<WikiList>(r);
}

export async function createTerm(body: { letter: string; head: string; body: string }): Promise<WikiTerm> {
  const r = await fetch(apiUrl('/v1/wiki/terms'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handle<WikiTerm>(r);
}

export async function updateTerm(id: number, body: { head: string; body: string }): Promise<WikiTerm> {
  const r = await fetch(apiUrl(`/v1/wiki/terms/${id}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handle<WikiTerm>(r);
}

export async function deleteTerm(id: number): Promise<void> {
  const r = await fetch(apiUrl(`/v1/wiki/terms/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok: boolean }>(r);
}

export async function createAddition(termId: number, body: string): Promise<WikiAddition> {
  const r = await fetch(apiUrl(`/v1/wiki/terms/${termId}/additions`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
  return handle<WikiAddition>(r);
}

export async function updateAddition(id: number, body: string): Promise<WikiAddition> {
  const r = await fetch(apiUrl(`/v1/wiki/additions/${id}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
  return handle<WikiAddition>(r);
}

export async function deleteAddition(id: number): Promise<void> {
  const r = await fetch(apiUrl(`/v1/wiki/additions/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok: boolean }>(r);
}
