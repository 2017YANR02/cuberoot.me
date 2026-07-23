/**
 * /v1/sponsors + /v1/contributors — /support 致谢墙(赞助者 + 贡献者)API。
 * server 实现 routes/sponsors.ts;写操作走 ADMIN_WCA_IDS WCA OAuth Bearer / X-Admin-Key。
 */
import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi } from './admin-api';

const BASE = API_ORIGIN + '/v1/sponsors';

export interface Sponsor {
  id: number;
  name: string;
  amount: number;
  currency: string;
  wcaId?: string;
  avatarUrl?: string;
  message?: string;
}

export interface SponsorInput {
  name: string;
  amount: number;
  currency?: string;
  wcaId?: string | null;
  avatarUrl?: string | null;
  message?: string | null;
}

export async function listSponsors(): Promise<Sponsor[]> {
  return handleApi<Sponsor[]>(await fetch(BASE));
}
export async function createSponsor(body: SponsorInput): Promise<Sponsor> {
  return handleApi<Sponsor>(await fetch(BASE, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }));
}
export async function updateSponsor(id: number, body: SponsorInput): Promise<Sponsor> {
  return handleApi<Sponsor>(await fetch(`${BASE}/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }));
}
export async function deleteSponsor(id: number): Promise<{ ok: boolean }> {
  return handleApi<{ ok: boolean }>(await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders() }));
}

// ── 贡献者(issue #28:score = 贡献次数,admin 点数字 +1)──

const CONTRIB_BASE = API_ORIGIN + '/v1/contributors';

/** 一次贡献的内容明细。zh/en 至少填一个(展示时缺一回退另一),date 可选(如 "2026-07-16")。 */
export interface Contribution {
  zh: string;
  en: string;
  date?: string;
}

export interface Contributor {
  id: number;
  name: string;
  score: number;
  wcaId?: string;
  avatarUrl?: string;
  /** 每次贡献的内容明细(与 score 解耦,可空)。 */
  contributions: Contribution[];
}

export interface ContributorInput {
  name: string;
  score?: number;
  wcaId?: string | null;
  avatarUrl?: string | null;
  contributions?: Contribution[];
}

// 旧后端 / 1h 缓存的响应可能没有 contributions 字段:补成空数组,让上层能放心 .length。
function normContributor(c: Contributor): Contributor {
  return { ...c, contributions: Array.isArray(c.contributions) ? c.contributions : [] };
}

export async function listContributors(): Promise<Contributor[]> {
  return (await handleApi<Contributor[]>(await fetch(CONTRIB_BASE))).map(normContributor);
}
export async function createContributor(body: ContributorInput): Promise<Contributor> {
  return normContributor(await handleApi<Contributor>(await fetch(CONTRIB_BASE, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })));
}
export async function updateContributor(id: number, body: ContributorInput): Promise<Contributor> {
  return normContributor(await handleApi<Contributor>(await fetch(`${CONTRIB_BASE}/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) })));
}
/** score 原子 +1(admin 点卡片上的数字)。 */
export async function bumpContributor(id: number): Promise<Contributor> {
  return normContributor(await handleApi<Contributor>(await fetch(`${CONTRIB_BASE}/${id}/bump`, { method: 'POST', headers: authHeaders() })));
}
export async function deleteContributor(id: number): Promise<{ ok: boolean }> {
  return handleApi<{ ok: boolean }>(await fetch(`${CONTRIB_BASE}/${id}`, { method: 'DELETE', headers: authHeaders() }));
}
