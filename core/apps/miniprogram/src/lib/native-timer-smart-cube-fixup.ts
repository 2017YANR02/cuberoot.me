import {
  parseHintableSmartCubeScramble,
  smartCubeFixupState,
} from '@cuberoot/shared/smart-cube/scramble-hint';
import type { TrainerWorkerRequest, TrainerWorkerResult } from '@cuberoot/shared/timer/random-difficulty-worker';
import { createTimerWorkerRpc } from '@cuberoot/shared/timer/worker-rpc';
import { openNativeTimerWorkerPort } from './native-timer-worker';

/** Shares the installed client's exact two-phase correction job on the native worker. */
export function createNativeSmartCubeFixup() {
  const rpc = createTimerWorkerRpc<TrainerWorkerRequest, TrainerWorkerResult>({
    createWorker: () => openNativeTimerWorkerPort('trainer'),
    makeRequest: (id, request) => ({ id, request }),
    label: 'Native smart-cube correction',
  });
  async function generate(state: NonNullable<ReturnType<typeof smartCubeFixupState>>) {
    const result = await rpc.request({ kind: 'solve-state', state }, undefined, 12_000);
    if (result.kind !== 'scramble' || !parseHintableSmartCubeScramble(result.scramble)) throw new Error('Invalid smart-cube solve');
    return result.scramble;
  }
  return {
    generate,
    async solve(fromFacelets: string, targetFacelets: string): Promise<string | null> {
      const state = smartCubeFixupState(fromFacelets, targetFacelets);
      if (!state) return null;
      try {
        return await generate(state);
      } catch {
        return null;
      }
    },
    release() { rpc.reset(); },
  };
}
