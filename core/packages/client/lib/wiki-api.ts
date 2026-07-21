/**
 * /v1/wiki/* client wrapper.
 *
 * 协作模型:
 *   - seed 词条 (source='seed') 谁都不能改 (admin 例外)
 *   - 用户创建的 term: owner / admin 可改
 *   - 任何登录用户可在任意 term 下增补 (wiki_additions)
 *   - 增补的 owner / admin 可改可软删
 *
 * 1:1 port from packages/client-vite/src/utils/wiki_api.ts.
 */
import { apiUrl } from './api-base';
import { authHeaders, handleApi as handle } from './admin-api';

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
  /** combined「英文 中文」;搜索/slug/兜底。结构化字段缺失时回退显示这个。 */
  head: string;
  body: string;
  /** 结构化双语(0079+);seed 已回填,新建/编辑走这四个。null = 旧行未迁移,回退 combined。 */
  headEn: string | null;
  headZh: string | null;
  bodyEn: string | null;
  bodyZh: string | null;
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
  const r = await fetch(apiUrl('/v1/wiki/terms'), { cache: 'no-store' });
  return handle<WikiList>(r);
}

export interface TermInput { headEn: string; headZh: string; bodyEn: string; bodyZh: string }

export async function createTerm(body: { letter: string } & TermInput): Promise<WikiTerm> {
  const r = await fetch(apiUrl('/v1/wiki/terms'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handle<WikiTerm>(r);
}

export async function updateTerm(id: number, body: TermInput): Promise<WikiTerm> {
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
