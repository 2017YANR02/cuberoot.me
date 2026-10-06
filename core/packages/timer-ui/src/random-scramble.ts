import { createTimerWorkerRpc, generateTimerScramble,
  type TimerScrambleRequest, type TimerSharedScrambleValue } from '@cuberoot/shared/timer';
import { createTimerRandomScramblePool } from '@cuberoot/shared/timer/random-scramble-pool';

const createRpc = () => createTimerWorkerRpc<TimerScrambleRequest, TimerSharedScrambleValue>({
  createWorker: () => new Worker(new URL('./random-scramble.worker.ts', import.meta.url), { type: 'module' }),
  makeRequest: (id, request) => ({ id, request }),
  label: 'Random scramble',
});
const generateWith = (rpc: ReturnType<typeof createRpc>, request: TimerScrambleRequest, signal?: AbortSignal) => {
  if (signal?.aborted) return Promise.resolve({ ok: false as const, event: request.event,
    code: 'generation-failed' as const, retryable: true });
  return generateTimerScramble(request, {
    requestTimeoutMs: 60_000,
    generateSharedScramble: (_provider, event, child) => rpc.request({ ...child, event, cnMode: 'none' }, signal, 60_000),
  });
};

/** Web and installed hosts share the same worker transport and ordinary providers. */
export function createRandomScrambleClient() {
  const rpc = createRpc();
  const pool = createTimerRandomScramblePool((request, signal) => generateWith(rpc, request, signal));
  return {
    ...pool,
    // Battle players and bulk jobs own independent transports. Cancelling one
    // must not terminate another player's shared-provider request.
    async generate(request: TimerScrambleRequest, signal?: AbortSignal) {
      const task = createRpc();
      try { return await generateWith(task, request, signal); }
      finally { task.dispose(); }
    },
    reset() { pool.reset(); rpc.reset(); },
  };
}
