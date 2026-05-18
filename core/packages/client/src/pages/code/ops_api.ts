// /code/ops 数据 CRUD.
// 公共 GET 无认证;admin 写端点走 WCA OAuth Bearer (ADMIN_WCA_IDS) 或 X-Admin-Key.
import { API_ORIGIN } from '../../utils/api_base';
import { authHeaders, handleApi } from '../../utils/admin_api';

const BASE = API_ORIGIN + '/v1/ops/commands';

export interface OpsCommandInput {
  id?: string;             // POST 必填,PUT 不需要
  category: string;
  cwd?: string | null;
  chips: { zh: string; en: string }[];
  title_zh: string;
  title_en: string;
  desc_zh: string;
  desc_en: string;
  cmd: string;
  variants: { zh: { label: string; note: string }; en: { label: string; note: string }; cmd: string }[];
}

export async function listCommands<T>(): Promise<T[]> {
  const r = await fetch(BASE);
  return handleApi<T[]>(r);
}

export async function createCommand<T>(body: OpsCommandInput): Promise<T> {
  const r = await fetch(BASE, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  return handleApi<T>(r);
}

export async function updateCommand<T>(id: string, body: OpsCommandInput): Promise<T> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
  return handleApi<T>(r);
}

export async function deleteCommand(id: string): Promise<{ ok: boolean; id: string }> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
  return handleApi<{ ok: boolean; id: string }>(r);
}

export async function reorderCommands(category: string, ids: string[]): Promise<{ ok: boolean }> {
  const r = await fetch(`${BASE}/reorder`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ category, ids }) });
  return handleApi<{ ok: boolean }>(r);
}
