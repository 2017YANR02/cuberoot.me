/**
 * Public API for BLE smart-TIMER support (GAN Smart Timer, QiYi Timer /
 * Adapter). Smart CUBES live one directory up — different devices, different
 * payloads, deliberately separate registries (csTimer splits them the same
 * way: `GiikerCube` vs `BluetoothTimer`).
 *
 *   import { useBluetoothTimer } from './bluetooth/timer';
 *
 *   const timer = useBluetoothTimer({
 *     onStop: (ms) => recordSolve(ms),
 *     onNeedMac: (name) => promptForMac(name),   // QiYi only
 *   });
 *
 *   <button onClick={timer.connect}>Connect timer</button>
 *
 * Everything is inert until `connect()` runs, which must happen inside a user
 * gesture (Web Bluetooth requirement). On browsers without Web Bluetooth,
 * `connect()` rejects with a tagged `Error` (`err.kind === 'no-web-bluetooth'`)
 * so the caller can reuse the smart-cube env-advice modal verbatim.
 *
 * Crypto and MAC discovery are shared with the cube side: AES comes from
 * `../gan_crypto.ts` and advertisement watching from `../mac.ts` (the QiYi
 * timer advertises exactly like the QiYi cube, `QIYI_MAC_ADV`). Only the
 * device-name MAC fallback is timer-specific — `./mac.ts`.
 *
 * Known follow-up: `./types.ts` (`ExternalTimerSource`) is device-agnostic and
 * is imported by the mic Stackmat; it would sit better in a neutral
 * `_lib/external_timer/` than under `bluetooth/`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestBluetoothDevice } from '../index';
import type { BluetoothTimerDriver } from './driver';
import { ganTimerDriver } from './gan_timer';
import { QIYI_MAC_ADV, normalizeMac, watchAdvertisementsMac } from '../mac';
import { qiyiTimerMacFromName } from './mac';
import { qiyiTimerDriver } from './qiyi_timer';
import {
  createExternalTimerBus,
  snapshotExternalTimer,
  type ExternalTimerEvent,
  type ExternalTimerKind,
  type ExternalTimerListener,
  type ExternalTimerSource,
  type ExternalTimerState,
  type ExternalTimerStatus,
} from './types';

export type {
  ExternalTimerEvent,
  ExternalTimerKind,
  ExternalTimerListener,
  ExternalTimerSource,
  ExternalTimerState,
  ExternalTimerStatus,
} from './types';
export { EXTERNAL_TIMER_STATE_CODE, createExternalTimerBus, snapshotExternalTimer } from './types';
export type { BluetoothTimerContext, BluetoothTimerDriver, BluetoothTimerStartResult } from './driver';
export {
  GAN_TIMER_SERVICE,
  GAN_TIMER_STATE_CHAR,
  GAN_TIMER_STATES,
  ganTimerDriver,
  parseGanTimerFrame,
  validateGanTimerFrame,
} from './gan_timer';
export {
  QIYI_TIMER_KEY,
  QIYI_TIMER_SERVICE,
  QIYI_TIMER_STATES,
  buildQiyiHelloContent,
  buildQiyiTimerMessage,
  createQiyiTimerReassembler,
  decodeQiyiTimerPayload,
  encodeQiyiTimerPackets,
  parseQiyiTimerFrame,
  qiyiTimerDriver,
} from './qiyi_timer';
export { crc16CcittFalse, crc16Modbus } from '../crc';
export { qiyiTimerMacFromName } from './mac';

/* ------------------------------------------------------------------ */
/*  Driver registry                                                    */
/* ------------------------------------------------------------------ */

export const BLUETOOTH_TIMER_DRIVERS: readonly BluetoothTimerDriver[] = [
  ganTimerDriver,
  qiyiTimerDriver,
];

/**
 * Standalone smart-timer chooser options.
 *
 * Keep the filters name-only even outside Bluefy: GAN timers do not reliably
 * advertise FFF0 in their scan record. Services and manufacturer data are
 * still requested as optional permissions for discovery after selection.
 */
export function bluetoothTimerPickerOptions(_nameOnly = false): RequestDeviceOptions {
  return {
    filters: BLUETOOTH_TIMER_DRIVERS.flatMap((driver) =>
      driver.namePrefixes.map((namePrefix) => ({ namePrefix }))),
    optionalServices: Array.from(new Set(
      BLUETOOTH_TIMER_DRIVERS.map((driver) => driver.service),
    )),
    optionalManufacturerData: Array.from(new Set(
      BLUETOOTH_TIMER_DRIVERS.flatMap((driver) =>
        Array.from(driver.manufacturerDataCics ?? [])),
    )),
  };
}

