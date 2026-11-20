import { timerScrambleCapability, type TimerCubingScrambleEventId } from '@cuberoot/shared/timer/scramble-capabilities';
import type { TimerScrambleRequest } from '@cuberoot/shared/timer/scramble-runtime';
import { TIMER_COMPOUND_SCRAMBLE_CHILDREN, type TimerCompoundScrambleEventId } from '@cuberoot/shared/timer/compound-scramble';
import type { SeededBasicWcaScrambleRequest } from '@cuberoot/shared/timer/seeded/wca';
import { createTimerWorkerRpc } from '@cuberoot/shared/timer/worker-rpc';
import type { EventId } from '@cuberoot/shared/timer/types';
import { openNativeTimerWorkerPort } from './native-timer-worker';
import { miniProgramApi } from './platform';

export type NativeWcaScrambleEvent = TimerCubingScrambleEventId;
const wasmEvents = new Set<NativeWcaScrambleEvent>(['333fm', '555', '555bf', '666', '777', 'clock', 'minx', 'pyram', 'skewb', 'sq1', 'baby_fto']);
const ENTROPY_BYTES = 16 * 1024;
const SCRAMBLE_TIMEOUT_MS = 60_000;

type RandomValuesOptions = {
  length: number;
  success(result: { randomValues: ArrayBuffer }): void;
  fail(error: { errMsg?: string }): void;
};
type NativeWcaScrambleApi = typeof wx & { getRandomValues?(options: RandomValuesOptions): void };

export interface NativeWcaScrambleRequest {
  event: NativeWcaScrambleEvent;
  entropy: ArrayBuffer;
}

export type NativeTimerProjectScrambleRequest = { timerRequest: TimerScrambleRequest; entropy: ArrayBuffer };
export type NativeWcaWorkerScrambleRequest = NativeWcaScrambleRequest | NativeTimerProjectScrambleRequest | SeededBasicWcaScrambleRequest;

export function nativeWcaScrambleProviderEvent(event: EventId): NativeWcaScrambleEvent | null {
  const capability = timerScrambleCapability(event);
  return capability?.kind === 'cubing' ? capability.cubingEventId : null;
}

export function nativeWcaRandomScrambleAvailable(event?: NativeWcaScrambleEvent): boolean {
  try {
    const api = miniProgramApi() as NativeWcaScrambleApi;
    if (typeof api.createWorker !== 'function' || typeof api.getRandomValues !== 'function') return false;
    if (!event || !wasmEvents.has(event)) return true;
    const version = api.getAppBaseInfo?.()?.SDKVersion ?? api.getSystemInfoSync?.()?.SDKVersion;
    if (!version) return true; // The Worker reports initialization errors on unknown builds.
    const [major, minor] = version.split('.').map(Number);
    return major > 3 || major === 3 && minor >= 5;
  } catch {
    return false;
  }
}

export function nativeTimerProjectScrambleAvailable(event: EventId): boolean {
  const capability = timerScrambleCapability(event);
  if (!capability || capability.kind === 'unsupported') return false;
  if (capability.kind === 'compound') {
    return nativeWcaRandomScrambleAvailable()
      && TIMER_COMPOUND_SCRAMBLE_CHILDREN[event as TimerCompoundScrambleEventId].every(nativeTimerProjectScrambleAvailable);
  }
  return nativeWcaRandomScrambleAvailable(nativeWcaScrambleProviderEvent(event) ?? undefined);
}

function requestEntropy(): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const api = miniProgramApi() as NativeWcaScrambleApi;
    if (!api.getRandomValues) throw new Error('Native timer entropy unavailable');
    api.getRandomValues({
      length: ENTROPY_BYTES,
      success({ randomValues }) {
        if (randomValues?.byteLength === ENTROPY_BYTES) resolve(randomValues);
        else reject(new Error('Native timer entropy response was invalid'));
      },
      fail(error) { reject(new Error(error.errMsg || 'Native timer entropy request failed')); },
    });
  });
}

export function createNativeWcaRandomScramble() {
  const rpc = createTimerWorkerRpc<NativeWcaWorkerScrambleRequest, string>({
    createWorker: () => openNativeTimerWorkerPort('wca-scramble'),
    makeRequest: (id, request) => ({ id, request }),
    label: 'Native timer scramble',
  });
  const request = async (options: NativeWcaWorkerScrambleRequest, signal?: AbortSignal) => {
    const scramble = await rpc.request(options, signal, SCRAMBLE_TIMEOUT_MS);
    const allowEmpty = 'timerRequest' in options && timerScrambleCapability(options.timerRequest.event)?.kind === 'manual';
    if (typeof scramble !== 'string' || !scramble.trim() && !allowEmpty) throw new Error('Native timer scramble was empty');
    return scramble;
  };
  return {
    async generate(event: NativeWcaScrambleEvent, signal?: AbortSignal) {
      if (signal?.aborted) throw new Error('Native timer scramble request aborted');
      if (!nativeWcaRandomScrambleAvailable(event)) throw new Error('Native timer scramble unavailable');
      const entropy = await requestEntropy();
      return request({ event, entropy }, signal);
    },
    async generateProject(timerRequest: TimerScrambleRequest, signal?: AbortSignal) {
      if (signal?.aborted) throw new Error('Native timer scramble request aborted');
      if (!nativeTimerProjectScrambleAvailable(timerRequest.event)) throw new Error('Native timer scramble unavailable');
      return request({ timerRequest, entropy: await requestEntropy() }, signal);
    },
    generateSeeded(options: SeededBasicWcaScrambleRequest, signal?: AbortSignal) { return request(options, signal); },
    reset: () => rpc.reset(),
    dispose: () => rpc.dispose(),
  };
}
