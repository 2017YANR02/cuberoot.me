/**
 * Capacitor/Vite scheduling adapter for the shared 2x2 specialist generator.
 *
 * State sampling, predicates, and solving stay in puzzle-solvers. Keeping this
 * worker intentionally tiny prevents Android, iOS, and Web from gaining
 * separate scramble implementations.
 */

/// <reference lib="webworker" />

import {
  generate222SpecialScramble,
  type Cube222SpecialType,
} from '@cuberoot/puzzle-solvers/cube222';
import type { TimerWorkerRpcResponse } from '@cuberoot/shared/timer';

interface Request {
  id: number;
  type: Cube222SpecialType;
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener('message', (event: MessageEvent<Request>) => {
  const { id, type } = event.data;
  try {
    workerScope.postMessage({
      id,
      ok: true,
      value: generate222SpecialScramble(type),
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
