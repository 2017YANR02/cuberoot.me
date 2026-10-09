import { sessionFetch } from '@/lib/session-fetch';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';

const HOME_ORDER_PATH = '/v1/nav/home-order';
const HOME_LOCKS_PATH = '/v1/nav/home-locks';

export async function getHomeCardLocks(): Promise<Record<string, boolean>> {
  return (await handleApi<{ locks: Record<string, boolean> }>(await sessionFetch(apiUrl(HOME_LOCKS_PATH), { cache: 'no-store' }))).locks;
}

export async function setHomeCardLock(id: string, locked: boolean): Promise<{ ok: boolean }> {
  return handleApi(await sessionFetch(apiUrl(HOME_LOCKS_PATH), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify({ id, locked }),
  }));
}

export async function getHomeCardOrders(fresh = false): Promise<Record<string, string[]>> {
  const response = await sessionFetch(apiUrl(HOME_ORDER_PATH), fresh ? { cache: 'no-cache' } : undefined);
  return (await handleApi<{ orders: Record<string, string[]> }>(response)).orders;
}

export async function reorderHomeCards(groupId: string, ids: string[]): Promise<{ ok: boolean }> {
  const response = await sessionFetch(apiUrl(HOME_ORDER_PATH), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ groupId, ids }),
  });
  return handleApi(response);
}
