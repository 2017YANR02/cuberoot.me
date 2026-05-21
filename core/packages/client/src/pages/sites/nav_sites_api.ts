/**
 * /v1/nav/sites — 网址导航 (admin 编辑) API。
 * server 实现 routes/nav_sites.ts;鉴权走 ADMIN_WCA_IDS WCA OAuth Bearer。
 */
import { API_ORIGIN } from '../../utils/api_base';
import { authHeaders, handleApi } from '../../utils/admin_api';
import type { Site } from './data/types';

const BASE = API_ORIGIN + '/v1/nav/sites';

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
  return handleApi<Site[]>(await fetch(BASE));
}
export async function createSite(body: SiteInput): Promise<Site> {
  return handleApi<Site>(await fetch(BASE, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }));
}
export async function updateSite(id: number, body: SiteInput): Promise<Site> {
  return handleApi<Site>(await fetch(`${BASE}/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }));
}
export async function deleteSite(id: number): Promise<{ ok: boolean }> {
  return handleApi<{ ok: boolean }>(await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders() }));
}
export async function reorderGroup(groupId: Site['group'], ids: number[]): Promise<{ ok: boolean }> {
  return handleApi<{ ok: boolean }>(
    await fetch(`${BASE}/reorder`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ groupId, ids }) }),
  );
}
