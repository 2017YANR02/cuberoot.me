/** Use the existing vendored sq12phase worker in every host. A request owns its
 * worker so closing/switching scrambles also stops CPU work and releases tables. */
export function solveTimerSq1(scramble: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('cancelled')); return; }
    const worker = new Worker('/tools/cstimer-scramble/scrambler.worker.js');
    let settled = false;
    const finish = (error?: Error, result = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    const abort = () => finish(new Error('cancelled'));
    const timeout = setTimeout(() => finish(new Error('solver timed out')), 90_000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data?.id !== 1) return;
      if (data.error || typeof data.result !== 'string') finish(new Error(data.error || 'invalid solver response'));
      else finish(undefined, data.result);
    };
    worker.onerror = () => finish(new Error('solver worker failed'));
    worker.onmessageerror = () => finish(new Error('invalid solver response'));
    try { worker.postMessage({ id: 1, op: 'solve', key: 'sqrs', scramble }); }
    catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
  });
}
