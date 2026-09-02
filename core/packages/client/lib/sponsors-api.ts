/**
 * /v1/sponsors + /v1/contributors — /support 致谢墙(赞助者 + 贡献者)API。
 * server 实现 routes/sponsors.ts;写操作走 ADMIN_WCA_IDS WCA OAuth Bearer / X-Admin-Key。
 */
import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi } from './admin-api';

const BASE = API_ORIGIN + '/v1/sponsors';
// claimed 字段加入公开响应后升级读取 URL，避免浏览器继续复用旧版 1h 缓存。
const LIST_BASE = `${BASE}?v=2`;

export interface Sponsor {
  id: number;
  name: string;
  amount: number;
  currency: string;
  wcaId?: string;
  avatarUrl?: string;
  message?: string;
  claimed: boolean;
}

export interface SponsorInput {
  name: string;
  amount: number;
  currency?: string;
  wcaId?: string | null;
  avatarUrl?: string | null;
  message?: string | null;
}

export async function listSponsors(fresh = false): Promise<Sponsor[]> {
  const url = fresh ? `${LIST_BASE}&fresh=${Date.now()}` : LIST_BASE;
  return handleApi<Sponsor[]>(await fetch(url, fresh ? { cache: 'no-store' } : undefined));
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

// ── 赞助认领 ──

export type SponsorClaimStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'revoked';

export interface SponsorClaim {
  id: number;
  sponsorId: number;
  status: SponsorClaimStatus;
  claimantNote: string | null;
  profileSnapshot: {
    displayName?: string;
    wcaId?: string | null;
    countryIso2?: string | null;
    profileComplete?: boolean;
  };
  reviewNote: string | null;
  reviewedAt: string | null;
  cancelledAt: string | null;
  revocationNote: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sponsor: { name: string; amount: number; currency: string };
}

export class SponsorClaimError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SponsorClaimError';
    this.code = code;
  }
}

async function handleClaimApi<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
  throw new SponsorClaimError(data.error || `HTTP ${res.status}`, data.code);
}

const CLAIMS_BASE = API_ORIGIN + '/v1/sponsor-claims';

export async function listMySponsorClaims(): Promise<SponsorClaim[]> {
  return handleClaimApi<SponsorClaim[]>(await fetch(`${CLAIMS_BASE}/mine`, { headers: authHeaders() }));
}

export async function createSponsorClaim(sponsorId: number, note: string): Promise<{
  id: number; status: SponsorClaimStatus; autoApproved: boolean;
}> {
  return handleClaimApi(await fetch(`${BASE}/${sponsorId}/claims`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ note }),
  }));
}

export async function cancelSponsorClaim(id: number): Promise<{ ok: boolean }> {
  return handleClaimApi(await fetch(`${CLAIMS_BASE}/${id}`, { method: 'DELETE', headers: authHeaders() }));
}

export async function listSponsorClaims(status?: SponsorClaimStatus): Promise<SponsorClaim[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return handleClaimApi<SponsorClaim[]>(await fetch(`${CLAIMS_BASE}${suffix}`, { headers: authHeaders() }));
}

export async function reviewSponsorClaim(
  id: number,
  decision: 'approve' | 'reject',
  note: string,
): Promise<{ ok: boolean; status: SponsorClaimStatus }> {
  return handleClaimApi(await fetch(`${CLAIMS_BASE}/${id}/review`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ decision, note }),
  }));
}

export async function unclaimSponsor(id: number, note: string): Promise<{ ok: boolean }> {
  return handleClaimApi(await fetch(`${BASE}/${id}/unclaim`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ note }),
  }));
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
