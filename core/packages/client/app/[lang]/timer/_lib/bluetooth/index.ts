/**
 * Public API for the smart-cube Bluetooth integration.
 *
 *   import { useBluetoothCube } from './bluetooth';
 *
 *   const cube = useBluetoothCube({
 *     onMove: (m) => console.log('move', m),
 *     onSolved: () => stopTimer(),
 *     onGyro: (q) => { quatRef.current = q; },   // optional; see below
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
 * Orientation (gyroscope):
 *   Pass `onGyro` to receive raw scalar-first quaternions from the cube's
 *   sensor. `status.hasGyro` says whether the connected brand's protocol
 *   carries orientation at all — currently GAN gen2, GAN gen4, GoCube and
 *   MoYu32; GAN gen3 has no such message, and QiYi's is undocumented.
 *   Samples are RAW: calibration, per-brand axis remap and smoothing all
 *   live in `./orientation.ts`.
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
import type { CubeDriver, GyroSink } from './driver';
// detectBluetoothEnv re-exported above; the connect() helper uses it
// indirectly via the env-tagged error and the surrounding consumer.
import { ganV2Driver } from './gan_v2';
import { ganV3Driver } from './gan_v3';
import { ganV4Driver } from './gan_v4';
import { giikerDriver } from './giiker';
import { gocubeDriver } from './gocube';
import { moyuDriver } from './moyu';
import { moyu32Driver } from './moyu32';
import { qiyiDriver } from './qiyi';
import { CubeStateTracker } from './state_track';
import { MoveClock } from './move_clock';
import { armedFakeCube } from './fake_cube';
import { applyHijack, makeHijack, type StateHijack } from './state_hijack';
import { toFaceletString, fromFaceletString } from '../cube/state';
import { stepSolved, type CubeStep } from '../cube/steps';
import { watchAdvertisementsMac, savedMac, saveMac, clearMac, parseMacFromName, normalizeMac } from './mac';
import { BluetoothConnectError, atStage, isNoDeviceSelected } from './connect_error';
import type { BluetoothCubeStatus } from './types';

export type { BluetoothCubeStatus, CubeBrand } from './types';
export type { CubeDriver, CubeDriverStartResult, GyroSink, GyroQuaternion, GyroVelocity } from './driver';
export { detectBluetoothEnv, envAdvice, isBluefy } from './env';
export type { BluetoothEnv, EnvAdvice } from './env';
export { BluetoothConnectError, CONNECT_STAGE_LABEL, describeError } from './connect_error';
export type { ConnectStage } from './connect_error';

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
const DRIVERS: CubeDriver[] = [
  ganV3Driver, gocubeDriver, ganV4Driver, qiyiDriver,
  moyu32Driver, moyuDriver, giikerDriver, ganV2Driver,
];

function pickDriver(device: BluetoothDevice): CubeDriver | null {
  for (const d of DRIVERS) if (d.matches(device)) return d;
  return null;
}

/**
 * Union of every driver's advertised Company Identifier Codes. Chrome strips
 * manufacturer data for any CIC you didn't name in `optionalManufacturerData`,
 * so a brand missing from this list can never auto-detect its MAC and always
 * falls through to the manual prompt. cstimer builds the same union in
 * `bluetooth.js:81`.
 */
const ALL_CICS: number[] = Array.from(
  new Set(DRIVERS.flatMap((d) => (d.macAdv ? [...d.macAdv.cics] : []))),
);

/**
 * What we hand `requestDevice`. Two shapes, differing *only* in how the chooser
 * is populated:
 *
 *   - filtered (default) — only devices advertising a driver's service UUID, or
 *     carrying a known name prefix, reach the chooser. Some firmwares omit the
 *     data service from their scan record, hence both halves.
 *   - `acceptAllDevices` — every BLE device nearby, user picks by name.
 *
 * The second exists because the filter set is the one part of this call a
 * browser can reject before showing anything: iOS Bluefy bridges Web Bluetooth
 * to native code and has failed the filtered call outright with an opaque `2`,
 * with no chooser and nothing to act on. Dropping the filters is the only lever
 * we have from here, and it costs the user one extra look at a longer list.
 *
 * `optionalServices` / `optionalManufacturerData` stay in both: they don't
 * populate the chooser, they authorise what we may read afterwards, and without
 * them a device picked either way is unusable (no GATT service access, and no
 * manufacturer data to recover a GAN/MoYu/QiYi MAC from). Everything after the
 * chooser — driver selection, MAC, handshake — is identical.
 */
