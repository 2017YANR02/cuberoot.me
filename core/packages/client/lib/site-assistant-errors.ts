import { ASSISTANT_ERROR_TEXT, type AssistantErrorCode } from '@cuberoot/shared/site-assistant';
export { ASSISTANT_ERROR_TEXT } from '@cuberoot/shared/site-assistant';

export function assistantResponseError(response: Pick<Response, 'status' | 'headers'>, body: unknown): AssistantErrorCode {
  const data = body && typeof body === 'object' ? body as { error?: unknown; code?: unknown } : {};
  if (response.headers.get('x-cuberoot-verification-required') === '1' || response.headers.get('x-vercel-mitigated') === 'challenge' || data.code === 'competition_verification_required') return 'verification_required';
  if (typeof data.error === 'string' && Object.hasOwn(ASSISTANT_ERROR_TEXT, data.error)) return data.error as AssistantErrorCode;
  if (response.status === 401) return 'login_required';
  if (response.status === 429) return 'busy';
  if (response.status === 504 || response.status === 408) return 'timeout';
  return 'unavailable';
}
