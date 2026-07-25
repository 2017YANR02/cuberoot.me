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
  onNeedMac?: (deviceName: string) => Promise<string | null>;
  /** Fired when the GATT link drops on its own (not via disconnect()). */
  onConnectionLost?: () => void;
}

/**
 * Create a (disconnected) BLE timer source. One source handles one device at a
 * time; call connect() again after disconnect() to pick a different one.
 *
 * There is no auto-reconnect here, unlike the smart-cube hook: a timer that
 * drops mid-solve cannot have its reading recovered anyway, and csTimer also
 * just reports DISCONNECT and waits for the user.
 */
export function createBluetoothTimerSource(
  opts: BluetoothTimerSourceOptions = {},
): ExternalTimerSource {
  const bus = createExternalTimerBus();

  let device: BluetoothDevice | null = null;
  let cleanup: (() => void) | null = null;
  let onGattDisconnected: ((ev: Event) => void) | null = null;
  let connected = false;
  let state: ExternalTimerState = 'DISCONNECT';
  let lastTimeMs = 0;
  let deviceName = '';
  let kind: ExternalTimerKind = 'unknown';
  /** Set while disconnect() is unwinding, so the GATT listener stays quiet. */
  let tearingDown = false;

  const emit = (ev: ExternalTimerEvent): void => {
    state = ev.state;
    if (ev.state === 'STOPPED' && typeof ev.solveTime === 'number') {
      lastTimeMs = ev.solveTime;
    }
    bus.emit(ev);
  };

  const teardown = (reason: 'manual' | 'gatt-lost'): void => {
    tearingDown = true;
    try {
      cleanup?.();
      const dev = device;
      if (dev) {
        if (onGattDisconnected) {
          dev.removeEventListener('gattserverdisconnected', onGattDisconnected);
        }
        if (reason === 'manual' && dev.gatt?.connected) {
          try { dev.gatt.disconnect(); } catch { /* ignore */ }
        }
      }
    } finally {
      cleanup = null;
      device = null;
      onGattDisconnected = null;
      connected = false;
      deviceName = '';
      kind = 'unknown';
      tearingDown = false;
    }
    emit({ state: 'DISCONNECT' });
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
      if (connected) return;
      if (typeof navigator === 'undefined' || !navigator.bluetooth) {
        const err = new Error('NO_WEB_BLUETOOTH') as Error & { kind?: string };
        err.kind = 'no-web-bluetooth';
        throw err;
      }

      // csTimer filters smart timers by name prefix only — the GAN timer does
      // not advertise fff0 in its scan record, so a services filter misses it.
      const filters: BluetoothLEScanFilter[] = BLUETOOTH_TIMER_DRIVERS.flatMap((d) =>
        d.namePrefixes.map((namePrefix) => ({ namePrefix })));
      const optionalServices = Array.from(new Set(BLUETOOTH_TIMER_DRIVERS.map((d) => d.service)));
      const cics = Array.from(new Set(
        BLUETOOTH_TIMER_DRIVERS.flatMap((d) => Array.from(d.manufacturerDataCics ?? [])),
      ));

      let picked: BluetoothDevice;
      try {
        picked = await navigator.bluetooth.requestDevice({
          filters,
          optionalServices,
          optionalManufacturerData: cics,
        });
      } catch (err) {
        // Picker cancelled / nothing found: not an error the caller must show.
        if (err instanceof DOMException
          && (err.name === 'NotFoundError' || err.name === 'NotAllowedError')) {
          return;
        }
        throw err;
      }

      const picker = pickDriver(picked);
      if (!picker) {
        throw new Error(`Unrecognised smart timer: ${picked.name ?? '(no name)'}`);
      }
      if (!picked.gatt) {
        throw new Error('Selected device does not expose a GATT server.');
      }

      // Resolve the MAC BEFORE opening GATT — advertisements stop once the
      // browser connects. csTimer's qiyitimer.js does the same.
      let mac: string | null = null;
      if (picker.needsMac) {
        mac = normalizeMac(await watchAdvertisementsMac(picked, { specs: [QIYI_MAC_ADV] }))
          ?? qiyiTimerMacFromName(picked.name);
        if (!mac && opts.onNeedMac) {
          try { mac = normalizeMac(await opts.onNeedMac(picked.name ?? '')); }
          catch { mac = null; }
        }
      }

      const server = await picked.gatt.connect();

      const onDisc = (): void => {
        if (tearingDown || !connected) return;
        teardown('gatt-lost');
        opts.onConnectionLost?.();
      };
      picked.addEventListener('gattserverdisconnected', onDisc);

      try {
        const started = await picker.start(server, emit, { mac });
        cleanup = started.cleanup;
      } catch (err) {
        picked.removeEventListener('gattserverdisconnected', onDisc);
        try { server.disconnect(); } catch { /* ignore */ }
        throw err;
      }

      device = picked;
      onGattDisconnected = onDisc;
      connected = true;
      kind = picker.kind;
      deviceName = prettyDeviceName(picked);
      state = 'IDLE';
    },

    async disconnect(): Promise<void> {
      if (!connected && !device) return;
      teardown('manual');
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
  disconnect(): void;
  /** Escape hatch for callers that want the raw source (e.g. to subscribe). */
  source: ExternalTimerSource;
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

  const sourceRef = useRef<ExternalTimerSource | null>(null);
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

  const disconnect = useCallback((): void => {
    void source.disconnect();
    setStatus(snapshotExternalTimer(source));
  }, [source]);

  return { status, lastEvent, connect, disconnect, source };
}