export interface ConnectPickOptions {
  /**
   * Skip the filters and let the chooser list every BLE device nearby. Only
   * worth setting after a filtered attempt has failed at the picker stage —
   * see `pickerOptions`.
   */
  acceptAllDevices?: boolean;
}

export function pickerOptions(acceptAllDevices: boolean): RequestDeviceOptions {
  const optional = new Set<string | number>();
  for (const d of DRIVERS) {
    optional.add(d.service);
    for (const s of d.optionalServices ?? []) optional.add(s);
  }
  const shared = {
    optionalServices: Array.from(optional),
    // Every brand's CICs, not just GAN's — see ALL_CICS.
    optionalManufacturerData: ALL_CICS,
  };
  if (acceptAllDevices) return { ...shared, acceptAllDevices: true };
  return {
    ...shared,
    filters: [
      ...DRIVERS.map((d) => ({ services: [d.service] })),
      { namePrefix: 'GAN' },
      { namePrefix: 'MG' },
      { namePrefix: 'AiCube' },
      { namePrefix: 'Gi' },
      // MoYu32 (WeiLong V10 Ai and later) advertise as `WCU_MY32_XXYY`.
      { namePrefix: 'WCU' },
    ],
  };
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
  /**
   * Tracked cube state as a 54-character facelet string (`URFDLB` order), or
   * null when no cube is connected. Prefer this over `getFaces()` in render
   * paths: it is state, so it re-renders, and it is always the state AFTER the
   * move being reported.
   */
  facelets: string | null;
  /** Open the picker + connect. Rejects with a {@link BluetoothConnectError}. */
  connect(pick?: ConnectPickOptions): Promise<void>;
  /** Disconnect + cleanup. */
  disconnect(): void;
  /** Reset internal cube state to "solved" (after the user resets the cube physically). */
  resetState(): void;
  /**
   * Snapshot of the live cube state, for CFOP stage detection or any other
   * read-only inspection. Returns null when no cube is connected.
   */
  getFaces(): import('../cube/state').CubeFaces | null;
  /**
   * Turn the cube's orientation stream on/off, for brands whose firmware
   * gates it (MoYu32). No-op for the rest — GAN and GoCube push orientation
   * unconditionally and there is nothing to switch. Resolves false when the
   * connected cube has no such switch.
   */
  setGyro(enabled: boolean): Promise<boolean>;
  /**
   * Report the cube's CURRENT state as `target` from now on, so a trainer can
   * present the next case without the user setting it up by hand. Returns true
   * once the cube reports `target` — including when it already did and no offset
   * was needed — and false only when a state was unusable and nothing changed.
   *
   * While this is in effect, `facelets` / `getFaces()` describe the training
   * frame and NOT the cube in the user's hands — anything that cares about the
   * real cube (a scramble check, a WCA solve) must clear it first.
   *
   * `step` says what finishing this case means, and is applied in the same
   * breath as the state rather than by re-rendering with a new `solvedStep`.
   * Drilling a mixed set changes both at once, and doing it in two steps has a
   * window in which the old step judges the new case — see `hijackStepRef`.
   * Omit it to keep judging by `solvedStep`.
   */
  hijackTo(target: import('../cube/state').CubeFaces | string, step?: CubeStep): boolean;
  /** Drop the hijack: go back to reporting the physical cube. */
  clearHijack(): void;
  /** True while a hijack is in effect. */
  hijacked: boolean;
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
  /**
   * Called for every orientation sample the connected cube reports, as a
   * RAW scalar-first quaternion in the cube's own sensor frame plus (when the
   * protocol carries one) an angular velocity. Calibration, the per-brand
   * axis basis and smoothing live in `./orientation.ts` — do not apply them
   * here.
   *
   * Passing this is also what ASKS for orientation: brands with a firmware
   * gyro switch (MoYu32's 0xAC) only enable their stream when a listener
   * exists, so an unused feed never costs battery or BLE bandwidth. Check
   * `status.hasGyro` to know whether samples can arrive at all.
   *
   * Fires at up to ~50 Hz. Keep the handler cheap — push into a ref and let
   * a rAF loop render, never setState per sample.
   */
  onGyro?: GyroSink;
  /**
   * Which step has to be finished for `onSolved` to fire. Defaults to a full
   * solve; a trainer drilling one step sets it to that step, so the timer stops
   * when OLL is oriented rather than making the user finish the cube.
   */
  solvedStep?: CubeStep;
}

