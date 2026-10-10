import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';

export interface WcaTeam { id: number; name: string }
export interface WcaTeamsResponse {
  teams: WcaTeam[];
  assignments: Array<{ wcaId: string; teamId: number }>;
}
export async function listWcaTeams(ids: string[]): Promise<WcaTeamsResponse> {
  const params = new URLSearchParams({ persons: ids.join(','), v: '1' });
  return handleApi(await sessionFetch(apiUrl('/v1/wca/teams?' + params), { cache: 'no-store' }));
}
export async function saveWcaTeam(wcaId: string, name: string): Promise<{ team: WcaTeam | null }> {
  return handleApi(await sessionFetch(apiUrl('/v1/wca/teams/' + encodeURIComponent(wcaId)), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name }),
  }));
}
