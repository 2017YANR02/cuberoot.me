import { createTimerWorkerRpc } from '@cuberoot/shared/timer/worker-rpc';
import { openNativeTimerWorkerPort } from './native-timer-worker';

/** Use the same vendored sq12phase solver as the website's hint entry. */
export async function solveNativeTimerSq1(scramble: string, signal?: AbortSignal): Promise<string> {
  const rpc = createTimerWorkerRpc<string, string>({
    createWorker: () => openNativeTimerWorkerPort('sq1-hint'),
    makeRequest: (id, request) => ({ id, request }),
    label: 'Native Square-1 solver',
  });
  try {
    const result = await rpc.request(scramble, signal, 90_000);
    if (typeof result !== 'string') throw new Error('Invalid Square-1 solver response');
    return result;
  } finally {
    rpc.dispose();
  }
}