const INITIAL_STATUS: BluetoothCubeStatus = {
  connected: false,
  brand: 'unknown',
  battery: null,
  deviceName: '',
  hasGyro: false,
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
  /**
   * The tracked state as a facelet string, pushed rather than pulled.
   * `getFaces()` reads a ref, so a consumer calling it from its own onMove
   * handler used to depend on our internal ordering; this is a plain value
   * that is always the state after the move that triggered the render.
   */
  const [facelets, setFacelets] = useState<string | null>(null);

  // Refs so the GATT-event closure doesn't capture stale callback refs.
  const onMoveRef = useRef(opts.onMove);
  const onSolvedRef = useRef(opts.onSolved);
  const onConnectionEventRef = useRef(opts.onConnectionEvent);
  useEffect(() => { onMoveRef.current = opts.onMove; }, [opts.onMove]);
  useEffect(() => { onSolvedRef.current = opts.onSolved; }, [opts.onSolved]);
  useEffect(() => { onConnectionEventRef.current = opts.onConnectionEvent; }, [opts.onConnectionEvent]);
  const onNeedMacRef = useRef(opts.onNeedMac);
  useEffect(() => { onNeedMacRef.current = opts.onNeedMac; }, [opts.onNeedMac]);
  const onGyroRef = useRef(opts.onGyro);
  useEffect(() => { onGyroRef.current = opts.onGyro; }, [opts.onGyro]);
  // Stable trampoline so drivers keep firing into the LATEST callback across
  // re-renders without us having to re-subscribe the characteristic. We hand
  // drivers this (never `opts.onGyro`) — and only when the consumer actually
  // wants orientation, because passing it is what makes MoYu32 send its 0xAC
  // enable command during the handshake.
  const gyroSink = useRef<GyroSink>((q, v) => { onGyroRef.current?.(q, v); }).current;

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
  // Driver-provided orientation switch, when the brand has one (MoYu32).
  const setGyroRef = useRef<((enabled: boolean) => Promise<void>) | null>(null);
  const disconnectListenerRef = useRef<((ev: Event) => void) | null>(null);
  const wasSolvedRef = useRef<boolean>(true);
  /**
   * Training-mode offset: non-null means what we publish is a relabelling of
   * the physical cube, not the cube itself. See `./state_hijack.ts`.
   */
  const hijackRef = useRef<StateHijack | null>(null);
  const [hijacked, setHijacked] = useState(false);
  /**
   * Which step counts as done. A full solve unless a caller is drilling one.
   *
   * Two sources, and the split matters: the option is a render-time preference
   * copied in by an effect, while `hijackTo` sets one SYNCHRONOUSLY alongside
   * the state it installs. A trainer that changed the step by re-rendering
   * would have a window between the two — the offset in place, the step still
   * the previous case's — and if the new case happened to satisfy the old step,
   * `publishSolved` would latch `wasSolved` on a state nobody solved. The real
   * finish then produces no edge at all and the clock never stops. Mixed
   * sessions, where consecutive cases genuinely want different steps, hit that
   * on their first PLL after an OLL.
   */
  const optionStepRef = useRef<CubeStep>(opts.solvedStep ?? 'solved');
  const hijackStepRef = useRef<CubeStep | null>(null);
  useEffect(() => { optionStepRef.current = opts.solvedStep ?? 'solved'; }, [opts.solvedStep]);
  const activeStep = () => hijackStepRef.current ?? optionStepRef.current;
  // True only when the user (or unmount) explicitly tore the connection
  // down. The gattserverdisconnected handler reads this to decide whether
  // to attempt auto-reconnect.
  const intentionalDisconnectRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set while a reconnect attempt is in flight, so we don't double-fire from
  // overlapping disconnect events.
  const reconnectInFlightRef = useRef<boolean>(false);
  /** Reconciles the cube's clock with ours. Reset on every (re)connect. */
  const moveClockRef = useRef<MoveClock>(new MoveClock());

  /**
   * Publish a solved/unsolved transition. Both the move path and the
   * cube-reported-state path funnel through here so that "the cube is now
   * solved" fires `onSolved` — which is what stops the timer — no matter
   * which of the two established it. A brand whose protocol reports state on
   * every frame (QiYi) would otherwise flip `wasSolved` silently and swallow
   * the very edge the timer is waiting for.
   */
  const publishSolved = useCallback((isSolved: boolean) => {
    if (isSolved && !wasSolvedRef.current) {
      wasSolvedRef.current = true;
      setSolved(true);
      onSolvedRef.current?.();
    } else if (!isSolved && wasSolvedRef.current) {
      wasSolvedRef.current = false;
      setSolved(false);
    }
  }, []);

  /**
   * Publish the tracked state, seen through the hijack (if any).
   *
   * Both the move path and the state-dump path go through here, and so does
   * every reset, so there is exactly one place where "what the cube reports"
   * turns into "what the timer sees". The solved edge is decided from the SAME
   * string that is published — with a hijack in play, the raw tracker's opinion
   * of "solved" is about a cube nobody is looking at.
   */
  const publishState = useCallback((rawFacelets: string) => {
    const view = applyHijack(hijackRef.current, rawFacelets);
    setFacelets(view);
    publishSolved(stepSolved(activeStep(), view));
  }, [publishSolved]);

  const handleMove = useCallback((move: string, deviceTs?: number) => {
    // First successfully-decoded move proves the MAC: persist it now. We
    // deliberately don't save before a move lands, to avoid caching a wrong
    // MAC the user typed (which would silently poison every reconnect).
    const ps = pendingSaveMacRef.current;
    if (ps) { saveMac(ps.name, ps.mac); pendingSaveMacRef.current = null; }
    // Arrival time, as close to characteristic-value-changed as possible —
    // drivers call this synchronously from their notification handler. When
    // the cube sent its own clock reading, `MoveClock` uses that instead: BLE
    // batches notifications per connection interval, so arrival times cluster
    // and cannot resolve the gaps between fast consecutive turns. Everything
    // downstream (TPS, pauses, per-phase splits) is built on those gaps.
    const ts = moveClockRef.current.stamp(deviceTs, performance.now());
    // Advance the model BEFORE telling anyone. Subscribers routinely read the
    // cube state from inside their onMove handler (the scramble check does),
    // and notifying first hands them the state as it was one move ago — which
    // is exactly one move short at the instant a scramble is completed, so the
    // check fires "doesn't match the scramble" on a cube that does.
    trackerRef.current.applyMove(move);
    setLastMove(move);
    onMoveRef.current?.(move, ts);
    // Through `publishState`, NOT the tracker's own opinion of "solved": the
    // tracker knows nothing about a training offset or about stopping on a
    // sub-step, so publishing its verdict here would leave every drill unable
    // to finish — the two would only agree in the one case where there is no
    // offset and the step is a full solve.
    publishState(toFaceletString(trackerRef.current.getFaces()));
  }, [publishState]);

  /**
   * The cube told us where it actually is. Adopt it wholesale — this reading
   * beats anything we inferred from the move stream, which is exactly why the
   * drivers only fire it for states that passed a validity check.
   *
   * GAN emits this at connect and after a resync request, i.e. while the cube
   * is sitting still. QiYi emits it on every state frame, right after the
   * moves in that frame, so a dropped move heals on the next turn instead of
   * poisoning the rest of the session.
   *
   * The solved edge goes through the same publisher as the move path: if the
   * cube's own report is what establishes that it is solved, that still has to
   * stop the timer.
   */
  const handleCubeState = useCallback((facelets: string) => {
    if (!trackerRef.current.adoptFacelets(facelets)) return;
    publishState(facelets);
  }, [publishState]);

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
      setFacelets(null);
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

      // Re-run the driver handshake to resume the move stream. Re-arm the
      // gyro sink too, or orientation would silently die after any drop.
      const started = await driver.start(server, handleMove, {
        mac: macRef.current,
        onState: handleCubeState,
        onGyro: onGyroRef.current ? gyroSink : undefined,
      });
      cleanupRef.current = started.cleanup;
      setGyroRef.current = started.setGyro ?? null;

      // The cube may have been turned during the outage, so the in-memory
      // state is worthless. Brands that report their own state re-seed us via
      // `handleCubeState` as part of the handshake; for the rest, solved is
      // the only baseline we have.
      trackerRef.current.reset();
      // The cube was out of contact and may have been turned, so an offset
      // measured before the outage no longer means anything.
      hijackRef.current = null;
      hijackStepRef.current = null;
      setHijacked(false);
      wasSolvedRef.current = true;
      setSolved(true);
      publishState(toFaceletString(trackerRef.current.getFaces()));
      setLastMove(null);

      setStatus({
        connected: true,
        brand: driver.brand,
        battery: null,
        deviceName: prettyDeviceName(device),
        hasGyro: driver.hasGyro === true,
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
        setFacelets(null);
        return;
      }
      scheduleReconnectRef.current?.(next);
    }
  }, [handleMove, handleCubeState]);

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
    setGyroRef.current = null;
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
    setFacelets(null);
    onConnectionEventRef.current?.({ kind: 'disconnected', reason });
  }, [cancelPendingReconnect]);

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
    internalDisconnect('manual');
  }, [internalDisconnect]);

  const resetState = useCallback(() => {
    trackerRef.current.reset();
    // "The cube in my hands is solved" is a statement about the PHYSICAL cube,
    // so any pretence about where it is has to go with it.
    hijackRef.current = null;
    hijackStepRef.current = null;
    setHijacked(false);
    wasSolvedRef.current = true;
    setSolved(true);
    publishState(toFaceletString(trackerRef.current.getFaces()));
  }, [publishState]);

  const hijackTo = useCallback((target: import('../cube/state').CubeFaces | string, step?: CubeStep): boolean => {
    const raw = toFaceletString(trackerRef.current.getFaces());
    const wanted = typeof target === 'string' ? target : toFaceletString(target);
    const h = makeHijack(raw, target);
    // `makeHijack` returns null for two very different reasons. "The cube is
    // already there" still has to install the step and publish — otherwise a
    // case that happens to match the cube's current state would be judged by the
    // PREVIOUS case's step. "Unusable state" must change nothing at all.
    if (!h && raw !== wanted) return false;
    hijackRef.current = h;
    // Set before publishing, not by a re-render: see `hijackStepRef`.
    hijackStepRef.current = step ?? null;
    setHijacked(h !== null);
    // Publish at once: the case has to appear without waiting for a turn.
    publishState(raw);
    return true;
  }, [publishState]);

  const clearHijack = useCallback(() => {
    if (!hijackRef.current && hijackStepRef.current === null) return;
    hijackRef.current = null;
    hijackStepRef.current = null;
    setHijacked(false);
    publishState(toFaceletString(trackerRef.current.getFaces()));
  }, [publishState]);

  /**
   * Everything after "we have a device": open GATT, pick the driver from the
   * services it actually exposes, settle the MAC, run the handshake. Shared by
   * the picker path and the dev fake cube so neither can drift from the other.
   */
  const attachToDevice = useCallback(async (
    device: BluetoothDevice,
    advMac: string | null,
  ): Promise<void> => {
    if (!device.gatt) {
      throw new BluetoothConnectError('gatt', 'Selected device does not expose a GATT server.');
    }
    let server: BluetoothRemoteGATTServer;
    try {
      server = await device.gatt.connect();
    } catch (err) {
      throw atStage('gatt', err);
    }

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
      throw new BluetoothConnectError('discover', `Unrecognised smart cube: ${device.name ?? '(no name)'}`);
    }

    // Resolve a MAC for MAC-keyed drivers: advertisement → saved → device-name
    // → manual prompt. Persist whatever we settle on. If still unknown the
    // driver falls back to a zero-MAC and simply won't decode — the UI then
    // offers a manual-MAC retry.
    let mac: string | null = null;
    if (driver.needsMac) {
      mac = normalizeMac(advMac)
        ?? savedMac(device.name)
        ?? parseMacFromName(device.name)
        // Vendor-documented per-model default derived from the device name
        // (MoYu32's `WCU_MY32_XXYY` → `CF:30:16:00:XX:YY`). Only brands that
        // publish such a prefix implement this — it is never an OUI guess.
        ?? driver.defaultMac?.(device)
        ?? null;
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
      const started = await driver!.start(server, handleMove, {
        mac: macToUse,
        onKeyError: handleKeyError,
        onState: handleCubeState,
        // Only hand the sink over when a consumer asked for orientation —
        // that's the signal MoYu32 uses to turn its 0xAB stream on.
        onGyro: onGyroRef.current ? gyroSink : undefined,
      });
      cleanupRef.current = started.cleanup;
      setGyroRef.current = started.setGyro ?? null;
      // Provisional baseline. Brands that report their own state (GAN v3/v4)
      // overwrite this within a frame or two via `handleCubeState`; the rest
      // have no way to tell us, so solved is the documented starting contract.
      trackerRef.current.reset();
      // A reconnect means a different clock anchor (and possibly a firmware
      // that restarted its counter), so never carry the old one across.
      moveClockRef.current.reset();
      hijackRef.current = null;
      hijackStepRef.current = null;
      setHijacked(false);
      wasSolvedRef.current = true;
      setSolved(true);
      publishState(toFaceletString(trackerRef.current.getFaces()));
      setLastMove(null);
      setStatus({
        connected: true,
        brand: driver!.brand,
        battery: null,
        deviceName: prettyDeviceName(device),
        hasGyro: driver!.hasGyro === true,
      });
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
      throw atStage('handshake', err);
    }
  }, [handleMove, handleCubeState, cancelPendingReconnect, internalDisconnect]);

  const connect = useCallback(async (pick?: ConnectPickOptions): Promise<void> => {
    // Dev escape hatch: `__cuberootFakeCube.arm()` in the console stands up a
    // fake GAN v4 peripheral so the whole smart-cube experience can be driven
    // without hardware. It joins the normal path below at the same point a real
    // device does — driver selection, MAC handling and the handshake all run
    // for real. Compiled out of production; see ./fake_cube.ts.
    const fake = armedFakeCube();
    if (fake) {
      intentionalDisconnectRef.current = false;
      cancelPendingReconnect();
      await attachToDevice(fake.device, fake.mac);
      return;
    }

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

    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice(
        pickerOptions(pick?.acceptAllDevices === true),
      );
    } catch (err) {
      // User cancelled the picker, denied permission, or no device found.
      // We don't throw — the caller asked us to connect; we just return
      // without changing state. Re-throw on truly unexpected errors.
      //
      // Matched by error *name* rather than `instanceof DOMException`: iOS
      // Bluefy bridges Web Bluetooth to native code and rejects with bare
      // values, so an instanceof test can never hold there and a dismissed
      // chooser would surface as a connection failure. See connect_error.ts.
      if (isNoDeviceSelected(err)) return;
      throw atStage('picker', err);
    }

    // Recover the MAC from a BLE advertisement BEFORE connecting (matches
    // cstimer's order; GAN / MoYu / QiYi need it for AES key derivation).
    // Best-effort: resolves null when unsupported or no manufacturer data.
    // It is documented never to reject; the tag is here so a broken contract
    // still names the step it broke in rather than arriving unlabelled.
    const advMac = await watchAdvertisementsMac(device)
      .catch((err: unknown) => { throw atStage('advertisement', err); });
    await attachToDevice(device, advMac);
  }, [attachToDevice, cancelPendingReconnect]);

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
      setGyroRef.current = null;
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
    if (!status.connected) return null;
    const raw = trackerRef.current.getFaces();
    const h = hijackRef.current;
    if (!h) return raw;
    // Consumers must see the same state `facelets` shows, hijack included —
    // otherwise the two disagree mid-training and whichever one a caller
    // happens to read decides its behaviour.
    return fromFaceletString(applyHijack(h, toFaceletString(raw))) ?? raw;
  }, [status.connected]);

  const setGyro = useCallback(async (enabled: boolean): Promise<boolean> => {
    const fn = setGyroRef.current;
    if (!fn) return false;
    try {
      await fn(enabled);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    status,
    lastMove,
    solved,
    facelets,
    connect,
    disconnect,
    resetState,
    getFaces,
    setGyro,
    hijackTo,
    clearHijack,
    hijacked,
  };
}
