import { RequestError } from '@app-foundation/workspace-ui';
import { authHeaders } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';
import { sessionFetch } from '@/lib/session-fetch';

export type Revision = { version: number; filename: string; mime: string; createdAt: number };
export type Contract = Revision & { id: string; userId: number; title: string; name: string };
export async function requestContract(action: string, init?: RequestInit) {
  const response = await sessionFetch(apiUrl(`/v1/workspace/${action}`), {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000), headers: authHeaders(!!init?.body), ...init,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new RequestError(data.error || '合同服务暂不可用 / Contracts unavailable', response.status);
  }
  return response;
}
export const asContractError = (error: unknown) => error instanceof RequestError ? error : new RequestError('操作失败，请重试 / Request failed; try again', 0);
