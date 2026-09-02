/** Runtime-neutral coordination for DOM-compatible Worker request/response RPC. */

export interface TimerWorkerMessageEvent {
  data: unknown;
}

export interface TimerWorkerErrorEvent {
  message?: string;
}

/** The deliberately narrow Worker surface shared by Web and Capacitor hosts. */
export interface TimerWorkerPort {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: TimerWorkerMessageEvent) => void): void;
  addEventListener(type: 'error', listener: (event: TimerWorkerErrorEvent) => void): void;
  terminate(): void;
}

export type TimerWorkerRpcResponse<Value> =
  | { id: number; ok: true; value: Value }
  | { id: number; ok: false; error: string };

export interface TimerWorkerRpcOptions<Payload> {
  createWorker: () => TimerWorkerPort;
  makeRequest: (id: number, payload: Payload) => unknown;
  label: string;
}

export interface TimerWorkerRpc<Payload, Value> {
  request(payload: Payload, signal?: AbortSignal, timeoutMs?: number): Promise<Value>;
  reset(reason?: string): void;
  dispose(reason?: string): void;
}

export function createTimerWorkerRpc<Payload, Value>(
  options: TimerWorkerRpcOptions<Payload>,
): TimerWorkerRpc<Payload, Value> {
  let worker: TimerWorkerPort | null = null;
  let nextId = 1;
  let disposed = false;
  const pending = new Map<number, {
    resolve: (value: Value) => void;
    reject: (error: Error) => void;
    cleanup: () => void;
  }>();

  const dropWorker = (reason: string): void => {
    for (const request of pending.values()) {
      request.cleanup();
      request.reject(new Error(reason));
    }
    pending.clear();
    worker?.terminate();
    worker = null;
  };

  const getWorker = (): TimerWorkerPort => {
    if (worker) return worker;
    if (disposed) throw new Error(`${options.label} is disposed`);
    const next = options.createWorker();
    next.addEventListener('message', (event) => {
      // A terminated worker can still have an already-queued event. Never let
      // that stale transport settle requests owned by its replacement.
      if (worker !== next) return;
      if (!event.data || typeof event.data !== 'object') return;
      const response = event.data as {
        id?: unknown;
        ok?: unknown;
        value?: unknown;
        error?: unknown;
      };
      if (typeof response.id !== 'number') return;
      const request = pending.get(response.id);
      if (!request) return;
      pending.delete(response.id);
      request.cleanup();
      if (response.ok === true && 'value' in response) request.resolve(response.value as Value);
      else request.reject(new Error(
        response.ok === false && typeof response.error === 'string'
          ? response.error
          : `${options.label} returned an invalid response`,
      ));
    });
    next.addEventListener('error', (event) => {
      if (worker !== next) return;
      dropWorker(event.message || `${options.label} error`);
    });
    worker = next;
    return next;
  };

  return {
    request(payload, signal, timeoutMs): Promise<Value> {
      if (disposed) return Promise.reject(new Error(`${options.label} is disposed`));
      if (signal?.aborted) return Promise.reject(new Error(`${options.label} request aborted`));
      let target: TimerWorkerPort;
      try {
        target = getWorker();
      } catch (error: unknown) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
      const id = nextId++;
      return new Promise<Value>((resolve, reject) => {
        let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
        const onAbort = (): void => {
          const current = pending.get(id);
          if (!current) return;
          pending.delete(id);
          current.cleanup();
          // A timed-out worker may still be CPU-bound and would hold every
          // later request behind it. Terminate it; the next request starts a
          // clean transport. Pool reset/dispose uses the same safe path.
          dropWorker(`${options.label} request aborted`);
          reject(new Error(`${options.label} request aborted`));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        pending.set(id, {
          resolve,
          reject,
          cleanup: () => {
            signal?.removeEventListener('abort', onAbort);
            if (timer !== null) globalThis.clearTimeout(timer);
          },
        });
        if (timeoutMs !== undefined) timer = globalThis.setTimeout(onAbort, timeoutMs);
        try {
          target.postMessage(options.makeRequest(id, payload));
        } catch (error: unknown) {
          pending.delete(id);
          signal?.removeEventListener('abort', onAbort);
          if (timer !== null) globalThis.clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    reset(reason = `${options.label} reset`): void {
      dropWorker(reason);
    },
    dispose(reason = `${options.label} disposed`): void {
      if (disposed) return;
      disposed = true;
      dropWorker(reason);
    },
  };
}
