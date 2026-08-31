/**
 * Web scheduling adapter for the shared Kilominx/Master Pyraminx provider.
 * Puzzle algorithms live in @cuberoot/puzzle-solvers; this worker only keeps
 * their synchronous prune-table work off the timer input thread.
 */

/// <reference lib="webworker" />

import {
  generateCstimerNonWcaTimerScramble,
  type CstimerNonWcaTimerEvent,
} from '@cuberoot/puzzle-solvers/cstimer-nonwca';
import type { TimerWorkerRpcResponse } from '@cuberoot/shared/timer';

interface Request {
  id: number;
  event: CstimerNonWcaTimerEvent;
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

// cstimer_module also exposes its generic worker protocol. This Timer worker
// owns a narrower typed RPC, so discard that property handler after import.
workerScope.onmessage = null;

workerScope.addEventListener('message', (message: MessageEvent<Request>) => {
  const { id, event } = message.data;
  try {
    workerScope.postMessage({
      id,
      ok: true,
      value: generateCstimerNonWcaTimerScramble(event),
    } satisfies TimerWorkerRpcResponse<string>);
  } catch (error) {
    workerScope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies TimerWorkerRpcResponse<string>);
  }
});

export {};
