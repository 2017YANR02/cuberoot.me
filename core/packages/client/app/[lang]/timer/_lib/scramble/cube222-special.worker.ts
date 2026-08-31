/**
 * Timer 2x2 special-state generator, isolated from timing input.
 *
 * The actual generator lives in the runtime-neutral puzzle-solvers package so
 * Android, iOS, and Web share one state model and one family predicate. This
 * worker is only the Web scheduling adapter: rejection sampling / IDA* must not
 * run on the timer's keypress thread.
 */

/// <reference lib="webworker" />

import {
  generate222SpecialScramble,
  type Cube222SpecialType,
} from '@cuberoot/puzzle-solvers/cube222';
import type { TimerWorkerRpcResponse } from '@cuberoot/shared/timer';

interface Req {
  id: number;
  type: Cube222SpecialType;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (event: MessageEvent<Req>) => {
  const { id, type } = event.data;
  try {
    ctx.postMessage({
      id,
      ok: true,
      value: generate222SpecialScramble(type),
    } satisfies TimerWorkerRpcResponse<string>);
  } catch (error) {
    ctx.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies TimerWorkerRpcResponse<string>);
  }
});

export {};
