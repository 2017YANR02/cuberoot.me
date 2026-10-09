import type { CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import {
  parseHintableSmartCubeScramble,
  smartCubeFixupState,
} from '@cuberoot/shared/smart-cube/scramble-hint';
import {
  createTimerWorkerRpc,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer/worker-rpc';
import type { TrainerWorkerRequest as Mobile333WorkerRequest, TrainerWorkerResult as Mobile333WorkerResult } from '@cuberoot/timer-ui/scramble/trainer';
export { generateRandomDifficultyBatch as generateMobileRandomDifficultyBatch,
  solveRandomDifficultyCase as solveMobileRandomDifficultyCase } from '@cuberoot/timer-ui/scramble/trainer';
export type { TrainerWorkerRequest as Mobile333WorkerRequest, TrainerWorkerResult as Mobile333WorkerResult } from '@cuberoot/timer-ui/scramble/trainer';

const createMobile333Rpc = (label: string) => (
  createTimerWorkerRpc<Mobile333WorkerRequest, Mobile333WorkerResult>({
    createWorker: () => new Worker(
      new URL('./fixup.worker.ts', import.meta.url),
      { type: 'module' },
    ) as unknown as TimerWorkerPort,
    makeRequest: (id, request) => ({ id, request }),
    label,
  })
);

// Cancelling one CPU-bound operation terminates its Worker transport. Keep the
// smart-cube transport separate from the shared generation and answer transports.
const smartCubeRpc = createMobile333Rpc('mobile smart-cube worker');

/** Same two-phase worker/representation as correction paths; the shared anchor verifies it. */
export async function solveMobileSmartCubeAnchor(state: CubieCube): Promise<string> {
  const result = await smartCubeRpc.request({ kind: 'solve-state', state }, undefined, 12_000);
  if (result.kind !== 'scramble') throw new Error('unexpected smart-cube worker response');
  return result.scramble;
}

export async function solveMobileSmartCubeFixup(
  fromFacelets: string,
  targetFacelets: string,
): Promise<string | null> {
  const state = smartCubeFixupState(fromFacelets, targetFacelets);
  if (!state) return null;
  try {
    const result = await smartCubeRpc.request({ kind: 'solve-state', state }, undefined, 12_000);
    if (result.kind !== 'scramble') return null;
    return parseHintableSmartCubeScramble(result.scramble) ? result.scramble : null;
  } catch {
    return null;
  }
}