function pickDriver(device: BluetoothDevice): BluetoothTimerDriver | null {
  for (const d of BLUETOOTH_TIMER_DRIVERS) if (d.matches(device)) return d;
  return null;
}

/** "QY-Timer-x-8F2A" -> "QY-Timer-x (8F:2A)". Mirrors the cube hook. */
function prettyDeviceName(device: BluetoothDevice): string {
  const n = (device.name ?? 'Smart timer').trim();
  const m = /^(.+?)-?([0-9A-F]{4,12})$/i.exec(n);
  if (m && m[2].length >= 4) {
    const tail = m[2];
    return `${m[1]} (${tail.slice(-4, -2)}:${tail.slice(-2)})`;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/*  Source                                                             */
/* ------------------------------------------------------------------ */

export interface BluetoothTimerSourceOptions {
  /**
   * Called when a MAC-needing timer (QiYi) could not be identified from
   * advertisements or from its device name. Resolve "XX:XX:XX:XX:XX:XX", or
   * null to give up. Without a MAC the QiYi timer never answers the hello.
   */
  onNeedMac?: (deviceName: string, suggestedMac?: string) => Promise<string | null>;
  /** Fired when the GATT link drops on its own (not via disconnect()). */
  onConnectionLost?: () => void;
}

export interface BluetoothTimerSource extends ExternalTimerSource {
  /** Connect a device already returned by a shared Web Bluetooth chooser. */
  connectDevice(device: BluetoothDevice): Promise<void>;
}

/**
 * Create a (disconnected) BLE timer source. One source handles one device at a
 * time; call connect() again after disconnect() to pick a different one.
 *
 * Like csTimer, an unexpected disconnect schedules one same-device reconnect
 * after 2.5 seconds. Manual disconnect cancels it. The interrupted solve still
 * cannot be recovered, so consumers receive DISCONNECT before the retry.
 */
export function createBluetoothTimerSource(
  opts: BluetoothTimerSourceOptions = {},
): BluetoothTimerSource {
  const bus = createExternalTimerBus();

  let device: BluetoothDevice | null = null;
  let driver: BluetoothTimerDriver | null = null;
  let mac: string | null = null;
  let cleanup: (() => void) | null = null;
  let onGattDisconnected: ((ev: Event) => void) | null = null;
  let connected = false;
  let connecting = false;
  let state: ExternalTimerState = 'DISCONNECT';
  let lastTimeMs = 0;
  let deviceName = '';
  let kind: ExternalTimerKind = 'unknown';
  /** Set while disconnect() is unwinding, so the GATT listener stays quiet. */
  let tearingDown = false;
  /** Invalidates async work from an older connection attempt. */
  let generation = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = (ev: ExternalTimerEvent): void => {
    state = ev.state;
    if (ev.state === 'STOPPED' && typeof ev.solveTime === 'number') {
      lastTimeMs = ev.solveTime;
    }
    bus.emit(ev);
  };

  const cancelReconnect = (): void => {
    if (reconnectTimer === null) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const releaseConnection = (forgetDevice: boolean): void => {
    tearingDown = true;
    try {
      cleanup?.();
      const dev = device;
      if (dev) {
        if (onGattDisconnected) {
          dev.removeEventListener('gattserverdisconnected', onGattDisconnected);
        }
        if (dev.gatt?.connected) {
          try { dev.gatt.disconnect(); } catch { /* ignore */ }
        }
      }
    } finally {
      cleanup = null;
      onGattDisconnected = null;
      connected = false;
      connecting = false;
      if (forgetDevice) {
        device = null;
        driver = null;
        mac = null;
        deviceName = '';
        kind = 'unknown';
      }
      tearingDown = false;
    }
  };

  const attachKnownDevice = async (
    picked: BluetoothDevice,
    pickedDriver: BluetoothTimerDriver,
    pickedMac: string | null,
    reconnecting: boolean,
  ): Promise<void> => {
    if (!picked.gatt) {
      throw new Error('Selected device does not expose a GATT server.');
    }

    const currentGeneration = ++generation;
    connecting = true;
    device = picked;
    driver = pickedDriver;
    mac = pickedMac;
    kind = pickedDriver.kind;
    deviceName = prettyDeviceName(picked);

    try {
      const server = await picked.gatt.connect();
      if (currentGeneration !== generation) {
        throw new Error('Bluetooth timer connection was superseded.');
      }

      const onDisc = (): void => {
        if (tearingDown || currentGeneration !== generation) return;
        handleConnectionLost(currentGeneration);
      };
      onGattDisconnected = onDisc;
      picked.addEventListener('gattserverdisconnected', onDisc);

      const started = await pickedDriver.start(server, (ev) => {
        if (currentGeneration !== generation) return;
        if (ev.state === 'DISCONNECT') {
          handleConnectionLost(currentGeneration);
          return;
        }
        emit(ev);
      }, { mac: pickedMac });

      if (currentGeneration !== generation) {
        started.cleanup();
        throw new Error('Bluetooth timer disconnected during setup.');
      }

      cleanup = started.cleanup;
      connected = true;
      connecting = false;
      state = 'IDLE';
      // A normal connect is snapshotted by its awaiting caller. An automatic
      // reconnect has no caller, so publish one state event to refresh React.
      if (reconnecting) emit({ state: 'IDLE' });
    } catch (error) {
      if (currentGeneration === generation) {
        generation += 1;
        releaseConnection(!reconnecting);
      }
      throw error;
    }
  };

  const scheduleReconnect = (expectedGeneration: number): void => {
    cancelReconnect();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (expectedGeneration !== generation || !device || !driver) return;
      const reconnectDevice = device;
      const reconnectDriver = driver;
      const reconnectMac = mac;
      void attachKnownDevice(reconnectDevice, reconnectDriver, reconnectMac, true).catch(() => {
        // The source is already in DISCONNECT. Match csTimer's single delayed
        // retry and leave a further attempt to an explicit user action.
      });
    }, 2500);
  };

  function handleConnectionLost(currentGeneration: number): void {
    if (tearingDown || currentGeneration !== generation) return;
    if (!connected && !connecting) return;

    generation += 1;
    const reconnectGeneration = generation;
    releaseConnection(false);
    scheduleReconnect(reconnectGeneration);
    // Notify the owner before the generic DISCONNECT event clears its active
    // attempt bookkeeping. The connection has already been released, so both
    // callbacks still observe connected=false.
    opts.onConnectionLost?.();
    emit({ state: 'DISCONNECT' });
  }

  const connectDevice = async (picked: BluetoothDevice): Promise<void> => {
    if (connected || connecting) return;

    cancelReconnect();
    generation += 1;
    releaseConnection(true);

    const picker = pickDriver(picked);
    if (!picker) {
      throw new Error(`Unrecognised smart timer: ${picked.name ?? '(no name)'}`);
    }
    const setupGeneration = generation;
    connecting = true;
    // Resolve the MAC BEFORE opening GATT — advertisements stop once the
    // browser connects. csTimer's qiyitimer.js does the same.
    let resolvedMac: string | null = null;
    try {
      if (picker.needsMac) {
        const advertisedMac = normalizeMac(
          await watchAdvertisementsMac(picked, { specs: [QIYI_MAC_ADV] }),
        );
        if (setupGeneration !== generation) return;
        const suggestedMac = qiyiTimerMacFromName(picked.name) ?? undefined;
        resolvedMac = advertisedMac;
        // Match csTimer's `reqMacAddr(true, ...)`: when the advertisement API
        // cannot reveal the real address, show the name-derived default for
        // confirmation instead of silently opening a connection with a guess.
        if (!resolvedMac && opts.onNeedMac) {
          try { resolvedMac = normalizeMac(await opts.onNeedMac(picked.name ?? '', suggestedMac)); }
          catch { resolvedMac = null; }
        }
        if (setupGeneration !== generation) return;
        // QiYi ignores a hello without the exact MAC, leaving a connection
        // that looks successful but never emits data. Cancelling the manual
        // fallback must therefore cancel the connection before GATT opens.
        if (!resolvedMac) {
          connecting = false;
          return;
        }
      }

      connecting = false;
      await attachKnownDevice(picked, picker, resolvedMac, false);
    } catch (error) {
      if (setupGeneration === generation) connecting = false;
      throw error;
    }
  };

  return {
    get kind() { return kind; },
    get deviceName() { return deviceName; },
    get connected() { return connected; },
    get state() { return state; },
    get lastTimeMs() { return lastTimeMs; },

    subscribe(listener: ExternalTimerListener): () => void {
      return bus.subscribe(listener);
    },

    async connect(): Promise<void> {
      if (connected || connecting) return;
      const pickerGeneration = ++generation;
      connecting = true;
      let picked: BluetoothDevice | null;
      try {
        picked = await requestBluetoothDevice(bluetoothTimerPickerOptions);
      } catch (error) {
        if (pickerGeneration === generation) connecting = false;
        throw error;
      }
      if (pickerGeneration !== generation) return;
      connecting = false;
      if (!picked) return;
      await connectDevice(picked);
    },

    connectDevice,

    async disconnect(): Promise<void> {
      const wasActive = connected || connecting;
      if (!wasActive && !device && reconnectTimer === null) return;
      cancelReconnect();
      generation += 1;
      releaseConnection(true);
      if (wasActive) emit({ state: 'DISCONNECT' });
    },
  };
}

/* ------------------------------------------------------------------ */
/*  React hook                                                         */
/* ------------------------------------------------------------------ */

export interface UseBluetoothTimerOptions extends BluetoothTimerSourceOptions {
  /** Every decoded state change, in arrival order. */
  onEvent?: (ev: ExternalTimerEvent) => void;
  /**
   * The one callback most consumers need: a solve was recorded BY THE DEVICE.
   * `ms` is the device's own measurement — do not re-time it locally.
   */
  onStop?: (ms: number, ev: ExternalTimerEvent) => void;
}

export interface BluetoothTimerHandle {
  status: ExternalTimerStatus;
  /** Most recent event, or null before the first one. */
  lastEvent: ExternalTimerEvent | null;
  /** Open the picker + connect. Must be called from a user gesture. */
  connect(): Promise<void>;
  /** Connect a device already returned by a shared Web Bluetooth chooser. */
  connectDevice(device: BluetoothDevice): Promise<void>;
  disconnect(): void;
  /** Escape hatch for callers that want the raw source (e.g. to subscribe). */
  source: BluetoothTimerSource;
}

const DISCONNECTED_STATUS: ExternalTimerStatus = {
  connected: false,
  kind: 'unknown',
  deviceName: '',
  state: 'DISCONNECT',
  lastTimeMs: 0,
};

export function useBluetoothTimer(opts: UseBluetoothTimerOptions = {}): BluetoothTimerHandle {
  const [status, setStatus] = useState<ExternalTimerStatus>(DISCONNECTED_STATUS);
  const [lastEvent, setLastEvent] = useState<ExternalTimerEvent | null>(null);

  // Refs so the long-lived source closure never captures a stale callback.
  const onEventRef = useRef(opts.onEvent);
  const onStopRef = useRef(opts.onStop);
  const onNeedMacRef = useRef(opts.onNeedMac);
  const onConnectionLostRef = useRef(opts.onConnectionLost);
  useEffect(() => { onEventRef.current = opts.onEvent; }, [opts.onEvent]);
  useEffect(() => { onStopRef.current = opts.onStop; }, [opts.onStop]);
  useEffect(() => { onNeedMacRef.current = opts.onNeedMac; }, [opts.onNeedMac]);
  useEffect(() => { onConnectionLostRef.current = opts.onConnectionLost; }, [opts.onConnectionLost]);

  const sourceRef = useRef<BluetoothTimerSource | null>(null);
  if (sourceRef.current === null) {
    sourceRef.current = createBluetoothTimerSource({
      onNeedMac: (name) => onNeedMacRef.current?.(name) ?? Promise.resolve(null),
      onConnectionLost: () => onConnectionLostRef.current?.(),
    });
  }
  const source = sourceRef.current;

  useEffect(() => {
    const unsub = source.subscribe((ev) => {
      setLastEvent(ev);
      setStatus(snapshotExternalTimer(source));
      onEventRef.current?.(ev);
      if (ev.state === 'STOPPED' && typeof ev.solveTime === 'number') {
        onStopRef.current?.(ev.solveTime, ev);
      }
    });
    return () => {
      unsub();
      void source.disconnect();
    };
  }, [source]);

  const connect = useCallback(async (): Promise<void> => {
    await source.connect();
    setStatus(snapshotExternalTimer(source));
  }, [source]);

  const connectDevice = useCallback(async (device: BluetoothDevice): Promise<void> => {
    await source.connectDevice(device);
    setStatus(snapshotExternalTimer(source));
  }, [source]);

  const disconnect = useCallback((): void => {
    void source.disconnect();
    setStatus(snapshotExternalTimer(source));
  }, [source]);

  return { status, lastEvent, connect, connectDevice, disconnect, source };
}
