/**
 * Web Worker generating cross-trainer states (see lib/cross-trainer).
 *
 * Off the main thread because the exact distance tables cost ~0.3 s (cross) to ~10 s (XXCross)
 * to build, and the timer measures start/stop with performance.now() inside the keypress
 * handler — a table build on the main thread would land inside a solve.
 *
 * Protocol is the shared timer Worker RPC envelope; payloads/results are typed in trainer_pool.
 *
 * A `gen` builds the stage's tables before its bounded batch, so there is no separate warm request
 * to queue ahead of the work the user is waiting for.
 *
 * `verdict` is the important part: 'empty' means no cube has this difficulty (a proof), 'budget'
 * means this attempt ran out of time — a cold build, a rare window, a busy machine. The caller
 * must never turn 'budget' into "this difficulty does not exist".
 *
 * States, not scrambles: turning a state into notation is min2phase's job (WASM, a few ms) and it
 * lives on the main thread already.
 */

/// <reference lib="webworker" />

import { frameLabel, trainerSolution } from '@/lib/cross-trainer';
import { createTrainerStateBatchSampler } from '@cuberoot/puzzle-solvers/cross-trainer/batch';
import type { TimerWorkerRpcResponse } from '@cuberoot/shared/timer/worker-rpc';
import type { WebTrainerWorkerRequest, WebTrainerWorkerResult } from './trainer_pool';

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
const sampleBatch = createTrainerStateBatchSampler();

ctx.addEventListener('message', (ev: MessageEvent<{ id: number; request: WebTrainerWorkerRequest }>) => {
  const { id, request } = ev.data;
  try {
    let value: WebTrainerWorkerResult;
    if (request.kind === 'solve') {
      const sol = trainerSolution(request.spec, request.state);
      // `null`, not '': a 0-move case IS a legitimate answer (the stage is already solved), so an
      // empty string cannot double as "no answer" — the caller would flip the panel open on nothing.
      value = {
        kind: 'solved',
        notation: sol ? sol.notation : null,
        frame: sol ? frameLabel(sol.frame, request.isZh) : '',
      };
    } else {
      const batch = sampleBatch(request.spec, request.count, request.budgetMs);
      value = {
        kind: 'generated',
        states: batch.items.map((item) => item.state),
        depths: batch.items.map((item) => item.depth),
        verdict: batch.verdict,
      };
    }
    ctx.postMessage({ id, ok: true, value } satisfies TimerWorkerRpcResponse<WebTrainerWorkerResult>);
  } catch (e: unknown) {
    ctx.postMessage({
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    } satisfies TimerWorkerRpcResponse<WebTrainerWorkerResult>);
  }
});

export {};
