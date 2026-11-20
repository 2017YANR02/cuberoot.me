import type { TimerWorkerErrorEvent, TimerWorkerMessageEvent, TimerWorkerPort } from '@cuberoot/shared/timer/worker-rpc';
import { miniProgramApi } from './platform';

/** The packaged native timer worker path is relative to the app root. */
export type NativeTimerWorkerChannel = 'trainer' | 'stage-solver' | 'wca-scramble' | 'sq1-hint' | 'timer-preview' | 'live-analysis';

export interface NativeTimerWorkerEnvelope {
  sequence: number;
  channel: NativeTimerWorkerChannel;
  payload: unknown;
  intermediate?: boolean;
}

interface NativeTimerWorkerPort extends TimerWorkerPort {
  respond(payload: unknown): void;
}

export interface NativeWorker {
  onMessage(listener: (message: unknown) => void): void;
  postMessage(message: NativeTimerWorkerEnvelope): void;
  terminate(): void;
}

interface PortListeners {
  message?: (event: TimerWorkerMessageEvent) => void;
  error?: (event: TimerWorkerErrorEvent) => void;
}

interface WorkerJob {
  envelope: NativeTimerWorkerEnvelope;
  port: PortListeners;
}

/** Douyin exposes one physical worker; serialize independent RPC clients on it.
 * Only the owner of an executing job can terminate the process. The other
 * clients' unstarted requests stay queued and run on the replacement worker. */
export function createNativeTimerWorkerHost(createWorker: () => NativeWorker) {
  let nextSequence = 1;
  let worker: NativeWorker | undefined;
  let active: WorkerJob | undefined;
  let queue: WorkerJob[] = [];
  const ports = new Set<PortListeners>();

  const stopWorker = (): void => {
    const previous = worker;
    worker = undefined;
    if (previous) {
      try { previous.terminate(); }
      catch { /* A worker already stopped by the host may reject termination. */ }
    }
  };

  const pump = (): void => {
    while (!active && queue.length) {
      const job = queue.shift()!;
      active = job;
      try {
        if (!worker) {
          const next = createWorker();
          worker = next;
          next.onMessage((message) => {
            if (worker !== next || !active || !message || typeof message !== 'object') return;
            const reply = message as Partial<NativeTimerWorkerEnvelope>;
            if (reply.sequence !== active.envelope.sequence || reply.channel !== active.envelope.channel) return;
            if (reply.intermediate) {
              active.port.message?.({ data: reply.payload });
              return;
            }
            const finished = active;
            active = undefined;
            try { finished.port.message?.({ data: reply.payload }); }
            finally { pump(); }
          });
        }
        worker.postMessage(job.envelope);
      } catch (error) {
        active = undefined;
        stopWorker();
        job.port.error?.({ message: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  return (channel: NativeTimerWorkerChannel): NativeTimerWorkerPort => {
    const port: PortListeners = {};
    ports.add(port);
    return {
      addEventListener(type: 'message' | 'error', listener: NonNullable<PortListeners['message'] | PortListeners['error']>) {
        if (type === 'message') port.message = listener as PortListeners['message'];
        else port.error = listener as PortListeners['error'];
      },
      postMessage(payload) {
        if (!ports.has(port)) throw new Error('native timer worker port terminated');
        queue.push({ port, envelope: { sequence: nextSequence++, channel, payload } });
        pump();
      },
      respond(payload) {
        if (active?.port === port) worker?.postMessage({ ...active.envelope, intermediate: true, payload });
      },
      terminate() {
        if (!ports.delete(port)) return;
        queue = queue.filter(job => job.port !== port);
        if (active?.port === port) {
          active = undefined;
          stopWorker();
        } else if (!ports.size) {
          stopWorker();
        }
        pump();
      },
    };
  };
}

export const openNativeTimerWorkerPort = createNativeTimerWorkerHost(() => {
  const api = miniProgramApi() as { createWorker?(script: string): NativeWorker };
  if (typeof api.createWorker !== 'function') throw new Error('native timer worker unavailable');
  return api.createWorker('workers/timer.js');
});
