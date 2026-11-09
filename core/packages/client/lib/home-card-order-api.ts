import { sessionFetch } from '@/lib/session-fetch';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { parseHomeLocks, parseHomeOrders, type HomeLayoutSnapshot } from './home-layout';

const HOME_ORDER_PATH = '/v1/nav/home-order';
const HOME_LOCKS_PATH = '/v1/nav/home-locks';

export async function getHomeCardLocks(signal?: AbortSignal): Promise<Record<string, boolean>> {
  return parseHomeLocks(await handleApi(await sessionFetch(apiUrl(HOME_LOCKS_PATH), { cache: 'no-store', signal })));
}

export async function getHomeLayout(signal?: AbortSignal): Promise<HomeLayoutSnapshot> {
  const [locks, orders] = await Promise.all([getHomeCardLocks(signal), getHomeCardOrders(false, signal)]);
  return { locks, orders };
}

export async function setHomeCardLock(id: string, locked: boolean): Promise<{ ok: boolean }> {
  return handleApi(await sessionFetch(apiUrl(HOME_LOCKS_PATH), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify({ id, locked }),
  }));
}

export async function getHomeCardOrders(_fresh = false, signal?: AbortSignal): Promise<Record<string, string[]>> {
  const response = await sessionFetch(apiUrl(HOME_ORDER_PATH), { cache: 'no-cache', signal });
  return parseHomeOrders(await handleApi(response));
}

export async function reorderHomeCards(groupId: string, ids: string[]): Promise<{ ok: boolean }> {
  const response = await sessionFetch(apiUrl(HOME_ORDER_PATH), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ groupId, ids }),
  });
  return handleApi(response);
}
