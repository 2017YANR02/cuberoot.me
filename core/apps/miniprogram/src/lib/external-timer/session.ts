import { SMART_CUBE_RELAY_PATH, SMART_CUBE_RELAY_TOKEN_PATTERN, isSmartCubeRelayReady, isSmartCubeRelayPayload, type SmartCubeRelayEvent } from '@cuberoot/shared/smart-cube/relay';
import type { ExternalTimerEvent } from '@cuberoot/shared/timer/external/types';
import { API_ORIGIN } from '../runtime-config';
import { miniProgramApi } from '../platform';
import { connectNativeTimer } from './ble';
import { connectNativeStackmat } from './stackmat';

export type NativeTimerKind = 'gan-timer' | 'qiyi-timer' | 'stackmat-mic';
let generation = 0;
let current: { disconnect(): Promise<void> } | null = null;

export async function disconnectExternalTimer(): Promise<void> { generation++; await current?.disconnect(); }

/** Owns native resources after the setup page returns to the WebView. */
export async function startExternalTimer(token: string, kind: NativeTimerKind): Promise<void> {
  if (!SMART_CUBE_RELAY_TOKEN_PATTERN.test(token)) throw new Error('INVALID_TIMER_BRIDGE_TOKEN');
  const attempt = ++generation;
  await current?.disconnect();
  if (attempt !== generation) throw new Error('TIMER_CONNECTION_CANCELLED');
  const api = miniProgramApi();
  let closed = false;
  let ready = false;
  let connection: { disconnect(): Promise<void>; deviceName?: string } | undefined;
  const abortListeners = new Set<() => void>();
  const pending: SmartCubeRelayEvent[] = [];
  const socket = api.connectSocket({ url: API_ORIGIN.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:').replace(/\/v1\/?$/, '') + SMART_CUBE_RELAY_PATH });
  let rejectReady: (error: Error) => void = () => {};
  let lastEvent: ExternalTimerEvent | undefined;
  const owner = {
    async disconnect(): Promise<void> {
      if (closed) return;
      closed = true;
      rejectReady(new Error('TIMER_BRIDGE_CLOSED'));
      for (const abort of abortListeners) abort();
      abortListeners.clear();
      await connection?.disconnect();
      socket.close({ code: 1000, reason: 'timer disconnected' });
      if (current === owner) current = null;
    },
  };
  current = owner;
  const send = (event: SmartCubeRelayEvent): void => {
    if (closed) return;
    if (!ready) { pending.push(event); return; }
    socket.send({ data: JSON.stringify(event), fail: () => { void owner.disconnect(); } });
  };
  const emit = (event: ExternalTimerEvent): void => {
    // QiYi retransmits results until ACK; Stackmat repeats unchanged readings.
    // Allow the same time again after a RUNNING/IDLE transition.
    if (lastEvent?.state === event.state && lastEvent.solveTime === event.solveTime && lastEvent.inspectTime === event.inspectTime) return;
    lastEvent = event;
    send({ type: 'timer', event });
  };
  const timeout = setTimeout(() => { rejectReady(new Error('TIMER_BRIDGE_TIMEOUT')); void owner.disconnect(); }, 10000);
  try {
    await new Promise<void>((resolve, reject) => {
      rejectReady = reject;
      socket.onOpen(() => socket.send({ data: JSON.stringify({ type: 'hello', role: 'source', token }), fail: () => reject(new Error('TIMER_BRIDGE_SEND_FAILED')) }));
      socket.onMessage(({ data }) => {
        if (closed || typeof data !== 'string') return;
        let message: unknown;
        try { message = JSON.parse(data); } catch { return; }
        if (isSmartCubeRelayReady(message) && message.role === 'source') {
          ready = true; for (const event of pending.splice(0)) send(event); resolve();
        } else if (isSmartCubeRelayPayload(message) && message.type === 'command' && message.command === 'disconnect') { void owner.disconnect(); }
      });
      socket.onError(() => { reject(new Error('TIMER_BRIDGE_UNAVAILABLE')); void owner.disconnect(); });
      socket.onClose(() => { reject(new Error('TIMER_BRIDGE_CLOSED')); void owner.disconnect(); });
    });
    clearTimeout(timeout);
    const options = { onEvent: emit, onDisconnect: () => { void owner.disconnect(); }, signal: {
      get aborted() { return closed; },
      onAbort(callback: () => void) { if (closed) { callback(); return () => {}; } abortListeners.add(callback); return () => { abortListeners.delete(callback); }; },
    } };
    connection = kind === 'stackmat-mic'
      ? await connectNativeStackmat(options)
      : await connectNativeTimer(kind, options);
    if (closed) { await connection.disconnect(); throw new Error('TIMER_CONNECTION_CANCELLED'); }
    send({ type: 'status', phase: 'connected', brand: kind, deviceName: connection.deviceName ?? kind });
  } catch (error) {
    send({ type: 'status', phase: 'error', error: error instanceof Error ? error.message : 'TIMER_CONNECTION_FAILED' });
    await owner.disconnect();
    throw error;
  } finally { clearTimeout(timeout); }
}
