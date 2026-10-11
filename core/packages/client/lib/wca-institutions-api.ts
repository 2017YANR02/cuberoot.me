import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';

export interface WcaInstitution { id: string; name: string }
export interface WcaInstitutionsResponse {
  institutions: WcaInstitution[];
  assignments: Array<{ studentKey: string; institutionId: string }>;
}
export async function listWcaInstitutions(studentKeys: string[]): Promise<WcaInstitutionsResponse> {
  const query = new URLSearchParams({ students: studentKeys.join(','), v: '1' });
  return handleApi(await sessionFetch(apiUrl(`/v1/wca/training-institutions?${query}`), { cache: 'no-store' }));
}
export async function saveWcaInstitution(studentKey: string, institutionId: string | null): Promise<void> {
  await handleApi(await sessionFetch(apiUrl(`/v1/wca/training-institutions/${encodeURIComponent(studentKey)}`), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify({ institutionId }),
  }));
}
