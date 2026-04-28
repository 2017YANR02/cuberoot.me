/**
 * Public API for the smart-cube Bluetooth integration.
 *
 *   import { useBluetoothCube } from './bluetooth';
 *
 *   const cube = useBluetoothCube({
 *     onMove: (m) => console.log('move', m),
 *     onSolved: () => stopTimer(),
 *   });
 *
 *   <button onClick={cube.connect}>Connect cube</button>
 *
 * The hook is a no-op until `connect()` is called. On non-Web-Bluetooth
 * browsers (Safari, Firefox without flag) `connect()` rejects with a
 * descriptive Error; the rest of the handle stays in a benign disconnected
 * state so the timer page renders normally.
 *
 * Move-stream → solved-detection contract:
 *   1. The user resets the cube physically before each scramble.
 *   2. The caller invokes `resetState()` at solve start (or any time it
 *      needs the tracker to re-base on solved).
 *   3. Each subsequent move advances an internal 3x3 model. When the model
 *      returns to the canonical solved configuration, `onSolved` fires once
 *      and `solved` flips true. It stays true until the next move.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CubeDriver } from './driver';
// detectBluetoothEnv re-exported above; the connect() helper uses it
// indirectly via the env-tagged error and the surrounding consumer.
import { ganV3Driver } from './gan_v3';
import { ganV4Driver } from './gan_v4';
import { giikerDriver } from './giiker';
import { gocubeDriver } from './gocube';
import { qiyiDriver } from './qiyi';
import { CubeStateTracker } from './state_track';
import type { BluetoothCubeStatus } from './types';

export type { BluetoothCubeStatus, CubeBrand } from './types';
export type { CubeDriver, CubeDriverStartResult } from './driver';
export { detectBluetoothEnv, envAdvice, isBluefy } from './env';
export type { BluetoothEnv, EnvAdvice } from './env';

/* ------------------------------------------------------------------ */
/*  Driver registry                                                    */
/* ------------------------------------------------------------------ */

/**
 * Order matters: the picker uses these as filters, and the matcher walks
 * them in order to pick a driver after the user selects a device. Put the
 * fully-decoded brands first so we prefer them when a device matches more
 * than one regex (GAN v3 and v4 share the FFF0 service in some firmwares).
 */
const DRIVERS: CubeDriver[] = [ganV3Driver, gocubeDriver, ganV4Driver, qiyiDriver, giikerDriver];

