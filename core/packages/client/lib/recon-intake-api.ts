import type { ReconIntakeCase, ReconIntakeInput } from '@cuberoot/shared/recon-ground-truth';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';

export async function intakeRequest<T>(path = '', body?: unknown): Promise<T> {
  return handleApi<T>(await sessionFetch(apiUrl('/v1/recon-intake' + path), {
    method: body === undefined ? 'GET' : 'POST', headers: authHeaders(),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
export const submitReconIntake = (id: string, input: ReconIntakeInput) =>
  intakeRequest<ReconIntakeCase>('', { id, input });
