/** Keep the exact graph and the full-state corpus out of the statistics page bundle. */
export function downloadBabyFtoStates(depth: number | undefined, signal: AbortSignal): Promise<{ filename: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    if (depth !== undefined && (!Number.isInteger(depth) || depth < 0)) return reject(new Error('Invalid depth'));
    const worker = new Worker(new URL('./baby-fto-export.worker.ts', import.meta.url), { type: 'module' });
    const finish = (error?: Error, blob?: Blob) => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error);
      else if (blob) resolve({ filename: depth === undefined ? 'baby_fto_all_states.csv' : `baby_fto_depth_${depth}.txt`, blob });
      else reject(new Error('Missing export'));
    };
    const abort = () => finish(new DOMException('Aborted', 'AbortError'));
    const timeout = setTimeout(() => finish(new Error('Export timed out')), 60_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => finish(new Error('Export worker failed'));
    worker.onmessageerror = () => finish(new Error('Invalid export response'));
    worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => {
      if (event.data.error) finish(new Error(event.data.error));
      else finish(undefined, event.data.blob);
    };
    worker.postMessage({ depth });
  });
}
