/// <reference lib="webworker" />

import { formatMoves, type CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { buildMoveTables, type MoveTables } from '@cuberoot/puzzle-solvers/kociemba/movetables';
import { buildPruneTables, type PruneTables } from '@cuberoot/puzzle-solvers/kociemba/prune';
import { scrambleFromState } from '@cuberoot/puzzle-solvers/kociemba/search';
import type { TimerWorkerRpcResponse } from '@cuberoot/shared/timer/worker-rpc';

let moveTables: MoveTables | null = null;
let pruneTables: PruneTables | null = null;

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener('message', (event: MessageEvent<{ id: number; state: CubieCube }>) => {
  const { id, state } = event.data;
  try {
    moveTables ??= buildMoveTables();
    pruneTables ??= buildPruneTables(moveTables);
    const value = formatMoves(scrambleFromState(state, moveTables, pruneTables));
    scope.postMessage({ id, ok: true, value } satisfies TimerWorkerRpcResponse<string>);
  } catch (error: unknown) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies TimerWorkerRpcResponse<string>);
  }
});

export {};
