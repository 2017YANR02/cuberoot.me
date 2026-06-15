/**
 * /v1/sponsors — 致谢/赞助墙 API。
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
