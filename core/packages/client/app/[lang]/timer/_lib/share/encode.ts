import type { Solve } from '@cuberoot/shared/timer';
import { encodeReplayUrl as encodeSharedReplayUrl } from '@cuberoot/shared/timer/replay-encode';
export { encodeReplayPayload, type ReplayPayload } from '@cuberoot/shared/timer/replay-encode';

export function encodeReplayUrl(solve: Solve): string {
  return encodeSharedReplayUrl(solve, window.location.href);
}
