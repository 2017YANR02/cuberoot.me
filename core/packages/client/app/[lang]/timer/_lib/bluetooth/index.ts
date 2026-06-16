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
 *
 * Auto-reconnect:
 *   When the GATT server emits `gattserverdisconnected` for reasons other
 *   than the user clicking Disconnect, we attempt up to 5 reconnects with
 *   exponential backoff (1s, 2s, 4s, 8s, 16s) on the cached BluetoothDevice.
 *   The picker is NOT shown again — Web Bluetooth retains permission for
 *   the same browser session. On final give-up the connection-state
 *   callback is fired with `{ kind: 'reconnect-failed' }`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CubeDriver } from './driver';
// detectBluetoothEnv re-exported above; the connect() helper uses it
// indirectly via the env-tagged error and the surrounding consumer.
import { ganV2Driver } from './gan_v2';
import { ganV3Driver } from './gan_v3';
import { ganV4Driver } from './gan_v4';
import { giikerDriver } from './giiker';
import { gocubeDriver } from './gocube';
import { moyuDriver } from './moyu';
import { qiyiDriver } from './qiyi';
import { CubeStateTracker } from './state_track';
import { GAN_CIC_LIST, watchAdvertisementsMac, savedMac, saveMac, clearMac, parseMacFromName, normalizeMac } from './mac';
import type { BluetoothCubeStatus } from './types';

export type { BluetoothCubeStatus, CubeBrand } from './types';
export type { CubeDriver, CubeDriverStartResult } from './driver';
export { detectBluetoothEnv, envAdvice, isBluefy } from './env';
export type { BluetoothEnv, EnvAdvice } from './env';

/* ------------------------------------------------------------------ */
/*  Connection-state event surface                                    */
/* ------------------------------------------------------------------ */

export type BluetoothConnectionEvent =
  | { kind: 'disconnected'; reason: 'gatt-lost' | 'manual' }
  | { kind: 'reconnecting'; attempt: number; maxAttempts: number; delayMs: number }
  | { kind: 'reconnected' }
  | { kind: 'reconnect-failed'; attempts: number };

const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];
const RECONNECT_MAX_ATTEMPTS = RECONNECT_BACKOFF_MS.length;

/* ------------------------------------------------------------------ */
/*  Driver registry                                                    */
/* ------------------------------------------------------------------ */

/**
 * Order matters: the picker uses these as filters, and the matcher walks
 * them in order to pick a driver after the user selects a device. Put the
 * fully-decoded brands first so we prefer them when a device matches more
 * than one regex (GAN v3 and v4 share the FFF0 service in some firmwares).
 */
