import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';

const endpoint = (compId: string) => apiUrl(`/v1/comp/${encodeURIComponent(compId)}/absences`);

export async function fetchCompAbsences(compId: string, signal?: AbortSignal): Promise<string[]> {
  const result = await handleApi<{ wcaIds: string[] }>(await fetch(endpoint(compId), { cache: 'no-store', signal }));
  return result.wcaIds;
}

export async function setCompAbsent(compId: string, wcaId: string, absent: boolean): Promise<void> {
  await handleApi(await sessionFetch(`${endpoint(compId)}/${encodeURIComponent(wcaId)}`, {
    method: absent ? 'PUT' : 'DELETE', headers: authHeaders(false),
  }));
}