function pickDriver(device: BluetoothDevice): CubeDriver | null {
  for (const d of DRIVERS) if (d.matches(device)) return d;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export interface BluetoothCubeHandle {
  status: BluetoothCubeStatus;
  /** Most recent move (face notation). null until first move arrives. */
  lastMove: string | null;
  /** Current solved state (true = solved). */
  solved: boolean;
  /** Open the picker + connect. */
  connect(): Promise<void>;
  /** Disconnect + cleanup. */
  disconnect(): void;
  /** Reset internal cube state to "solved" (after the user resets the cube physically). */
  resetState(): void;
  /**
   * Snapshot of the live cube state, for CFOP stage detection or any other
   * read-only inspection. Returns null when no cube is connected.
   */
  getFaces(): import('../cube/state').CubeFaces | null;
}

interface UseBluetoothCubeOpts {
  /** Called for each move. `timestamp` is `performance.now()` captured when
   * the BLE characteristic value arrived (absolute high-res ms). The caller
   * is responsible for re-basing it against any "solve start" reference. */
  onMove?: (move: string, timestamp: number) => void;
  /** Called when state transitions from unsolved → solved. */
  onSolved?: () => void;
}

const INITIAL_STATUS: BluetoothCubeStatus = {
  connected: false,
  brand: 'unknown',
  battery: null,
  deviceName: '',
};

function prettyDeviceName(device: BluetoothDevice): string {
  const n = device.name ?? 'Smart cube';
  // Trim "GAN-XXYYZZ" → "GAN (XX:ZZ)" to mask the full ID while keeping the
  // last two bytes for users who own multiple cubes.
  const m = /^(.+?)-?([0-9A-F]{4,12})$/i.exec(n);
  if (m) {
    const tail = m[2];
    if (tail.length >= 4) {
      const xx = tail.slice(-4, -2);
      const zz = tail.slice(-2);
      return `${m[1]} (${xx}:${zz})`;
    }
  }
  return n;
}

export function useBluetoothCube(opts: UseBluetoothCubeOpts = {}): BluetoothCubeHandle {
  const [status, setStatus] = useState<BluetoothCubeStatus>(INITIAL_STATUS);
  const [lastMove, setLastMove] = useState<string | null>(null);
  const [solved, setSolved] = useState<boolean>(true);

  // Refs so the GATT-event closure doesn't capture stale callback refs.
  const onMoveRef = useRef(opts.onMove);
  const onSolvedRef = useRef(opts.onSolved);
  useEffect(() => { onMoveRef.current = opts.onMove; }, [opts.onMove]);
  useEffect(() => { onSolvedRef.current = opts.onSolved; }, [opts.onSolved]);

  // Mutable runtime handles. We can't put these in state because they are
  // not serializable and updating them would re-render the consumer.
  const trackerRef = useRef<CubeStateTracker>(new CubeStateTracker());
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const disconnectListenerRef = useRef<((ev: Event) => void) | null>(null);
  const wasSolvedRef = useRef<boolean>(true);

  const handleMove = useCallback((move: string) => {
    // Capture timestamp as close to characteristic-value-changed as possible.
    // Drivers call this synchronously from their notification handler, so
    // this is the freshest reading the JS event loop affords us.
    const ts = performance.now();
    setLastMove(move);
    onMoveRef.current?.(move, ts);
    const isSolved = trackerRef.current.applyMove(move);
    if (isSolved && !wasSolvedRef.current) {
      wasSolvedRef.current = true;
      setSolved(true);
      onSolvedRef.current?.();
    } else if (!isSolved && wasSolvedRef.current) {
      wasSolvedRef.current = false;
      setSolved(false);
    }
  }, []);

  const internalDisconnect = useCallback((reason: 'manual' | 'gatt-lost') => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    const dev = deviceRef.current;
    if (dev) {
      if (disconnectListenerRef.current) {
        dev.removeEventListener('gattserverdisconnected', disconnectListenerRef.current);
      }
      if (reason === 'manual' && dev.gatt?.connected) {
        try { dev.gatt.disconnect(); } catch { /* ignore */ }
      }
    }
    deviceRef.current = null;
    disconnectListenerRef.current = null;
    setStatus(INITIAL_STATUS);
  }, []);

  const disconnect = useCallback(() => {
    internalDisconnect('manual');
  }, [internalDisconnect]);

  const resetState = useCallback(() => {
    trackerRef.current.reset();
    wasSolvedRef.current = true;
    setSolved(true);
  }, []);

  const connect = useCallback(async (): Promise<void> => {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      // Tagged error: TimerPage swaps in env-specific advice modal.
      const err = new Error('NO_WEB_BLUETOOTH') as Error & { kind?: string };
      err.kind = 'no-web-bluetooth';
      throw err;
    }

    // Build a single requestDevice options blob from all known drivers.
    // Each driver contributes a service filter; optionalServices are merged.
    const filters = DRIVERS.map(d => ({ services: [d.service] }));
    const optional = new Set<string | number>();
    for (const d of DRIVERS) {
      for (const s of d.optionalServices ?? []) optional.add(s);
    }

    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: Array.from(optional),
      });
    } catch (err) {
      // User cancelled the picker, denied permission, or no device found.
      // We don't throw — the caller asked us to connect; we just return
      // without changing state. Re-throw on truly unexpected errors.
      if (err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'NotAllowedError')) {
        return;
      }
      throw err;
    }

    const driver = pickDriver(device);
    if (!driver) {
      throw new Error(`Unrecognised smart cube: ${device.name ?? '(no name)'}`);
    }

    if (!device.gatt) {
      throw new Error('Selected device does not expose a GATT server.');
    }

    const server = await device.gatt.connect();

    // Wire up the disconnect listener BEFORE start() so we don't miss races.
    const onDisc = (): void => {
      internalDisconnect('gatt-lost');
    };
    device.addEventListener('gattserverdisconnected', onDisc);
    disconnectListenerRef.current = onDisc;

    let started: { battery: () => Promise<number | null>; cleanup: () => void };
    try {
      started = await driver.start(server, handleMove);
    } catch (err) {
      device.removeEventListener('gattserverdisconnected', onDisc);
      disconnectListenerRef.current = null;
      try { server.disconnect(); } catch { /* ignore */ }
      throw err;
    }

    deviceRef.current = device;
    cleanupRef.current = started.cleanup;

    // Initialize tracker to solved (the user is expected to start each
    // session with a solved cube).
    trackerRef.current.reset();
    wasSolvedRef.current = true;
    setSolved(true);
    setLastMove(null);

    setStatus({
      connected: true,
      brand: driver.brand,
      battery: null,
      deviceName: prettyDeviceName(device),
    });

    // Read battery in the background; failures fall back to null silently.
    void started.battery().then(b => {
      // Only update if we're still connected to the same device.
      if (deviceRef.current === device) {
        setStatus(s => ({ ...s, battery: b }));
      }
    }).catch(() => {});
  }, [handleMove, internalDisconnect]);

  // Tear down on unmount so we don't leak GATT subscriptions.
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      const dev = deviceRef.current;
      if (dev) {
        if (disconnectListenerRef.current) {
          dev.removeEventListener('gattserverdisconnected', disconnectListenerRef.current);
        }
        try { dev.gatt?.disconnect(); } catch { /* ignore */ }
      }
      deviceRef.current = null;
      disconnectListenerRef.current = null;
    };
  }, []);

  const getFaces = useCallback(() => {
    return status.connected ? trackerRef.current.getFaces() : null;
  }, [status.connected]);

  return {
    status,
    lastMove,
    solved,
    connect,
    disconnect,
    resetState,
    getFaces,
  };
}
