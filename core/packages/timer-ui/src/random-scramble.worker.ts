/// <reference lib="webworker" />
// Load the upstream module only inside the Worker, before installing our RPC.
import '@cuberoot/puzzle-solvers/cstimer-nonwca';
import { generateTimerScramble, type TimerScrambleRequest } from '@cuberoot/shared/timer';
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = null;
scope.addEventListener('message', async (event: MessageEvent<{ id: number; request: TimerScrambleRequest }>) => {
  const { id, request } = event.data;
  const result = await generateTimerScramble(request, { requestTimeoutMs: 60_000 });
  scope.postMessage(result.ok && result.kind === 'generated'
    ? { id, ok: true, value: { scramble: result.scramble, metadata: result.metadata } }
    : { id, ok: false, error: 'Random scramble generation failed' });
});
