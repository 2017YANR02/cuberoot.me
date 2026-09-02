import {
  CloudOptimalScrambleHttpError,
  requestCloudOptimalScramble,
  type CloudOptimalScramblePhase,
  type CloudOptimalScrambleResult,
} from '@cuberoot/shared/timer';
import { streamApiUrl } from './api-base';
import { authHeaders } from './admin-api';
import { useAuthStore } from './auth-store';

export { firstBadHtmToken } from '@cuberoot/shared/timer';
export type { CloudOptimalScramblePhase, CloudOptimalScrambleResult };

/** Website adapter for the shared cloud-optimal protocol. */
export function cloudOptimalScramble(
  scramble: string,
  onPhase?: (phase: CloudOptimalScramblePhase) => void,
  signal?: AbortSignal,
): Promise<CloudOptimalScrambleResult> {
  const headers = authHeaders();
  return requestCloudOptimalScramble(scramble, {
    url: streamApiUrl('/v1/scramble/optimal-solve'),
    headers,
    onPhase,
    signal,
  }).catch((error: unknown) => {
    if (error instanceof CloudOptimalScrambleHttpError
      && error.status === 401
      && headers.Authorization
      && authHeaders().Authorization === headers.Authorization) {
      useAuthStore.getState().logout();
    }
    throw error;
  });
}
