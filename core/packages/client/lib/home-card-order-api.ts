import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';

const HOME_ORDER_PATH = '/v1/nav/home-order';

export async function getHomeCardOrders(fresh = false): Promise<Record<string, string[]>> {
  const response = await fetch(apiUrl(HOME_ORDER_PATH), fresh ? { cache: 'no-cache' } : undefined);
  return (await handleApi<{ orders: Record<string, string[]> }>(response)).orders;
}

export async function reorderHomeCards(groupId: string, ids: string[]): Promise<{ ok: boolean }> {
  const response = await fetch(apiUrl(HOME_ORDER_PATH), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ groupId, ids }),
  });
  return handleApi(response);
}
