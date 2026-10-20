import type { TimerHttpFetch } from '@cuberoot/shared/timer/http';
import { ApiError, requestJson } from './auth';

/** Adapts the existing native transport; never forwards account tokens off-origin. */
export const nativeTimerFetch: TimerHttpFetch = async (url, init) => {
  if (!url.startsWith('/v1/')) throw new Error('Unsupported timer API path');
  try {
    const authorization = init?.headers?.Authorization;
    const data = await requestJson(url.slice(3), { signal: init?.signal, method: init?.method,
      body: init?.body === undefined ? undefined : JSON.parse(init.body),
      token: authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined });
    return { ok: true, status: 200, json: async () => data };
  } catch (error) {
    if (!init?.signal?.aborted) console.warn('[native-timer:network]', error instanceof Error ? error.message : String(error));
    return { ok: false, status: error instanceof ApiError ? error.status : 0, json: async () => null };
  }
};
