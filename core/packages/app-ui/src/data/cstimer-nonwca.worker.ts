/**
 * Capacitor/Vite scheduling adapter for the shared Kilominx and Master
 * Pyraminx random-state providers. No puzzle logic belongs in this app.
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

// cstimer_module installs a generic property handler when loaded in a worker.
// CubeRoot uses the typed shared RPC below, so discard that extra handler.
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
