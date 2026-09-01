import type { CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import {
  parseHintableSmartCubeScramble,
  smartCubeFixupState,
} from '@cuberoot/shared/smart-cube/scramble-hint';
import {
  createTimerWorkerRpc,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer/worker-rpc';

const rpc = createTimerWorkerRpc<CubieCube, string>({
  createWorker: () => new Worker(
    new URL('./fixup.worker.ts', import.meta.url),
    { type: 'module' },
  ) as unknown as TimerWorkerPort,
  makeRequest: (id, state) => ({ id, state }),
  label: 'smart-cube correction worker',
});

export async function solveMobileSmartCubeFixup(
  fromFacelets: string,
  targetFacelets: string,
): Promise<string | null> {
  const state = smartCubeFixupState(fromFacelets, targetFacelets);
  if (!state) return null;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 12_000);
  try {
    const scramble = await rpc.request(state, controller.signal);
    return parseHintableSmartCubeScramble(scramble) ? scramble : null;
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
