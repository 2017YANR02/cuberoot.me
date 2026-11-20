import { SMART_CUBE_RELAY_PATH, SMART_CUBE_RELAY_TOKEN_PATTERN, isSmartCubeRelayReady, isSmartCubeRelayPayload, type SmartCubeRelayEvent } from '@cuberoot/shared/smart-cube/relay';
import { createBluetoothTimerReconnect, type ExternalTimerEvent } from '@cuberoot/shared/timer/external/types';
import type { StackmatSnapshot } from '@cuberoot/shared/timer/external/stackmat-state';
import { API_ORIGIN } from '../runtime-config';
import { miniProgramApi } from '../platform';
import { connectNativeTimer } from './ble';
import { connectNativeStackmat } from './stackmat';
import type { DiscoveredDevice } from '../smart-cube/ble-api';

export type NativeTimerKind = 'gan-timer' | 'qiyi-timer' | 'stackmat-mic';
type NativeConnection = { disconnect(): Promise<void>; deviceName?: string };
let generation = 0;
let current: { disconnect(): Promise<void> } | null = null;

export async function disconnectExternalTimer(): Promise<void> { generation++; await current?.disconnect(); }

/** Owns the native device for the local timer or the existing relay. */
export async function startExternalTimer(token: string, kind: NativeTimerKind, localReceiver?: (event: SmartCubeRelayEvent) => void, config?: {
  device?: DiscoveredDevice;
  mac?: string;
  canReconnect?(): boolean;
  onStackmatSnapshot?(snapshot: StackmatSnapshot): void;
  onStackmatError?(error: Error): void;
}): Promise<void> {
  if (!localReceiver && !SMART_CUBE_RELAY_TOKEN_PATTERN.test(token)) throw new Error('INVALID_TIMER_BRIDGE_TOKEN');
  const attempt = ++generation;
  await current?.disconnect();
  if (attempt !== generation) throw new Error('TIMER_CONNECTION_CANCELLED');
  const api = miniProgramApi();
  let closed = false;
  let ready = !!localReceiver;
  let connection: NativeConnection | undefined;
  let connecting: Promise<NativeConnection> | undefined;
  let released = Promise.resolve();
  let closing: Promise<void> | undefined;
  let reportedDisconnected = false;
  const reconnect = createBluetoothTimerReconnect();
  const abortListeners = new Set<() => void>();
  const pending: SmartCubeRelayEvent[] = [];
  const socket = localReceiver ? null : api.connectSocket({ url: API_ORIGIN.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:').replace(/\/v1\/?$/, '') + SMART_CUBE_RELAY_PATH });
  let rejectReady: (error: Error) => void = () => {};
  let lastEvent: ExternalTimerEvent | undefined;
  const notifyLocalDisconnect = () => {
    if (reportedDisconnected) return;
    reportedDisconnected = true;
    localReceiver?.({ type: 'status', phase: 'disconnected' });
  };
  const owner = {
    disconnect(): Promise<void> {
      if (closing) return closing;
      closed = true;
      reconnect.cancel();
      const pending = connecting;
      const linked = connection;
      connection = undefined;
      closing = (async () => {
        try {
          await released;
          const device = linked ?? await pending?.catch(() => undefined);
          await device?.disconnect();
        } finally {
          socket?.close({ code: 1000, reason: 'timer disconnected' });
          if (current === owner) {
            current = null;
            notifyLocalDisconnect();
          }
        }
      })();
      rejectReady(new Error('TIMER_BRIDGE_CLOSED'));
      for (const abort of abortListeners) abort();
      abortListeners.clear();
      return closing;
    },
  };
  current = owner;
  const send = (event: SmartCubeRelayEvent): void => {
    if (closed) return;
    if (localReceiver) { localReceiver(event); return; }
    if (!ready) { pending.push(event); return; }
    socket?.send({ data: JSON.stringify(event), fail: () => { void owner.disconnect(); } });
  };
  const emit = (event: ExternalTimerEvent): void => {
    // QiYi retransmits results until ACK; Stackmat repeats unchanged readings.
    // Allow the same time again after a RUNNING/IDLE transition.
    if (lastEvent?.state === event.state && lastEvent.solveTime === event.solveTime && lastEvent.inspectTime === event.inspectTime) return;
    lastEvent = event;
    send({ type: 'timer', event });
  };
  const signal = {
    get aborted() { return closed; },
    onAbort(callback: () => void) {
      if (closed) { callback(); return () => {}; }
      abortListeners.add(callback);
      return () => { abortListeners.delete(callback); };
    },
  };
  const publishConnection = (linked: NativeConnection): void => {
    connection = linked;
    reportedDisconnected = false;
    send({ type: 'status', phase: 'connected', brand: kind, deviceName: linked.deviceName ?? kind });
  };
  async function attachBluetooth(driver: 'gan-timer' | 'qiyi-timer', retrying = false): Promise<void> {
    const retryKnownDevice = Boolean(localReceiver && config?.device);
    const earlyEvents: ExternalTimerEvent[] = [];
    let linked: NativeConnection | undefined;
    let lost = false;
    const onDisconnect = () => {
      if (closed || lost) return;
      lost = true;
      if (!retryKnownDevice) { void owner.disconnect(); return; }
      if (!linked && retrying) return;
      connection = undefined;
      lastEvent = undefined;
      const pendingRelease = linked ? linked.disconnect() : connecting?.then(device => device.disconnect());
      released = pendingRelease?.catch(() => {}) ?? Promise.resolve();
      reconnect.schedule(() => { void reconnectBluetooth(driver); });
      notifyLocalDisconnect();
    };
    const pending = connectNativeTimer(driver, {
      signal, device: config?.device, mac: config?.mac, onDisconnect,
      onEvent(event) {
        if (closed || lost) return;
        if (localReceiver && event.state === 'DISCONNECT') onDisconnect();
        else if (localReceiver && !linked) earlyEvents.push(event);
        else emit(event);
      },
    });
    connecting = pending;
    try {
      linked = await pending;
      if (closed || lost || (retrying && config?.canReconnect?.() === false)) {
        await linked.disconnect();
        throw new Error('TIMER_CONNECTION_CANCELLED');
      }
      publishConnection(linked);
      for (const event of earlyEvents) {
        if (closed || lost) break;
        emit(event);
      }
      earlyEvents.length = 0;
    } catch (error) {
      if (!retryKnownDevice || !lost || retrying || closed) throw error;
    } finally {
      if (connecting === pending) connecting = undefined;
    }
  }
  async function reconnectBluetooth(driver: 'gan-timer' | 'qiyi-timer'): Promise<void> {
    await released;
    if (closed) return;
    if (config?.canReconnect?.() === false) { await owner.disconnect(); return; }
    try { await attachBluetooth(driver, true); }
    catch { await owner.disconnect(); }
  }
  const timeout = setTimeout(() => { rejectReady(new Error('TIMER_BRIDGE_TIMEOUT')); void owner.disconnect(); }, 10000);
  try {
    if (socket) await new Promise<void>((resolve, reject) => {
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
    if (kind !== 'stackmat-mic') await attachBluetooth(kind);
    else {
      connecting = connectNativeStackmat({ signal, onEvent: emit, onSnapshot: config?.onStackmatSnapshot, onDisconnect(error) {
        if (!closed && error) config?.onStackmatError?.(error);
        void owner.disconnect();
      } });
      const linked = await connecting;
      connecting = undefined;
      if (closed) { await linked.disconnect(); throw new Error('TIMER_CONNECTION_CANCELLED'); }
      publishConnection(linked);
    }
  } catch (error) {
    send({ type: 'status', phase: 'error', error: error instanceof Error ? error.message : 'TIMER_CONNECTION_FAILED' });
    await owner.disconnect();
    throw error;
  } finally { clearTimeout(timeout); }
}
