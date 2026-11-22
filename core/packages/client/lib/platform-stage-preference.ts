import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';

export async function accountLearningStage(signal: AbortSignal, stage?: string, initializeOnly = false) {
  const response = await sessionFetch(apiUrl('/v1/platform/me/learning-stage'), {
    method: stage === undefined ? 'GET' : 'PUT',
    headers: authHeaders(stage !== undefined), signal, cache: 'no-store',
    body: stage === undefined ? undefined : JSON.stringify({stage, initializeOnly}),
  });
  return (await handleApi<{stage: string | null}>(response)).stage;
}
