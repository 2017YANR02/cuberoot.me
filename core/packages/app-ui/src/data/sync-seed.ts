import { createTimerWorkerRpc } from '@cuberoot/shared/timer';
import type { TimerSeedRequest, TimerSeedResult } from '@cuberoot/shared/timer/seeded/generate';
const rpc = createTimerWorkerRpc<TimerSeedRequest, TimerSeedResult>({
  createWorker: () => new Worker(new URL('./sync-seed.worker.ts', import.meta.url), { type: 'module' }),
  makeRequest: (id, payload) => ({ id, payload }),
  label: 'Seeded scramble',
});
export const nextSeededScramble = (request: TimerSeedRequest, signal: AbortSignal) => rpc.request(request, signal, 120_000);
