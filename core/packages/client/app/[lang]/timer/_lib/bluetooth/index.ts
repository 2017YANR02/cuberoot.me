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
import {
  connectMiniProgramCubeBridge,
  mayUseMiniProgramBridge,
} from './miniprogram_bridge';

export type { BluetoothCubeStatus, CubeBrand } from './types';
export type { CubeDriver, CubeDriverStartResult, GyroSink, GyroQuaternion, GyroVelocity } from './driver';
import { isBluefy } from './env';
export {
  clientEnvironmentLabel,
  detectBluetoothEnv,
  detectClientEnvironment,
  envAdvice,
  isBluefy,
} from './env';
export type {
  BluetoothEnv,
  ClientBrowser,
  ClientEnvironment,
  ClientNavigatorSnapshot,
  ClientOS,
  EnvAdvice,
} from './env';
export { BluetoothConnectError, CONNECT_STAGE_LABEL, describeError } from './connect_error';
export type { ConnectStage } from './connect_error';
export { mayUseMiniProgramBridge } from './miniprogram_bridge';

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
const GAN_V1_SHARED_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
const GAN_V1_DEVICE_INFORMATION_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';

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

/** Canonical registry shared by the cube connector and unified device picker. */
export const CUBE_DRIVERS: readonly CubeDriver[] = DRIVERS;

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
 *   - filtered (default) — only devices carrying a known name prefix, or (off
 *     iOS) advertising a driver's service UUID, reach the chooser.
 *   - `acceptAllDevices` — every BLE device nearby, user picks by name.
 *
 * The second exists because a cube whose firmware advertises neither a known
 * service nor a known name prefix is invisible to the filtered chooser, and
 * this is the only way to reach it.
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

/**
 * Await `p`, but never longer than `ms`, and never throw.
 *
 * For calls that cross into native code. A bridged implementation can return a
 * promise that never settles — iOS Bluefy's `getAvailability()` has been seen
 * doing exactly that — and an unbounded await on one hangs the caller with no
 * error and nothing to report. Returns `undefined` on timeout or rejection;
 * callers that need the distinction should not be using this.
 */
