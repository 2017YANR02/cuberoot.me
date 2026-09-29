import { connectMiniProgramCubeBridge, type MiniProgramCubeBridgeConnection } from '../miniprogram_bridge';
import { createExternalTimerBus, type ExternalTimerEvent, type ExternalTimerKind, type ExternalTimerState } from '@cuberoot/shared/timer/external/types';
import type { StackmatMicSource, StackmatSnapshot } from '@cuberoot/shared/timer/external/stackmat-state';

/** Native transport only; native and Web adapters share all wire protocols. */
export function createMiniProgramTimerSource(mode: 'bluetooth-timer' | 'stackmat') {
  const bus = createExternalTimerBus();
  let bridge: MiniProgramCubeBridgeConnection | undefined;
  let generation = 0;
  let abort: AbortController | undefined;
  let connecting = false;
  let state: ExternalTimerState = 'DISCONNECT';
  let kind: ExternalTimerKind = mode === 'stackmat' ? 'stackmat-mic' : 'unknown';
  let lastTimeMs = 0;
  const emit = (event: ExternalTimerEvent): void => {
    state = event.state;
    if (state === 'STOPPED') lastTimeMs = event.solveTime ?? 0;
    bus.emit(event);
  };
  return {
    get kind() { return kind; }, get deviceName() { return bridge?.deviceName ?? ''; },
    get connected() { return bridge !== undefined; }, get state() { return state; }, get lastTimeMs() { return lastTimeMs; },
    subscribe: bus.subscribe,
    async connect() {
      if (bridge || connecting) return;
      connecting = true;
      abort = new AbortController();
      const attempt = ++generation;
      try {
        const connected = await connectMiniProgramCubeBridge({
          onBattery() {}, onGyro() {}, onMove() {}, onState() {},
          onTimer(event) { if (generation === attempt) emit(event); },
          onStatus(status) {
            if (generation !== attempt) return;
            if (status.phase === 'disconnected' || status.phase === 'error') {
              generation++; connecting = false;
              bridge?.disconnect(); bridge = undefined; emit({ state: 'DISCONNECT' });
            }
          },
        }, mode, abort.signal);
        if (attempt !== generation) { connected.disconnect(); return; }
        bridge = connected;
        kind = connected.brand === 'gan-timer' || connected.brand === 'qiyi-timer' || connected.brand === 'stackmat-mic' ? connected.brand : 'unknown';
        connected.activate();
      } finally { if (attempt === generation) connecting = false; }
    },
    async disconnect() { abort?.abort(); generation++; connecting = false; bridge?.disconnect(); bridge = undefined; emit({ state: 'DISCONNECT' }); },
    async connectDevice(): Promise<void> { throw new Error('NATIVE_TIMER_REQUIRES_NATIVE_PICKER'); },
  };
}

export function createMiniProgramStackmatSource(): StackmatMicSource {
  const source = createMiniProgramTimerSource('stackmat');
  const listeners = new Set<(snapshot: StackmatSnapshot) => void>();
  let snapshot: StackmatSnapshot = { phase: 'unknown', ms: 0, listening: false, signalLevel: 0, signalPresent: false, noise: 0, stateByte: '', unit: 0, deviceId: '' };
  const events = createExternalTimerBus();
  let previousState: ExternalTimerState = 'DISCONNECT';
  source.subscribe(event => {
    const phases = { IDLE: 'idle', HANDS_ON: 'one-hand', GET_SET: 'starting', RUNNING: 'running', STOPPED: 'stopped' } as const;
    snapshot = { ...snapshot, phase: phases[event.state as keyof typeof phases] ?? 'unknown', ms: event.solveTime ?? snapshot.ms, listening: source.connected, signalPresent: event.state !== 'DISCONNECT' };
    for (const listener of listeners) listener(snapshot);
    if (event.state !== previousState) { previousState = event.state; events.emit(event); }
  });
  return {
    ...source, kind: 'stackmat-mic',
    get deviceName() { return source.deviceName; }, get connected() { return source.connected; },
    get state() { return source.state; }, get lastTimeMs() { return source.lastTimeMs; },
    subscribe: events.subscribe,
    async connect() { await source.connect(); snapshot = { ...snapshot, listening: source.connected }; for (const listener of listeners) listener(snapshot); },
    deviceId: '', snapshot: () => snapshot,
    subscribeSnapshot(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async listInputDevices() { return []; },
  };
}
