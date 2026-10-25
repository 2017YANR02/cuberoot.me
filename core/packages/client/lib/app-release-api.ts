/** Administrator release control. Credentials are attached only to our API. */
import type { AppReleaseRequest, AppReleaseStatus } from '@cuberoot/shared/android-release';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';

export async function fetchAppReleaseStatus(signal?: AbortSignal): Promise<AppReleaseStatus> {
  return handleApi(await sessionFetch(apiUrl('/v1/admin/app-releases'), { headers: authHeaders(false), cache: 'no-store', signal }));
}
export async function publishAppRelease(request: AppReleaseRequest): Promise<{ requestId: string; state: string }> {
  const response = await sessionFetch(apiUrl('/v1/admin/app-releases'), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(request), signal: AbortSignal.timeout(60_000),
  });
  try { return await handleApi(response); }
  catch (error) { throw Object.assign(error as Error, { status: response.status }); }
}