async function withTimeout<T>(p: Promise<T> | undefined, ms: number): Promise<T | undefined> {
  if (!p) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<undefined>((resolve) => { timer = setTimeout(() => { resolve(undefined); }, ms); }),
    ]);
  } catch {
    return undefined;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** What `getAvailability()` had to say before we opened the picker. */
export type BluetoothReadiness =
  /** It said yes. */
  | 'ready'
  /** It kept saying no for the whole window. */
  | 'unavailable'
  /** No such method, or it never answered. Tells us nothing either way. */
  | 'unknown';

/**
 * Wait, briefly, for the adapter to report itself usable.
 *
 * iOS Bluefy starts with its native Bluetooth stack asleep: `getAvailability()`
 * answers false — or hangs outright — and every `requestDevice()` in that state
 * is refused with a bare `2`, no chooser, no message. Once something has woken
 * the stack, the exact same calls work. That is the whole of the bug reported
 * as "连接失败：2": not our filters, not our service UUIDs, not the origin.
 *
 * cstimer refuses to even try while this is false (`giikerutil.chkAvail`). We
 * don't go that far — Chrome answers false for adapter states whose picker still
 * behaves better than any message we could write — but we do wait a moment, and
 * we remember the answer so a later failure can be explained instead of dumped
 * on the user as a number.
 *
 * Every individual call is bounded: see {@link withTimeout}. So is the whole
 * loop, and tightly so away from Bluefy — this runs *before* `requestDevice`,
 * and Chrome's transient user activation expires about five seconds after the
 * tap. Spending three of them polling a browser that answered on the first try
 * would trade a bug we have for a bug we don't. Elsewhere we take one bounded
 * reading, purely so a later failure can name its cause.
 */
async function bluetoothReady(maxMs: number, callMs: number): Promise<BluetoothReadiness> {
  const bt = navigator.bluetooth;
  if (typeof bt?.getAvailability !== 'function') return 'unknown';
  const deadline = Date.now() + maxMs;
  let answered = false;
  for (;;) {
    const v = await withTimeout(bt.getAvailability(), callMs);
    if (v === true) return 'ready';
    if (v === false) answered = true;
    if (Date.now() >= deadline) return answered ? 'unavailable' : 'unknown';
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** Every number involved in waiting for the adapter, in one place. */
const WAKE = {
  /** Bluefy: the stack really is asleep and really does wake up, so wait. */
  bluefy: { maxMs: 3000, callMs: 800 },
  /** Everywhere else: one short reading, then get on with the tap. */
  other: { maxMs: 0, callMs: 400 },
  /** Between the refused call and the single retry. */
  retryDelayMs: 1200,
} as const;

/** How long we'll wait for the adapter, by browser. See {@link bluetoothReady}. */
export function readyBudget(inBluefy: boolean): { maxMs: number; callMs: number } {
  return inBluefy ? WAKE.bluefy : WAKE.other;
}

/**
 * `requestDevice`, with one retry when the adapter was asleep.
 *
 * On Bluefy the first call against a sleeping stack is refused outright, and
 * that call appears to be what wakes it — a second attempt a moment later gets
 * a chooser. Retrying costs a second and turns the reported failure into a
 * connection.
 *
 * Deliberately Bluefy-only, and deliberately not on a `ready` adapter. Web
 * Bluetooth normally spends the user activation on the first call, so a blind
 * retry elsewhere would come back as NotAllowedError — which this module reads
 * as "the user dismissed the chooser" and swallows in silence, converting a
 * real error into nothing at all. Bluefy is known not to enforce activation:
 * cstimer calls requestDevice from inside a `.then()` and works there.
 */
async function requestDeviceWaking(
  bt: Bluetooth,
  opts: RequestDeviceOptions,
  readiness: BluetoothReadiness,
  inBluefy: boolean,
): Promise<BluetoothDevice> {
  try {
    return await bt.requestDevice(opts);
  } catch (err) {
    if (readiness === 'ready' || !inBluefy || isNoDeviceSelected(err)) throw err;
    await new Promise((r) => setTimeout(r, WAKE.retryDelayMs));
    await bluetoothReady(WAKE.bluefy.maxMs, WAKE.bluefy.callMs);
    return bt.requestDevice(opts);
  }
}

/**
 * Every name prefix any driver answers to, in registry order, deduplicated.
 *
 * This is the whole of the chooser's guest list. It has to stay in step with
 * the drivers or a brand we ship support for simply never appears — which is
 * exactly what happened to GoCube, Rubik's Connected, QiYi, MoYu and Giiker
 * while this list was five hand-written entries (2026-08-01): the UI advertised
 * them, `matches()` knew them, and the picker had never heard of them.
 */
const ALL_NAME_PREFIXES: string[] = Array.from(
  new Set(DRIVERS.flatMap((d) => [...d.namePrefixes])),
);

/**
 * @param nameOnly Leave out the service-UUID filters, so the chooser is
 *   populated by name prefix alone.
 *
 *   For iOS Bluefy, where a `{ services: [...] }` filter empties the chooser
 *   outright: the picker opens, scans, and lists nothing — not the GAN cube two
 *   inches away that `{ namePrefix: 'GAN' }` in the same array matches by name.
 *   Drop to `acceptAllDevices` on the same phone and that cube is right there in
 *   the list, so it is being advertised and Bluefy can see it.
 *
 *   cstimer works on that phone, and its cube picker passes name prefixes and
 *   nothing else — `servFilters` is declared by exactly one model, the GAN
 *   *timer*, which lives in a separate picker (`src/js/hardware/bluetooth.js:79`
 *   builds the filters; only `gantimer.js:119` sets `servFilters`). So the one
 *   structural difference between the call that works there and the call that
 *   doesn't is the presence of service filters, and this is us not sending them.
 *
 *   Bluefy is closed-source and we can't see what it does with them — but we
 *   don't need to: matching the known-good call is the fix. Everywhere else the
 *   service filters cost nothing and stay, as a net for a cube whose name we
 *   don't recognise but whose service we do.
 */
export function pickerOptions(acceptAllDevices: boolean, nameOnly = false): RequestDeviceOptions {
  const optional = new Set<string>();
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
      // Names first. A browser that honours only some of the filters it is
      // handed should be left holding the half that identifies actual cubes.
      ...ALL_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
      ...(nameOnly ? [] : Array.from(new Set(DRIVERS.map((d) => d.service)))
        .map((service) => ({ services: [service] }))),
    ],
  };
}

/**
 * Open one Web Bluetooth chooser while preserving the adapter-wake and Bluefy
 * compatibility path used by smart cubes. `optionsForEnvironment` lets a
 * shared caller add other supported BLE devices without reimplementing the
 * browser-specific picker safeguards in a page component.
 */
export async function requestBluetoothDevice(
  optionsForEnvironment: (nameOnly: boolean) => RequestDeviceOptions,
): Promise<BluetoothDevice | null> {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    const err = new Error('NO_WEB_BLUETOOTH') as Error & { kind?: string };
    err.kind = 'no-web-bluetooth';
    throw err;
  }

  const inBluefy = isBluefy();
  const budget = readyBudget(inBluefy);
  const readiness = await bluetoothReady(budget.maxMs, budget.callMs);

  try {
    return await requestDeviceWaking(
      navigator.bluetooth,
      optionsForEnvironment(inBluefy),
      readiness,
      inBluefy,
    );
  } catch (err) {
    if (isNoDeviceSelected(err)) return null;
    if (readiness !== 'ready') throw new BluetoothConnectError('adapter-asleep', err);
    throw atStage('picker', err);
  }
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
  /** Connect a device already returned by a shared Web Bluetooth chooser. */
  connectDevice(device: BluetoothDevice): Promise<void>;
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
  /** Called for each move. `timestamp` is a calibrated `performance.now()`-domain
   * estimate of when the cube made the move. The caller is responsible for
   * re-basing it against any "solve start" reference. */
  onMove?: (move: string, timestamp: number) => void;
  /** Called when state transitions from unsolved → solved. Move-triggered
   * transitions carry that move's calibrated timestamp; state-only reports do not. */
  onSolved?: (timestamp?: number) => void;
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
  // Monotonically identifies the currently-owned connection session. Async
  // reconnect work captures this value and must discard its result if a
  // manual disconnect, a new device selection, or unmount has moved on.
  const connectionGenerationRef = useRef<number>(0);
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
  const publishSolved = useCallback((isSolved: boolean, timestamp?: number) => {
    if (isSolved && !wasSolvedRef.current) {
      wasSolvedRef.current = true;
      setSolved(true);
      onSolvedRef.current?.(timestamp);
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
  const publishState = useCallback((rawFacelets: string, timestamp?: number) => {
    const view = applyHijack(hijackRef.current, rawFacelets);
    setFacelets(view);
    publishSolved(stepSolved(activeStep(), view), timestamp);
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
    publishState(toFaceletString(trackerRef.current.getFaces()), ts);
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
    const generation = connectionGenerationRef.current;
    const device = deviceRef.current;
    const driver = driverRef.current;
    const isCurrentSession = (): boolean => connectionGenerationRef.current === generation;

    // Guard: device or driver got nulled out (manual disconnect / unmount
    // beat the timer). Bail.
    if (!device || !driver) {
      if (isCurrentSession()) reconnectInFlightRef.current = false;
      return;
    }
    if (intentionalDisconnectRef.current) {
      if (isCurrentSession()) reconnectInFlightRef.current = false;
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

    let server: BluetoothRemoteGATTServer | null = null;
    let onDisc: (() => void) | null = null;
    let started: Awaited<ReturnType<CubeDriver['start']>> | null = null;
    const discardAttempt = (): void => {
      try { started?.cleanup(); } catch { /* ignore */ }
      if (onDisc) {
        try { device.removeEventListener('gattserverdisconnected', onDisc); } catch { /* ignore */ }
        if (disconnectListenerRef.current === onDisc) disconnectListenerRef.current = null;
      }
      if (server?.connected) {
        try { server.disconnect(); } catch { /* ignore */ }
      }
    };

    try {
      server = await device.gatt.connect();
      if (!isCurrentSession() || intentionalDisconnectRef.current) {
        discardAttempt();
        return;
      }
      // Re-attach the disconnect listener (the device may keep the old one,
      // but to be safe we strip + re-add a fresh closure).
      if (disconnectListenerRef.current) {
        device.removeEventListener('gattserverdisconnected', disconnectListenerRef.current);
      }
      onDisc = (): void => {
        if (!isCurrentSession()) return;
        if (intentionalDisconnectRef.current) return;
        if (reconnectInFlightRef.current) return;
        onConnectionEventRef.current?.({ kind: 'disconnected', reason: 'gatt-lost' });
        scheduleReconnectRef.current?.(0);
      };
      device.addEventListener('gattserverdisconnected', onDisc);
      disconnectListenerRef.current = onDisc;

      // Establish the provisional solved baseline before the driver starts.
      // Some drivers publish their authoritative state during start(); doing
      // this afterwards would overwrite a real scrambled reconnect state.
      trackerRef.current.reset();
      moveClockRef.current.reset();
      hijackRef.current = null;
      hijackStepRef.current = null;
      setHijacked(false);
      wasSolvedRef.current = true;
      setSolved(true);
      publishState(toFaceletString(trackerRef.current.getFaces()));
      setLastMove(null);

      // Re-run the driver handshake to resume the move stream. Re-arm the
      // gyro sink too, or orientation would silently die after any drop.
      started = await driver.start(server, (move, deviceTs) => {
        if (isCurrentSession()) handleMove(move, deviceTs);
      }, {
        mac: macRef.current,
        onState: (nextFacelets) => {
          if (isCurrentSession()) handleCubeState(nextFacelets);
        },
        onGyro: onGyroRef.current
          ? ((q, v) => { if (isCurrentSession()) gyroSink(q, v); })
          : undefined,
      });
      if (!isCurrentSession() || intentionalDisconnectRef.current) {
        discardAttempt();
        return;
      }
      cleanupRef.current = started.cleanup;
      setGyroRef.current = started.setGyro ?? null;

      setStatus({
        connected: true,
        brand: driver.brand,
        battery: null,
        deviceName: prettyDeviceName(device),
        deviceId: device.id,
        hasGyro: driver.hasGyro === true,
      });

      void started.battery().then(b => {
        if (isCurrentSession() && deviceRef.current === device) {
          setStatus(s => ({ ...s, battery: b }));
        }
      }).catch(() => {});

      reconnectInFlightRef.current = false;
      onConnectionEventRef.current?.({ kind: 'reconnected' });
    } catch {
      discardAttempt();
      if (!isCurrentSession()) return;
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
    connectionGenerationRef.current += 1;
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
    generation: number,
  ): Promise<void> => {
    const isCurrentSession = (): boolean => connectionGenerationRef.current === generation;
    if (!device.gatt) {
      throw new BluetoothConnectError('gatt', 'Selected device does not expose a GATT server.');
    }
    let server: BluetoothRemoteGATTServer;
    try {
      server = await device.gatt.connect();
    } catch (err) {
      throw atStage('gatt', err);
    }
    if (!isCurrentSession()) {
      try { server.disconnect(); } catch { /* ignore */ }
      return;
    }

    // Pick the driver by which GATT service the cube actually exposes (GAN
    // v2/v3/v4 share no service, so this is unambiguous); fall back to name.
    let driver: CubeDriver | null = null;
    let uuids: Set<string> | null = null;
    try {
      const services = await server.getPrimaryServices();
      const discoveredUuids = new Set(services.map(s => s.uuid.toLowerCase()));
      uuids = discoveredUuids;
      driver = DRIVERS.find(d => discoveredUuids.has(d.service.toLowerCase())) ?? null;
    } catch {
      // getPrimaryServices unsupported / failed — fall through to name match.
    }
    if (!isCurrentSession()) {
      try { server.disconnect(); } catch { /* ignore */ }
      return;
    }
    if (uuids?.has(GAN_V1_SHARED_SERVICE)
      && uuids.has(GAN_V1_DEVICE_INFORMATION_SERVICE)) {
      try { server.disconnect(); } catch { /* ignore */ }
      throw new BluetoothConnectError(
        'discover',
        'GAN v1 smart cubes use a legacy protocol that is not supported.',
      );
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
    if (!isCurrentSession()) {
      try { server.disconnect(); } catch { /* ignore */ }
      return;
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
      if (!isCurrentSession()) return;
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
    const discardAttachedAttempt = (started?: Awaited<ReturnType<CubeDriver['start']>>): void => {
      try { started?.cleanup(); } catch { /* ignore */ }
      try { device.removeEventListener('gattserverdisconnected', onDisc); } catch { /* ignore */ }
      if (disconnectListenerRef.current === onDisc) disconnectListenerRef.current = null;
      if (server.connected) {
        try { server.disconnect(); } catch { /* ignore */ }
      }
    };

    const activate = async (macToUse: string | null): Promise<void> => {
      if (!isCurrentSession()) {
        discardAttachedAttempt();
        return;
      }
      macRef.current = macToUse;
      pendingSaveMacRef.current = macToUse ? { name: device.name ?? null, mac: macToUse } : null;

      // Establish the fallback baseline before start(). Drivers are allowed to
      // synchronously publish their authoritative state during the handshake;
      // resetting afterwards would incorrectly replace it with solved.
      trackerRef.current.reset();
      moveClockRef.current.reset();
      hijackRef.current = null;
      hijackStepRef.current = null;
      setHijacked(false);
      wasSolvedRef.current = true;
      setSolved(true);
      publishState(toFaceletString(trackerRef.current.getFaces()));
      setLastMove(null);

      const started = await driver!.start(server, (move, deviceTs) => {
        if (isCurrentSession()) handleMove(move, deviceTs);
      }, {
        mac: macToUse,
        onKeyError: () => { if (isCurrentSession()) handleKeyError(); },
        onState: (nextFacelets) => {
          if (isCurrentSession()) handleCubeState(nextFacelets);
        },
        // Only hand the sink over when a consumer asked for orientation —
        // that's the signal MoYu32 uses to turn its 0xAB stream on.
        onGyro: onGyroRef.current
          ? ((q, v) => { if (isCurrentSession()) gyroSink(q, v); })
          : undefined,
      });
      if (!isCurrentSession()) {
        discardAttachedAttempt(started);
        return;
      }
      cleanupRef.current = started.cleanup;
      setGyroRef.current = started.setGyro ?? null;
      setStatus({
        connected: true,
        brand: driver!.brand,
        battery: null,
        deviceName: prettyDeviceName(device),
        deviceId: device.id,
        hasGyro: driver!.hasGyro === true,
      });
      // Read battery in the background; failures fall back to null silently.
      void started.battery().then(b => {
        if (isCurrentSession() && deviceRef.current === device) {
          setStatus(s => ({ ...s, battery: b }));
        }
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
        if (!isCurrentSession()) return;
        cleanupRef.current?.();
        cleanupRef.current = null;
        clearMac(device.name);
        pendingSaveMacRef.current = null;
        let newMac: string | null = null;
        if (onNeedMacRef.current) {
          try { newMac = normalizeMac(await onNeedMacRef.current(device.name ?? '', true)); }
          catch { newMac = null; }
        }
        if (!isCurrentSession()) return;
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
      discardAttachedAttempt();
      if (!isCurrentSession()) return;
      throw atStage('handshake', err);
    }
  }, [handleMove, handleCubeState, cancelPendingReconnect, internalDisconnect]);

  const connectDevice = useCallback(async (device: BluetoothDevice): Promise<void> => {
    const generation = connectionGenerationRef.current + 1;
    connectionGenerationRef.current = generation;
    intentionalDisconnectRef.current = false;
    cancelPendingReconnect();

    // Recover the MAC from BLE advertisements BEFORE connecting, but only
    // when no reusable value is already available. A MAC is persisted after
    // the first decoded move, so returning cubes can skip the advertisement
    // wait. The handshake's key-error path clears a stale value and asks the
    // user again if the cube identity or key ever changes.
    const nameDriver = pickDriver(device);
    const reusableMac = nameDriver?.needsMac
      ? savedMac(device.name)
        ?? parseMacFromName(device.name)
        ?? nameDriver.defaultMac?.(device)
        ?? null
      : null;
    const shouldWatchMac = nameDriver === null
      || (nameDriver.needsMac === true && reusableMac === null);
    const advMac = shouldWatchMac
      ? await watchAdvertisementsMac(device)
        .catch((err: unknown) => { throw atStage('advertisement', err); })
      : null;
    if (connectionGenerationRef.current !== generation) return;
    await attachToDevice(device, advMac, generation);
  }, [attachToDevice, cancelPendingReconnect]);

  const connect = useCallback(async (pick?: ConnectPickOptions): Promise<void> => {
    // Dev escape hatch: `__cuberootFakeCube.arm()` in the console stands up a
    // fake GAN v4 peripheral so the whole smart-cube experience can be driven
    // without hardware. It joins the normal path below at the same point a real
    // device does — driver selection, MAC handling and the handshake all run
    // for real. Compiled out of production; see ./fake_cube.ts.
    const fake = armedFakeCube();
    if (fake) {
      const generation = connectionGenerationRef.current + 1;
      connectionGenerationRef.current = generation;
      intentionalDisconnectRef.current = false;
      cancelPendingReconnect();
      await attachToDevice(fake.device, fake.mac, generation);
      return;
    }

    if (mayUseMiniProgramBridge()) {
      const generation = connectionGenerationRef.current + 1;
      connectionGenerationRef.current = generation;
      const isCurrentSession = (): boolean => connectionGenerationRef.current === generation;
      intentionalDisconnectRef.current = false;
      cancelPendingReconnect();
      cleanupRef.current?.();
      cleanupRef.current = null;

      const bridge = await connectMiniProgramCubeBridge({
        onMove: (move, deviceTs) => {
          if (isCurrentSession()) handleMove(move, deviceTs);
        },
        onState: (facelets) => {
          if (isCurrentSession()) handleCubeState(facelets);
        },
        onBattery: (level) => {
          if (isCurrentSession()) {
            setStatus((current) => ({ ...current, battery: level }));
          }
        },
        onGyro: (quaternion, velocity) => {
          if (isCurrentSession()) gyroSink(quaternion, velocity);
        },
        onStatus: (next) => {
          if (!isCurrentSession()) return;
          if ((next.phase === 'disconnected' || next.phase === 'error')
            && cleanupRef.current) {
            connectionGenerationRef.current += 1;
            internalDisconnect('gatt-lost');
          }
        },
      });
      if (!isCurrentSession()) {
        bridge.disconnect();
        return;
      }

      trackerRef.current.reset();
      hijackRef.current = null;
      hijackStepRef.current = null;
      setHijacked(false);
      wasSolvedRef.current = true;
      setSolved(true);
      publishState(toFaceletString(trackerRef.current.getFaces()));
      setLastMove(null);
      moveClockRef.current.reset();
      cleanupRef.current = bridge.disconnect;
      setStatus({
        connected: true,
        brand: bridge.brand === 'gan-v4' || bridge.brand === 'gocube'
          ? bridge.brand
          : 'unknown',
        battery: null,
        deviceName: bridge.deviceName,
        deviceId: `miniprogram:${bridge.brand}`,
        hasGyro: bridge.hasGyro,
      });
      // Initial state can arrive while the native page is still connecting.
      // Replay it only after this tracker reset, otherwise a real scrambled
      // cube is overwritten by the temporary solved state above.
      bridge.activate();
      return;
    }

    const pickerGeneration = connectionGenerationRef.current + 1;
    connectionGenerationRef.current = pickerGeneration;
    intentionalDisconnectRef.current = false;
    cancelPendingReconnect();
    const device = await requestBluetoothDevice((nameOnly) =>
      pickerOptions(pick?.acceptAllDevices === true, nameOnly));
    if (connectionGenerationRef.current !== pickerGeneration) return;
    if (!device) return;
    await connectDevice(device);
  }, [
    attachToDevice,
    cancelPendingReconnect,
    connectDevice,
    gyroSink,
    handleCubeState,
    handleMove,
    internalDisconnect,
    publishState,
  ]);

  // Tear down on unmount so we don't leak GATT subscriptions.
  useEffect(() => {
    return () => {
      connectionGenerationRef.current += 1;
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
    connectDevice,
    disconnect,
    resetState,
    getFaces,
    setGyro,
    hijackTo,
    clearHijack,
    hijacked,
  };
}