const DRIVERS: CubeDriver[] = [ganV3Driver, gocubeDriver, ganV4Driver, qiyiDriver, moyuDriver, giikerDriver, ganV2Driver];

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
  /**
   * Called for connection-lifecycle events: drop, reconnect attempts, final
   * give-up. Useful for surfacing toasts to the user.
   */
  onConnectionEvent?: (ev: BluetoothConnectionEvent) => void;
  /**
   * Called when a MAC-keyed cube (GAN / MoYu / QiYi) needs its MAC and we
   * couldn't auto-detect it from advertisements / name / storage. Should
   * resolve a "XX:XX:XX:XX:XX:XX" string, or null if the user cancels.
   */
  onNeedMac?: (deviceName: string, isWrongKey?: boolean) => Promise<string | null>;
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
  const onConnectionEventRef = useRef(opts.onConnectionEvent);
  useEffect(() => { onMoveRef.current = opts.onMove; }, [opts.onMove]);
  useEffect(() => { onSolvedRef.current = opts.onSolved; }, [opts.onSolved]);
  useEffect(() => { onConnectionEventRef.current = opts.onConnectionEvent; }, [opts.onConnectionEvent]);
  const onNeedMacRef = useRef(opts.onNeedMac);
  useEffect(() => { onNeedMacRef.current = opts.onNeedMac; }, [opts.onNeedMac]);

  // Mutable runtime handles. We can't put these in state because they are
  // not serializable and updating them would re-render the consumer.
  const trackerRef = useRef<CubeStateTracker>(new CubeStateTracker());
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const macRef = useRef<string | null>(null);
  // MAC pending persistence — only written once a real move decodes, so a
  // wrong MAC the user typed never poisons storage.
  const pendingSaveMacRef = useRef<{ name: string | null; mac: string } | null>(null);
  const driverRef = useRef<CubeDriver | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const disconnectListenerRef = useRef<((ev: Event) => void) | null>(null);
  const wasSolvedRef = useRef<boolean>(true);
  // True only when the user (or unmount) explicitly tore the connection
  // down. The gattserverdisconnected handler reads this to decide whether
  // to attempt auto-reconnect.
  const intentionalDisconnectRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set while a reconnect attempt is in flight, so we don't double-fire from
  // overlapping disconnect events.
  const reconnectInFlightRef = useRef<boolean>(false);

  const handleMove = useCallback((move: string) => {
    // First successfully-decoded move proves the MAC: persist it now. We
    // deliberately don't save before a move lands, to avoid caching a wrong
    // MAC the user typed (which would silently poison every reconnect).
    const ps = pendingSaveMacRef.current;
    if (ps) { saveMac(ps.name, ps.mac); pendingSaveMacRef.current = null; }
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

  const cancelPendingReconnect = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectInFlightRef.current = false;
  }, []);

  // Forward declaration: scheduleReconnect calls attemptReconnect, which
  // itself can re-arm scheduleReconnect on failure. We resolve the cycle
  // through refs rather than mutual-recursive useCallbacks.
  const scheduleReconnectRef = useRef<((attempt: number) => void) | null>(null);

  const attemptReconnect = useCallback(async (attempt: number): Promise<void> => {
    reconnectInFlightRef.current = true;
    const device = deviceRef.current;
    const driver = driverRef.current;

    // Guard: device or driver got nulled out (manual disconnect / unmount
    // beat the timer). Bail.
    if (!device || !driver) {
      reconnectInFlightRef.current = false;
      return;
    }
    if (intentionalDisconnectRef.current) {
      reconnectInFlightRef.current = false;
      return;
    }
    if (!device.gatt) {
      // Browser revoked GATT access entirely; we can't recover.
      onConnectionEventRef.current?.({ kind: 'reconnect-failed', attempts: attempt });
      reconnectInFlightRef.current = false;
      // Fall through to a hard reset so the user can re-pair.
      deviceRef.current = null;
      driverRef.current = null;
      cleanupRef.current = null;
      disconnectListenerRef.current = null;
      setStatus(INITIAL_STATUS);
      return;
    }

    try {
      const server = await device.gatt.connect();
      // Re-attach the disconnect listener (the device may keep the old one,
      // but to be safe we strip + re-add a fresh closure).
      if (disconnectListenerRef.current) {
        device.removeEventListener('gattserverdisconnected', disconnectListenerRef.current);
      }
      const onDisc = (): void => {
        if (intentionalDisconnectRef.current) return;
        if (reconnectInFlightRef.current) return;
        onConnectionEventRef.current?.({ kind: 'disconnected', reason: 'gatt-lost' });
        scheduleReconnectRef.current?.(0);
      };
      device.addEventListener('gattserverdisconnected', onDisc);
      disconnectListenerRef.current = onDisc;

      // Re-run the driver handshake to resume the move stream.
      const started = await driver.start(server, handleMove, { mac: macRef.current });
      cleanupRef.current = started.cleanup;

      // Reset solved-tracker baseline (cube may have been turned during
      // the outage; we can't trust the in-memory state).
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

      void started.battery().then(b => {
        if (deviceRef.current === device) {
          setStatus(s => ({ ...s, battery: b }));
        }
      }).catch(() => {});

      reconnectInFlightRef.current = false;
      onConnectionEventRef.current?.({ kind: 'reconnected' });
    } catch {
      // Reconnect failed (timeout, GATT error, cube off, etc.).
      reconnectInFlightRef.current = false;
      if (intentionalDisconnectRef.current) return;
      const next = attempt + 1;
      if (next >= RECONNECT_MAX_ATTEMPTS) {
        onConnectionEventRef.current?.({ kind: 'reconnect-failed', attempts: next });
        // Hard reset — caller can call connect() again to re-pair.
        deviceRef.current = null;
        driverRef.current = null;
        cleanupRef.current = null;
        if (disconnectListenerRef.current) {
          try {
            device.removeEventListener('gattserverdisconnected', disconnectListenerRef.current);
          } catch { /* ignore */ }
        }
        disconnectListenerRef.current = null;
        setStatus(INITIAL_STATUS);
        return;
      }
      scheduleReconnectRef.current?.(next);
    }
  }, [handleMove]);

  const scheduleReconnect = useCallback((attempt: number) => {
    if (intentionalDisconnectRef.current) return;
    if (reconnectTimerRef.current != null) return; // already armed
    const delay = RECONNECT_BACKOFF_MS[attempt] ?? RECONNECT_BACKOFF_MS[RECONNECT_BACKOFF_MS.length - 1];
    onConnectionEventRef.current?.({
      kind: 'reconnecting',
      attempt: attempt + 1,
      maxAttempts: RECONNECT_MAX_ATTEMPTS,
      delayMs: delay,
    });
    // Mark disconnected in UI status while we're in retry purgatory.
    setStatus(s => (s.connected ? { ...s, connected: false } : s));
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      void attemptReconnect(attempt);
    }, delay);
  }, [attemptReconnect]);

  // Wire the ref so attemptReconnect (defined above) can invoke
  // scheduleReconnect after a failed try.
  useEffect(() => {
    scheduleReconnectRef.current = scheduleReconnect;
  }, [scheduleReconnect]);

  const internalDisconnect = useCallback((reason: 'manual' | 'gatt-lost') => {
    cancelPendingReconnect();
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
    driverRef.current = null;
    disconnectListenerRef.current = null;
    setStatus(INITIAL_STATUS);
    onConnectionEventRef.current?.({ kind: 'disconnected', reason });
  }, [cancelPendingReconnect]);

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
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

    // Fresh user-initiated connect: clear the intentional-disconnect flag
    // so a future drop will trigger auto-reconnect.
    intentionalDisconnectRef.current = false;
    cancelPendingReconnect();

    // requestDevice: match by known service UUIDs OR GAN-family name prefixes
    // (some firmwares don't advertise the data service in the scan record),
    // expose every driver service for post-connect probing, and request GAN
    // manufacturer data so we can recover the MAC from advertisements.
    const filters: BluetoothLEScanFilter[] = [
      ...DRIVERS.map(d => ({ services: [d.service] })),
      { namePrefix: 'GAN' },
      { namePrefix: 'MG' },
      { namePrefix: 'AiCube' },
      { namePrefix: 'Gi' },
    ];
    const optional = new Set<string | number>();
    for (const d of DRIVERS) {
      optional.add(d.service);
      for (const s of d.optionalServices ?? []) optional.add(s);
    }

    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: Array.from(optional),
        optionalManufacturerData: GAN_CIC_LIST,
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

    if (!device.gatt) {
      throw new Error('Selected device does not expose a GATT server.');
    }

    // Recover the MAC from a BLE advertisement BEFORE connecting (matches
    // cstimer's order; GAN / MoYu / QiYi need it for AES key derivation).
    // Best-effort: resolves null when unsupported or no manufacturer data.
    const advMac = await watchAdvertisementsMac(device);

    const server = await device.gatt.connect();

    // Pick the driver by which GATT service the cube actually exposes (GAN
    // v2/v3/v4 share no service, so this is unambiguous); fall back to name.
    let driver: CubeDriver | null = null;
    try {
      const services = await server.getPrimaryServices();
      const uuids = new Set(services.map(s => s.uuid.toLowerCase()));
      driver = DRIVERS.find(d => uuids.has(d.service.toLowerCase())) ?? null;
    } catch {
      // getPrimaryServices unsupported / failed — fall through to name match.
    }
    if (!driver) driver = pickDriver(device);
    if (!driver) {
      try { server.disconnect(); } catch { /* ignore */ }
      throw new Error(`Unrecognised smart cube: ${device.name ?? '(no name)'}`);
    }

    // Resolve a MAC for MAC-keyed drivers: advertisement → saved → device-name
    // → manual prompt. Persist whatever we settle on. If still unknown the
    // driver falls back to a zero-MAC and simply won't decode — the UI then
    // offers a manual-MAC retry.
    let mac: string | null = null;
    if (driver.needsMac) {
      mac = normalizeMac(advMac) ?? savedMac(device.name) ?? parseMacFromName(device.name);
      if (!mac && onNeedMacRef.current) {
        try { mac = normalizeMac(await onNeedMacRef.current(device.name ?? '')); }
        catch { mac = null; }
      }
    }
    macRef.current = mac;

    // A MAC-keyed cube with no MAC (user dismissed the prompt, nothing auto-
    // detected) can't decode anything — abort cleanly instead of showing a
    // dead "connected" state.
    if (driver.needsMac && !mac) {
      try { server.disconnect(); } catch { /* ignore */ }
      return;
    }

    // Wire up the disconnect listener BEFORE start() so we don't miss races.
    // On unexpected drop, fire the connection event then schedule the first
    // reconnect attempt with zero-index backoff (1s).
    const onDisc = (): void => {
      if (intentionalDisconnectRef.current) return;
      if (reconnectInFlightRef.current) return;
      // Tear down the live subscriptions but keep deviceRef/driverRef so
      // the reconnect path can reuse them.
      cleanupRef.current?.();
      cleanupRef.current = null;
      onConnectionEventRef.current?.({ kind: 'disconnected', reason: 'gatt-lost' });
      scheduleReconnectRef.current?.(0);
    };
    device.addEventListener('gattserverdisconnected', onDisc);
    disconnectListenerRef.current = onDisc;

    deviceRef.current = device;
    driverRef.current = driver;

    // `activate` (re)subscribes the driver with a given MAC. Factored out so a
    // wrong-MAC re-prompt can re-run it on the same open GATT connection. The
    // MAC is only persisted once a real move decodes (see handleMove).
    const activate = async (macToUse: string | null): Promise<void> => {
      macRef.current = macToUse;
      pendingSaveMacRef.current = macToUse ? { name: device.name ?? null, mac: macToUse } : null;
      const started = await driver!.start(server, handleMove, { mac: macToUse, onKeyError: handleKeyError });
      cleanupRef.current = started.cleanup;
      // Initialize tracker to solved (the user starts each session solved).
      trackerRef.current.reset();
      wasSolvedRef.current = true;
      setSolved(true);
      setLastMove(null);
      setStatus({ connected: true, brand: driver!.brand, battery: null, deviceName: prettyDeviceName(device) });
      // Read battery in the background; failures fall back to null silently.
      void started.battery().then(b => {
        if (deviceRef.current === device) setStatus(s => ({ ...s, battery: b }));
      }).catch(() => {});
    };

    // A MAC-keyed driver that decodes sustained garbage ⇒ the MAC is wrong.
    // Forget it, re-prompt (cstimer's keyCheck → reqMacAddr), and re-activate
    // on the still-open GATT. Guarded against re-entrancy.
    let keyErrorBusy = false;
    function handleKeyError(): void {
      if (!driver!.needsMac || keyErrorBusy) return;
      keyErrorBusy = true;
      void (async () => {
        cleanupRef.current?.();
        cleanupRef.current = null;
        clearMac(device.name);
        pendingSaveMacRef.current = null;
        let newMac: string | null = null;
        if (onNeedMacRef.current) {
          try { newMac = normalizeMac(await onNeedMacRef.current(device.name ?? '', true)); }
          catch { newMac = null; }
        }
        keyErrorBusy = false;
        if (newMac) {
          await activate(newMac).catch(() => {});
        } else {
          // User gave up — tear the connection down fully so a later GATT drop
          // doesn't auto-reconnect against the bad MAC.
          intentionalDisconnectRef.current = true;
          internalDisconnect('manual');
        }
      })();
    }

    try {
      await activate(mac);
    } catch (err) {
      device.removeEventListener('gattserverdisconnected', onDisc);
      disconnectListenerRef.current = null;
      try { server.disconnect(); } catch { /* ignore */ }
      throw err;
    }
  }, [handleMove, cancelPendingReconnect, internalDisconnect]);

  // Tear down on unmount so we don't leak GATT subscriptions.
  useEffect(() => {
    return () => {
      intentionalDisconnectRef.current = true;
      if (reconnectTimerRef.current != null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
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
      driverRef.current = null;
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
