/**
 * /v1/nav/sites — 网址导航 (admin 编辑) API。
 * server 实现 routes/nav_sites.ts;鉴权走 ADMIN_WCA_IDS WCA OAuth Bearer。
 */
import { API_ORIGIN } from '../../utils/api_base';
import type { Site } from './data/types';

const BASE = API_ORIGIN + '/v1/nav/sites';

function token(): string | null {
  return localStorage.getItem('cuberoot_jwt') || localStorage.getItem('wca_access_token');
}
function authHeaders(): HeadersInit {
  const t = token();
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}
async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(e.error || `API error ${r.status}`);
  }
  return r.json();
}

export interface SiteInput {
  group: Site['group'];
  name: string;
  name_en?: string | null;
  name_zh?: string | null;
  url: string;
  alt_urls?: string[] | null;
  author?: string | null;
  desc_en?: string | null;
  desc_zh?: string | null;
  youtube?: string | null;
  tags?: string[] | null;
  status?: 'dead' | null;
}

export async function listSites(): Promise<Site[]> {
  return handle<Site[]>(await fetch(BASE));
}
export async function createSite(body: SiteInput): Promise<Site> {
  return handle<Site>(await fetch(BASE, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }));
}
export async function updateSite(id: number, body: SiteInput): Promise<Site> {
  return handle<Site>(await fetch(`${BASE}/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }));
}
export async function deleteSite(id: number): Promise<{ ok: boolean }> {
  return handle<{ ok: boolean }>(await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders() }));
}
export async function reorderGroup(groupId: Site['group'], ids: number[]): Promise<{ ok: boolean }> {
  return handle<{ ok: boolean }>(
    await fetch(`${BASE}/reorder`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ groupId, ids }) }),
  );
}
