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
 * With `shareConnection`, the primary connection lives for the browser tab.
 * Page callbacks are registered only while their consumer is mounted.
 * On non-Web-Bluetooth
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
 *   MoYu32; QiYi capability is detected when a valid CC 10 sample arrives.
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

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CubeDriver, CubeMoveMetadata, GyroSink } from './driver';
import type { MoveClockSample } from '@cuberoot/shared/smart-cube/move-clock';
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
import {
  SmartCubeSessionController,
  SMART_CUBE_RECONNECT_DELAYS,
  type SmartCubeSessionLease,
} from '@cuberoot/shared/smart-cube/session';
import type { TimerDeviceConnectionEvent } from '@cuberoot/shared/timer/device-contract';
import { armedFakeCube } from './fake_cube';
import { applyHijack, makeHijack, type StateHijack } from './state_hijack';
import { toFaceletString, fromFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { stepSolved, type CubeStep } from '@cuberoot/shared/timer/reconstruct/steps';
import { syncAccountMacs } from './mac-account';
import { watchAdvertisementsMac, savedMac, saveMac, clearMac, parseMacFromName, normalizeMac } from './mac';
import { installedBleAvailable, installedBleDeviceMac, requestInstalledBleDevice } from '@/lib/installed-ble-bridge';
import { BluetoothConnectError, atStage, describeError, isNoDeviceSelected } from './connect_error';
import type { BluetoothCubeStatus, CubeBrand } from './types';
import {
  connectMiniProgramCubeBridge,
  mayUseMiniProgramBridge,
} from './miniprogram_bridge';

export type { BluetoothCubeStatus, CubeBrand } from './types';
export type { CubeDriver, CubeMoveMetadata, CubeDriverStartResult, GyroSink, GyroQuaternion, GyroVelocity } from './driver';
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

const MINI_PROGRAM_CUBE_BRANDS: readonly CubeBrand[] = [
  'gan-v2', 'gan-v3', 'gan-v4', 'gocube', 'qiyi', 'giiker', 'moyu', 'moyu32',
];

/** Keep protocol identities reported by the native mini-program bridge. */
export function normalizeMiniProgramCubeBrand(brand: string | undefined): CubeBrand {
  return MINI_PROGRAM_CUBE_BRANDS.includes(brand as CubeBrand)
    ? brand as CubeBrand
    : 'unknown';
}

/* ------------------------------------------------------------------ */
/*  Connection-state event surface                                    */
/* ------------------------------------------------------------------ */

export type BluetoothConnectionEvent = TimerDeviceConnectionEvent;

const RECONNECT_BACKOFF_MS = SMART_CUBE_RECONNECT_DELAYS;
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

function isTransientGattDisconnect(error: unknown): boolean {
  const raw = error instanceof BluetoothConnectError ? error.raw : error;
  return /GATT Server is disconnected|\bcode 19\b/i.test(describeError(raw));
}

/**
 * Pick a single previously-authorised cube that can reconnect without any
 * chooser or MAC prompt. Ambiguity deliberately falls back to the normal
 * user-driven picker instead of guessing which physical cube to claim.
 */
export function grantedCubeForPreconnect(
  devices: readonly BluetoothDevice[],
): BluetoothDevice | null {
  const candidates = devices.filter((device) => {
    const driver = pickDriver(device);
    if (!driver) return false;
    if (!driver.needsMac) return true;
    return Boolean(
      savedMac(device.name)
      ?? parseMacFromName(device.name)
      ?? driver.defaultMac?.(device),
    );
  });
  return candidates.length === 1 ? candidates[0] : null;
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
  onDeviceConnected?: (id: string) => void;
}

let lastBrowserCube: BluetoothDevice | undefined;

export function canReconnectRememberedCube(deviceId: string): boolean {
  return typeof navigator !== 'undefined' && !mayUseMiniProgramBridge() && !installedBleAvailable()
    && (typeof navigator.bluetooth?.getDevices === 'function' || lastBrowserCube?.id === deviceId);
}

async function getGrantedDevices(rememberedId?: string): Promise<BluetoothDevice[]> {
  const bluetooth = typeof navigator === 'undefined' ? undefined : navigator.bluetooth;
  try {
    if (bluetooth?.getDevices) return await bluetooth.getDevices();
    return lastBrowserCube && lastBrowserCube.id === rememberedId ? [lastBrowserCube] : [];
  } catch {
    return [];
  }
}

export async function listOtherGrantedSmartCubes(rememberedId: string): Promise<BluetoothDevice[]> {
  return (await getGrantedDevices()).filter(device => device.id !== rememberedId && pickDriver(device));
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
  if (installedBleAvailable()) return requestInstalledBleDevice(optionsForEnvironment(false));
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
  /** Advertisement count/timing from the current connection's MAC scan. */
  advertisementDiagnostic: BluetoothAdvertisementDiagnostic | null;
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
  connectDevice(device: BluetoothDevice, onDeviceConnected?: (id: string) => void): Promise<void>;
  /** Reconnect an exact remembered device, or an unambiguous granted cube. */
  preconnectGrantedDevice(deviceId?: string): Promise<boolean>;
  /** Disconnect + cleanup. */
  disconnect(): void;
  /** Reset internal cube state to "solved" (after the user resets the cube physically). */
  resetState(): void;
  resetDeviceState?: () => Promise<void>;
  lastMoveMetadata?: CubeMoveMetadata;
  /**
   * Snapshot of the live cube state, for CFOP stage detection or any other
   * read-only inspection. Returns null when no cube is connected.
   */
  getFaces(): import('@cuberoot/shared/timer/reconstruct/state').CubeFaces | null;
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
   * window in which the old step judges the new case.
   * Omit it to keep judging by `solvedStep`.
   */
  hijackTo(target: import('@cuberoot/shared/timer/reconstruct/state').CubeFaces | string, step?: CubeStep): boolean;
  /** Drop the hijack: go back to reporting the physical cube. */
  clearHijack(): void;
  /** True while a hijack is in effect. */
  hijacked: boolean;
}

export interface BluetoothAdvertisementDiagnostic {
  /** The connection step currently responsible for the wait. */
  phase: 'advertisement' | 'gatt' | 'discovery' | 'handshake' | 'connected';
  /** 1-based received event number; 0 while waiting for the first event. */
  eventNumber: number;
  /** Milliseconds from starting the listener to the most recent event. */
  elapsedMs: number;
  /** Whether that event supplied the complete manufacturer data needed for MAC recovery. */
  complete: boolean;
  /** Total time since `connectDevice` began, updated at each phase boundary. */
  totalElapsedMs: number;
  advertisementMs: number | null;
  gattMs: number | null;
  discoveryMs: number | null;
  handshakeMs: number | null;
}

interface UseBluetoothCubeOpts {
  /** Use the tab's primary cube instead of a dedicated connection. */
  shareConnection?: boolean;
  /** Reject a device owned by another local player before touching its GATT session. */
  validateDevice?: (device: BluetoothDevice) => void;
  /** Official competition sessions only accept physical peripherals. */
  allowSimulated?: boolean;
  /** Called for each move. `timestamp` is a calibrated `performance.now()`-domain
   * estimate of when the cube made the move. The caller is responsible for
   * re-basing it against any "solve start" reference. */
  onMove?: (
    move: string,
    timestamp: number,
    facelets: string,
    metadata?: CubeMoveMetadata,
    clock?: MoveClockSample,
  ) => void;
  /** Called when state transitions from unsolved → solved. Move-triggered
   * transitions carry that move's calibrated timestamp; state-only reports do not. */
  onSolved?: (timestamp?: number, clock?: MoveClockSample) => void;
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

type BluetoothCubeSnapshot = Pick<BluetoothCubeHandle,
  'status' | 'advertisementDiagnostic' | 'lastMoveMetadata' | 'lastMove' | 'solved' |
  'facelets' | 'hijacked' | 'resetDeviceState'>;

const INITIAL_SNAPSHOT: BluetoothCubeSnapshot = {
  status: INITIAL_STATUS,
  advertisementDiagnostic: null,
  lastMove: null,
  solved: true,
  facelets: null,
  hijacked: false,
};

function createBluetoothCubeConnection(shared: boolean) {
  let snapshot = INITIAL_SNAPSHOT;
  const listeners = new Set<() => void>();
  const consumers = new Map<symbol, () => UseBluetoothCubeOpts>();
  let activeConsumer: symbol | undefined;
  let changingConsumer = false;
  let simulated = false;
  let established = false;
  let pendingConnection: { owner: symbol } | undefined;
  let cancelMacPrompt: (() => void) | undefined;
  let cancelRememberedReconnect: (() => void) | undefined;
  const options = () => (activeConsumer && consumers.get(activeConsumer)?.()) || {};

  async function requestMac(name: string, wrongKey?: boolean): Promise<string | null> {
    if (cancelRememberedReconnect && !snapshot.status.connected) return null;
    const prompt = options().onNeedMac;
    if (!prompt) return null;
    cancelMacPrompt?.();
    let cancel: () => void = () => {};
    const cancelled = new Promise<null>(resolve => { cancel = () => resolve(null); });
    cancelMacPrompt = cancel;
    try {
      const answer = wrongKey === undefined ? prompt(name) : prompt(name, wrongKey);
      return await Promise.race([answer, cancelled]);
    }
    finally { if (cancelMacPrompt === cancel) cancelMacPrompt = undefined; }
  }

  function publish(patch: Partial<BluetoothCubeSnapshot>) {
    if (!Object.entries(patch).some(([key, value]) => snapshot[key as keyof BluetoothCubeSnapshot] !== value)) return;
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  const setStatus = (value: BluetoothCubeStatus | ((current: BluetoothCubeStatus) => BluetoothCubeStatus)) => {
    const status = typeof value === 'function' ? value(snapshot.status) : value;
    publish({ status, resetDeviceState: status.connected && resetDevice ? resetDeviceState : undefined });
  };
  const setAdvertisementDiagnostic = (value: BluetoothAdvertisementDiagnostic | null |
    ((current: BluetoothAdvertisementDiagnostic | null) => BluetoothAdvertisementDiagnostic | null)) => {
    publish({ advertisementDiagnostic: typeof value === 'function' ? value(snapshot.advertisementDiagnostic) : value });
  };
  const setHijacked = (hijacked: boolean) => publish({ hijacked });

  const gyroSink: GyroSink = (q, v) => {
    gyroSeen = true;
    const { status } = snapshot;
    if (status.connected && !status.hasGyro) setStatus({ ...status, hasGyro: true });
    options().onGyro?.(q, v);
  };
  let gyroSeen = false;
  let activeDevice: BluetoothDevice | null = null;
  let activeMac: string | null = null;
  // MAC pending persistence — only written once a real move or a validated
  // state decodes, so a wrong MAC the user typed never poisons storage.
  let pendingSaveMac: { name: string | null; mac: string } | null = null;
  let activeDriver: CubeDriver | null = null;
  let cleanup: (() => void) | null = null;
  let resetDevice: (() => Promise<void>) | null = null;
  let calibrating = false;
  let relayCalibrating = false;
  let updateDeviceGyro: ((enabled: boolean) => Promise<void>) | null = null;
  let requestedGyro: boolean | undefined;
  let disconnectListener: ((ev: Event) => void) | null = null;
  /**
   * Training-mode offset: non-null means what we publish is a relabelling of
   * the physical cube, not the cube itself. See `./state_hijack.ts`.
   */
  let hijack: StateHijack | null = null;
  // A training case can override the page's default solve criterion.
  let hijackStep: CubeStep | null = null;
  // True only when the user (or unmount) explicitly tore the connection
  // down. The gattserverdisconnected handler reads this to decide whether
  // to attempt auto-reconnect.
  let intentionalDisconnect: boolean = false;
  // Monotonically identifies the currently-owned connection session. Async
  // reconnect work captures this value and must discard its result if a
  // manual disconnect, a new device selection, or unmount has moved on.
  let connectionGeneration: number = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Set while a reconnect attempt is in flight, so we don't double-fire from
  // overlapping disconnect events.
  let reconnectInFlight: boolean = false;
  const sessionController = new SmartCubeSessionController<CubeMoveMetadata>({
    now: () => performance.now(),
    projectFacelets: (rawFacelets) => applyHijack(hijack, rawFacelets),
    isSolved: (nextFacelets) => stepSolved(hijackStep ?? options().solvedStep ?? 'solved', nextFacelets),
    onChange: ({ lastMoveMetadata, lastMove, facelets, solved }) => {
      publish({ lastMoveMetadata, lastMove, facelets, solved });
    },
    onMove: ({ facelets, metadata, move, timestamp, clock }) => {
      // Persist a MAC only after a real frame decodes successfully.
      const pendingMac = pendingSaveMac;
      if (pendingMac) {
        saveMac(pendingMac.name, pendingMac.mac);
        pendingSaveMac = null;
      }
      if (calibrating || relayCalibrating) return;
      options().onMove?.(move, timestamp, facelets, metadata, clock);
    },
    onSolved: (timestamp, clock) => {
      if (!changingConsumer && !calibrating && !relayCalibrating) options().onSolved?.(timestamp, clock);
    },
  });

  const adoptCubeState = (
    session: SmartCubeSessionLease<CubeMoveMetadata>,
    nextFacelets: string,
  ): void => {
    if (!session.adoptFacelets(nextFacelets)) return;
    // A validated encrypted state proves the MAC even before the first move.
    const pendingMac = pendingSaveMac;
    if (pendingMac) {
      saveMac(pendingMac.name, pendingMac.mac);
      pendingSaveMac = null;
    }
  };

  const cancelPendingReconnect = () => {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectInFlight = false;
  };

  const attemptReconnect = async (attempt: number): Promise<void> => {
    reconnectInFlight = true;
    const generation = connectionGeneration;
    const device = activeDevice;
    const driver = activeDriver;
    const isCurrentSession = (): boolean => connectionGeneration === generation;

    // Guard: device or driver got nulled out (manual disconnect / unmount
    // beat the timer). Bail.
    if (!device || !driver) {
      if (isCurrentSession()) reconnectInFlight = false;
      return;
    }
    if (intentionalDisconnect) {
      if (isCurrentSession()) reconnectInFlight = false;
      return;
    }
    if (!device.gatt) {
      // Browser revoked GATT access entirely; we can't recover.
      options().onConnectionEvent?.({ kind: 'reconnect-failed', attempts: attempt });
      reconnectInFlight = false;
      // Fall through to a hard reset so the user can re-pair.
      activeDevice = null;
      activeDriver = null;
      established = false;
      cleanup = null;
      disconnectListener = null;
      sessionController.close();
      setStatus(INITIAL_STATUS);
      return;
    }

    let server: BluetoothRemoteGATTServer | null = null;
    let onDisc: (() => void) | null = null;
    let started: Awaited<ReturnType<CubeDriver['start']>> | null = null;
    let reconnectSession: SmartCubeSessionLease<CubeMoveMetadata> | null = null;
    const discardAttempt = (): void => {
      try { started?.cleanup(); } catch { /* ignore */ }
      if (onDisc) {
        try { device.removeEventListener('gattserverdisconnected', onDisc); } catch { /* ignore */ }
        if (disconnectListener === onDisc) disconnectListener = null;
      }
      if (server?.connected) {
        try { server.disconnect(); } catch { /* ignore */ }
      }
    };

    try {
      server = await device.gatt.connect();
      if (!isCurrentSession() || intentionalDisconnect) {
        discardAttempt();
        return;
      }
      // Establish the provisional solved baseline before the driver starts.
      // Some drivers publish their authoritative state during start(); doing
      // this afterwards would overwrite a real scrambled reconnect state.
      gyroSeen = false;
      hijack = null;
      hijackStep = null;
      setHijacked(false);
      reconnectSession = sessionController.open();
      const session = reconnectSession;

      // Re-attach the disconnect listener (the device may keep the old one,
      // but to be safe we strip + re-add a fresh closure).
      if (disconnectListener) {
        device.removeEventListener('gattserverdisconnected', disconnectListener);
      }
      onDisc = (): void => {
        if (!isCurrentSession()) return;
        if (intentionalDisconnect) return;
        if (!session.isCurrent()) return;
        sessionController.close();
        if (reconnectInFlight) return;
        cleanup?.();
        cleanup = null;
        options().onConnectionEvent?.({ kind: 'disconnected', reason: 'gatt-lost' });
        scheduleReconnect(0);
      };
      device.addEventListener('gattserverdisconnected', onDisc);
      disconnectListener = onDisc;

      // Re-run the driver handshake to resume the move stream. Re-arm the
      // gyro sink too, or orientation would silently die after any drop.
      let notifiedBattery: number | null = null;
      started = await driver.start(server, (move, deviceTs, metadata) => {
        if (isCurrentSession()) session.move(move, deviceTs, metadata);
      }, {
        mac: activeMac,
        onBattery: (level) => {
          if (!isCurrentSession() || !session.isCurrent()) return;
          notifiedBattery = level;
          setStatus(s => ({ ...s, battery: level }));
        },
        onState: (nextFacelets) => {
          if (isCurrentSession()) adoptCubeState(session, nextFacelets);
        },
        enableGyroOnStart: shared ? false : undefined,
        onGyro: (shared || options().onGyro || driver.brand === 'qiyi')
          ? ((q, v) => {
              if (isCurrentSession() && session.isCurrent()) gyroSink(q, v);
            })
          : undefined,
      });
      if (!isCurrentSession() || intentionalDisconnect || !session.isCurrent()) {
        discardAttempt();
        return;
      }
      cleanup = started.cleanup;
      updateDeviceGyro = started.setGyro ?? null;
      requestedGyro = shared ? false : undefined;
      resetDevice = started.resetDeviceState ?? null;

      setStatus({
        connected: true,
        brand: driver.brand,
        battery: notifiedBattery,
        deviceName: prettyDeviceName(device),
        deviceId: device.id,
        hasGyro: driver.hasGyro === true || gyroSeen,
      });
      syncGyroPreference();

      void started.battery().then(b => {
        if (isCurrentSession() && session.isCurrent() && activeDevice === device) {
          setStatus(s => ({ ...s, battery: notifiedBattery ?? b }));
        }
      }).catch(() => {});

      reconnectInFlight = false;
      options().onConnectionEvent?.({ kind: 'reconnected' });
    } catch {
      discardAttempt();
      if (!isCurrentSession()) return;
      if (reconnectSession?.isCurrent()) sessionController.close();
      // Reconnect failed (timeout, GATT error, cube off, etc.).
      reconnectInFlight = false;
      if (intentionalDisconnect) return;
      const next = attempt + 1;
      if (next >= RECONNECT_MAX_ATTEMPTS) {
        options().onConnectionEvent?.({ kind: 'reconnect-failed', attempts: next });
        // Hard reset — caller can call connect() again to re-pair.
        activeDevice = null;
        activeDriver = null;
        established = false;
        cleanup = null;
        if (disconnectListener) {
          try {
            device.removeEventListener('gattserverdisconnected', disconnectListener);
          } catch { /* ignore */ }
        }
        disconnectListener = null;
        sessionController.close();
        setStatus(INITIAL_STATUS);
        return;
      }
      scheduleReconnect(next);
    }
  };

  const scheduleReconnect = (attempt: number) => {
    if (intentionalDisconnect) return;
    if (reconnectTimer != null) return; // already armed
    const delay = RECONNECT_BACKOFF_MS[attempt] ?? RECONNECT_BACKOFF_MS[RECONNECT_BACKOFF_MS.length - 1];
    options().onConnectionEvent?.({
      kind: 'reconnecting',
      attempt: attempt + 1,
      maxAttempts: RECONNECT_MAX_ATTEMPTS,
      delayMs: delay,
    });
    // Mark disconnected in UI status while we're in retry purgatory.
    setStatus(s => (s.connected ? { ...s, connected: false } : s));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void attemptReconnect(attempt);
    }, delay);
  };

  const internalDisconnect = (reason: 'manual' | 'gatt-lost') => {
    cancelPendingReconnect();
    cleanup?.();
    cleanup = null;
    updateDeviceGyro = null;
    requestedGyro = undefined;
    resetDevice = null;
    calibrating = false;
    relayCalibrating = false;
    const dev = activeDevice;
    if (dev) {
      if (disconnectListener) {
        dev.removeEventListener('gattserverdisconnected', disconnectListener);
      }
      if (reason === 'manual' && dev.gatt?.connected) {
        try { dev.gatt.disconnect(); } catch { /* ignore */ }
      }
    }
    activeDevice = null;
    activeDriver = null;
    activeMac = null;
    pendingSaveMac = null;
    disconnectListener = null;
    simulated = false;
    established = false;
    hijack = null;
    hijackStep = null;
    setHijacked(false);
    sessionController.close();
    setStatus(INITIAL_STATUS);
    options().onConnectionEvent?.({ kind: 'disconnected', reason });
  };

  const disconnect = (cancelReconnect = true) => {
    connectionGeneration += 1;
    intentionalDisconnect = true;
    if (cancelReconnect) cancelRememberedReconnect?.();
    cancelMacPrompt?.();
    internalDisconnect('manual');
  };

  const resetState = () => {
    // "The cube in my hands is solved" is a statement about the PHYSICAL cube,
    // so any pretence about where it is has to go with it.
    hijack = null;
    hijackStep = null;
    setHijacked(false);
    sessionController.resetState();
  };

  const resetDeviceState = async () => {
    const reset = resetDevice;
    if (!reset || !cleanup) throw new Error('Device calibration unavailable');
    if (calibrating || relayCalibrating) throw new Error('Device calibration already in progress');
    const generation = connectionGeneration;
    calibrating = true;
    // Reset is one user operation: update the local model before sending the
    // solved-state command so software and hardware move together.
    resetState();
    try {
      await reset();
      if (connectionGeneration !== generation) throw new Error('Cube connection changed');
      sessionController.resetClock();
      // The driver published the confirmed snapshot and may already have
      // replayed newer turns. Clear training offsets without overwriting them.
      hijack = null;
      hijackStep = null;
      setHijacked(false);
      sessionController.republish();
    } finally {
      if (connectionGeneration === generation) calibrating = false;
    }
  };

  const hijackTo = (target: import('@cuberoot/shared/timer/reconstruct/state').CubeFaces | string, step?: CubeStep): boolean => {
    const raw = sessionController.getRawFacelets();
    if (!raw) return false;
    const wanted = typeof target === 'string' ? target : toFaceletString(target);
    const h = makeHijack(raw, target);
    // `makeHijack` returns null for two very different reasons. "The cube is
    // already there" still has to install the step and publish — otherwise a
    // case that happens to match the cube's current state would be judged by the
    // PREVIOUS case's step. "Unusable state" must change nothing at all.
    if (!h && raw !== wanted) return false;
    hijack = h;
    // Set before publishing so this case is judged against its own goal.
    hijackStep = step ?? null;
    setHijacked(h !== null);
    // Publish at once: the case has to appear without waiting for a turn.
    sessionController.republish();
    return true;
  };

  const clearHijack = () => {
    if (!hijack && hijackStep === null) return;
    hijack = null;
    hijackStep = null;
    setHijacked(false);
    sessionController.republish();
  };

  /**
   * Everything after "we have a device": open GATT, pick the driver from the
   * services it actually exposes, settle the MAC, run the handshake. Shared by
   * the picker path and the dev fake cube so neither can drift from the other.
   */
  const attachToDevice = async (
    device: BluetoothDevice,
    advMac: string | null,
    generation: number,
    onPhase?: (
      phase: 'discovery' | 'handshake' | 'connected',
      completedPhaseMs: number,
    ) => void,
  ): Promise<void> => {
    const isCurrentSession = (): boolean => connectionGeneration === generation;
    options().validateDevice?.(device);
    if (!device.gatt) {
      throw new BluetoothConnectError('gatt', 'Selected device does not expose a GATT server.');
    }
    let server: BluetoothRemoteGATTServer;
    let phaseStartedAt = performance.now();
    try {
      server = await device.gatt.connect();
    } catch (err) {
      throw atStage('gatt', err);
    }
    if (!isCurrentSession()) {
      try { server.disconnect(); } catch { /* ignore */ }
      return;
    }
    onPhase?.('discovery', Math.max(0, Math.round(performance.now() - phaseStartedAt)));

    // Pick the driver by which GATT service the cube actually exposes (GAN
    // v2/v3/v4 share no service, so this is unambiguous); fall back to name.
    let driver: CubeDriver | null = null;
    let uuids: Set<string> | null = null;
    phaseStartedAt = performance.now();
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

    // MY32 verifies finite candidates inside its normal handshake before prompting.
    let mac: string | null = null;
    if (driver.needsMac) {
      mac = installedBleDeviceMac(device) ?? (driver.brand === 'moyu32'
        ? normalizeMac(advMac) ?? savedMac(device.name ?? device.id)
        : normalizeMac(advMac)
        ?? savedMac(device.name)
        ?? parseMacFromName(device.name)
        // Brand-specific name fallback, never used for MY32.
        ?? driver.defaultMac?.(device)
        ?? null);
      if (!mac && driver.brand !== 'moyu32') {
        try { mac = normalizeMac(await requestMac(device.name ?? '')); }
        catch { mac = null; }
      }
    }
    if (!isCurrentSession()) {
      try { server.disconnect(); } catch { /* ignore */ }
      return;
    }
    activeMac = mac;

    // A MAC-keyed cube with no MAC (user dismissed the prompt, nothing auto-
    // detected) can't decode anything — abort cleanly instead of showing a
    // dead "connected" state.
    if (driver.needsMac && driver.brand !== 'moyu32' && !mac) {
      try { server.disconnect(); } catch { /* ignore */ }
      return;
    }

    // Wire up the disconnect listener BEFORE start() so we don't miss races.
    // On unexpected drop, fire the connection event then schedule the first
    // reconnect attempt with zero-index backoff (1s).
    let readyForReconnect = false;
    let activeSession: SmartCubeSessionLease<CubeMoveMetadata> | null = null;
    const onDisc = (): void => {
      if (!isCurrentSession()) return;
      if (intentionalDisconnect) return;
      if (activeSession?.isCurrent()) sessionController.close();
      // During the initial handshake, the owning connectDevice() call must
      // handle failure. Scheduling an independent reconnect here would race a
      // user retry while the modal is already reporting that handshake error.
      if (!readyForReconnect) return;
      if (reconnectInFlight) return;
      // Tear down the live subscriptions but keep the device and driver so
      // the reconnect path can reuse them.
      cleanup?.();
      cleanup = null;
      options().onConnectionEvent?.({ kind: 'disconnected', reason: 'gatt-lost' });
      scheduleReconnect(0);
    };
    device.addEventListener('gattserverdisconnected', onDisc);
    disconnectListener = onDisc;

    activeDevice = device;
    activeDriver = driver;

    // `activate` (re)subscribes the driver with a given MAC. Factored out so a
    // wrong-MAC re-prompt can re-run it on the same open GATT connection. The
    // MAC is only persisted once the shared session accepts a real move.
    const discardAttachedAttempt = (started?: Awaited<ReturnType<CubeDriver['start']>>): void => {
      try { started?.cleanup(); } catch { /* ignore */ }
      try { device.removeEventListener('gattserverdisconnected', onDisc); } catch { /* ignore */ }
      if (disconnectListener === onDisc) disconnectListener = null;
      if (server.connected) {
        try { server.disconnect(); } catch { /* ignore */ }
      }
    };

    const activate = async (macToUse: string | null): Promise<void> => {
      if (!isCurrentSession()) {
        discardAttachedAttempt();
        return;
      }
      activeMac = macToUse;
      pendingSaveMac = macToUse && driver!.brand !== 'moyu32'
        ? { name: device.name ?? device.id, mac: macToUse } : null;

      // Establish the fallback baseline before start(). Drivers are allowed to
      // synchronously publish their authoritative state during the handshake;
      // resetting afterwards would incorrectly replace it with solved.
      gyroSeen = false;
      hijack = null;
      hijackStep = null;
      setHijacked(false);
      const session = sessionController.open();
      activeSession = session;

      let started: Awaited<ReturnType<CubeDriver['start']>>;
      let notifiedBattery: number | null = null;
      try {
        started = await driver!.start(server, (move, deviceTs, metadata) => {
          if (isCurrentSession()) session.move(move, deviceTs, metadata);
        }, {
          mac: macToUse,
          macHints: [installedBleDeviceMac(device), advMac, savedMac(device.name ?? device.id)],
          isCurrent: () => isCurrentSession() && session.isCurrent(),
          requestMac: () => requestMac(device.name ?? ''),
          onRejectedMac: rejected => {
            if (savedMac(device.name ?? device.id) === rejected) clearMac(device.name ?? device.id);
          },
          onVerifiedMac: verified => {
            if (!isCurrentSession() || !session.isCurrent()) return;
            activeMac = verified;
            pendingSaveMac = null;
            saveMac(device.name ?? device.id, verified);
          },
          onBattery: (level) => {
            if (!isCurrentSession() || !session.isCurrent()) return;
            notifiedBattery = level;
            setStatus(s => ({ ...s, battery: level }));
          },
          onKeyError: () => {
            if (isCurrentSession() && session.isCurrent()) handleKeyError();
          },
          onState: (nextFacelets) => {
            if (isCurrentSession()) adoptCubeState(session, nextFacelets);
          },
          // A shared connection can gain a gyro consumer after the handshake.
          enableGyroOnStart: shared ? false : undefined,
          onGyro: (shared || options().onGyro || driver!.brand === 'qiyi')
            ? ((q, v) => {
                if (isCurrentSession() && session.isCurrent()) gyroSink(q, v);
              })
            : undefined,
        });
      } catch (error) {
        if (session.isCurrent()) sessionController.close();
        throw error;
      }
      if (!isCurrentSession() || !session.isCurrent()) {
        discardAttachedAttempt(started);
        return;
      }
      readyForReconnect = true;
      established = true;
      cleanup = started.cleanup;
      updateDeviceGyro = started.setGyro ?? null;
      requestedGyro = shared ? false : undefined;
      resetDevice = started.resetDeviceState ?? null;
      setStatus({
        connected: true,
        brand: driver!.brand,
        battery: notifiedBattery,
        deviceName: prettyDeviceName(device),
        deviceId: device.id,
        hasGyro: driver!.hasGyro === true || gyroSeen,
      });
      syncGyroPreference();
      // Read battery in the background; failures fall back to null silently.
      void started.battery().then(b => {
        if (isCurrentSession() && session.isCurrent() && activeDevice === device) {
          setStatus(s => ({ ...s, battery: notifiedBattery ?? b }));
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
        cleanup?.();
        cleanup = null;
        clearMac(device.name ?? device.id);
        pendingSaveMac = null;
        let newMac: string | null = null;
        try { newMac = normalizeMac(await requestMac(device.name ?? '', true)); }
        catch { newMac = null; }
        if (!isCurrentSession()) return;
        keyErrorBusy = false;
        if (newMac) {
          await activate(newMac).catch(() => {});
        } else {
          // User gave up — tear the connection down fully so a later GATT drop
          // doesn't auto-reconnect against the bad MAC.
          intentionalDisconnect = true;
          internalDisconnect('manual');
        }
      })();
    }

    onPhase?.('handshake', Math.max(0, Math.round(performance.now() - phaseStartedAt)));
    phaseStartedAt = performance.now();
    try {
      await activate(mac);
    } catch (err) {
      discardAttachedAttempt();
      if (!isCurrentSession()) return;
      throw atStage('handshake', err);
    }
    onPhase?.('connected', Math.max(0, Math.round(performance.now() - phaseStartedAt)));
  };

  const connectDevice = async (device: BluetoothDevice, onDeviceConnected?: (id: string) => void): Promise<void> => {
    const recordSelection = () => {
      if (!onDeviceConnected || installedBleAvailable()) return;
      lastBrowserCube = device;
      onDeviceConnected(device.id);
    };
    if (shared && snapshot.status.connected && activeDevice?.id === device.id) {
      recordSelection();
      return;
    }
    if (shared && (activeDevice || cleanup)) disconnect(false);
    if (!shared && sharedCubeConnection?.ownsDevice(device.id)) {
      // Dedicated sessions (e.g. official online competition) can explicitly
      // select the same cube. Release its primary connection before opening GATT.
      options().validateDevice?.(device);
      sharedCubeConnection.disconnect();
    }
    const connectionStartedAt = performance.now();
    const generation = connectionGeneration + 1;
    connectionGeneration = generation;
    intentionalDisconnect = false;
    cancelPendingReconnect();

    // Recover the MAC from BLE advertisements BEFORE connecting, but only
    // when no reusable value is already available. A MAC is persisted after
    // the first decoded move, so returning cubes can skip the advertisement
    // wait. The handshake's key-error path clears a stale value and asks the
    // user again if the cube identity or key ever changes.
    await syncAccountMacs();
    if (generation !== connectionGeneration) return;
    const legacyMac = savedMac(device.id);
    if (device.name && device.name !== device.id && legacyMac) {
      if (!savedMac(device.name)) saveMac(device.name, legacyMac);
      clearMac(device.id);
    }
    const nameDriver = pickDriver(device);
    const nativeMac = installedBleDeviceMac(device);
    const reusableMac = nameDriver?.needsMac
      ? nativeMac ?? (nameDriver.brand === 'moyu32' ? savedMac(device.name ?? device.id) : savedMac(device.name))
        ?? parseMacFromName(device.name)
        ?? (nameDriver.brand === 'moyu32' ? null : nameDriver.defaultMac?.(device))
        ?? null
      : null;
    const shouldWatchMac = (nameDriver === null
      || (nameDriver.needsMac === true && reusableMac === null));
    setAdvertisementDiagnostic(shouldWatchMac
      ? {
          phase: 'advertisement',
          eventNumber: 0,
          elapsedMs: 0,
          complete: false,
          totalElapsedMs: 0,
          advertisementMs: null,
          gattMs: null,
          discoveryMs: null,
          handshakeMs: null,
        }
      : null);
    const advMac = nativeMac ?? (shouldWatchMac
      ? await watchAdvertisementsMac(device, {
          onAdvertisement: (observation) => {
            if (connectionGeneration === generation) {
              setAdvertisementDiagnostic((current) => current
                ? {
                    ...current,
                    ...observation,
                    totalElapsedMs: Math.max(0, Math.round(performance.now() - connectionStartedAt)),
                  }
                : null);
            }
          },
        }).catch((err: unknown) => { throw atStage('advertisement', err); })
      : null);
    if (connectionGeneration !== generation) return;
    const advertisementMs = Math.max(0, Math.round(performance.now() - connectionStartedAt));
    setAdvertisementDiagnostic((current) => current
      ? { ...current, phase: 'gatt', totalElapsedMs: advertisementMs, advertisementMs }
      : null);
    const reportPhase = (phase: 'discovery' | 'handshake' | 'connected', completedPhaseMs: number) => {
      if (connectionGeneration !== generation) return;
      setAdvertisementDiagnostic((current) => {
        if (!current) return null;
        const timing = phase === 'discovery'
          ? { gattMs: completedPhaseMs }
          : phase === 'handshake'
            ? { discoveryMs: completedPhaseMs }
            : { handshakeMs: completedPhaseMs };
        return {
          ...current,
          ...timing,
          phase,
          totalElapsedMs: Math.max(0, Math.round(performance.now() - connectionStartedAt)),
        };
      });
    };
    try {
      await attachToDevice(device, advMac, generation, reportPhase);
    } catch (error) {
      if (connectionGeneration !== generation || !isTransientGattDisconnect(error)) {
        throw error;
      }
      // Windows/Chrome can finish service discovery just as the peripheral
      // drops the first GATT link (DOMException code 19). Retry that known
      // transient once on the same authorised device; never reopen the picker
      // or repeat advertisement/MAC recovery, and never loop indefinitely.
      cancelPendingReconnect();
      await attachToDevice(device, advMac, generation, reportPhase);
    }
    if (connectionGeneration === generation && snapshot.status.connected && activeDevice === device) {
      recordSelection();
    }
  };

  const connect = async (pick?: ConnectPickOptions): Promise<void> => {
    const owner = activeConsumer;
    // Dev escape hatch: `__cuberootFakeCube.arm()` in the console stands up a
    // fake GAN v4 peripheral so the whole smart-cube experience can be driven
    // without hardware. It joins the normal path below at the same point a real
    // device does — driver selection, MAC handling and the handshake all run
    // for real. Compiled out of production; see ./fake_cube.ts.
    const fake = options().allowSimulated !== false ? armedFakeCube() : null;
    if (fake) {
      if (shared && (activeDevice || cleanup)) disconnect();
      simulated = true;
      const generation = connectionGeneration + 1;
      connectionGeneration = generation;
      intentionalDisconnect = false;
      cancelPendingReconnect();
      await attachToDevice(fake.device, fake.mac, generation);
      return;
    }

    if (mayUseMiniProgramBridge()) {
      if (shared && snapshot.status.connected) return;
      const generation = connectionGeneration + 1;
      connectionGeneration = generation;
      const isCurrentSession = (): boolean => connectionGeneration === generation;
      let session: SmartCubeSessionLease<CubeMoveMetadata> | null = null;
      const isCurrentBridgeSession = (): boolean => (
        isCurrentSession() && session?.isCurrent() === true
      );
      intentionalDisconnect = false;
      cancelPendingReconnect();
      cleanup?.();
      cleanup = null;

      const applyBridgeEvent = (calibration: boolean | undefined, apply: () => void): void => {
        if (!isCurrentBridgeSession()) return;
        const previous = relayCalibrating;
        if (calibration) relayCalibrating = true;
        try { apply(); } finally { relayCalibrating = previous; }
      };
      const bridge = await connectMiniProgramCubeBridge({
        onMove: (move, deviceTs, metadata, calibration) => {
          applyBridgeEvent(calibration, () => session!.move(move, deviceTs, metadata));
        },
        onState: (facelets, calibration) => {
          applyBridgeEvent(calibration, () => adoptCubeState(session!, facelets));
        },
        onBattery: (level) => {
          if (isCurrentBridgeSession()) {
            setStatus((current) => ({ ...current, battery: level }));
          }
        },
        onGyro: (quaternion, velocity) => {
          if (isCurrentBridgeSession()) gyroSink(quaternion, velocity);
        },
        onStatus: (next) => {
          if (!isCurrentBridgeSession()) return;
          if (next.phase === 'connected') relayCalibrating = next.calibrating === true;
          if ((next.phase === 'disconnected' || next.phase === 'error')
            && cleanup) {
            connectionGeneration += 1;
            internalDisconnect('gatt-lost');
          }
        },
      });
      if (!isCurrentSession()) {
        bridge.disconnect();
        return;
      }

      hijack = null;
      hijackStep = null;
      setHijacked(false);
      session = sessionController.open();
      cleanup = bridge.disconnect;
      established = true;
      resetDevice = bridge.resetDeviceState ?? null;
      setStatus({
        connected: true,
        brand: normalizeMiniProgramCubeBrand(bridge.brand),
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

    // Keep the existing stream alive while the chooser is open.
    const pickerGeneration = shared ? connectionGeneration : connectionGeneration + 1;
    connectionGeneration = pickerGeneration;
    if (!shared) {
      intentionalDisconnect = false;
      cancelPendingReconnect();
    }
    const device = await requestBluetoothDevice((nameOnly) =>
      pickerOptions(pick?.acceptAllDevices === true, nameOnly));
    if (connectionGeneration !== pickerGeneration || (shared && activeConsumer !== owner)) return;
    if (!device) return;
    await connectDevice(device, pick?.onDeviceConnected);
  };

  const preconnectGrantedDevice = async (deviceId?: string): Promise<boolean> => {
    if (shared && snapshot.status.connected) return true;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
    if (mayUseMiniProgramBridge() || installedBleAvailable()) return false;
    const generation = connectionGeneration;
    const owner = activeConsumer;
    let device: BluetoothDevice | null = null;
    const attempt = async () => {
      const devices = await getGrantedDevices(deviceId);
      if (generation !== connectionGeneration || (shared && activeConsumer !== owner)) return false;
      device = deviceId ? devices.find(candidate => candidate.id === deviceId) ?? null : grantedCubeForPreconnect(devices);
      if (!device) return false;
      await connectDevice(device);
      return snapshot.status.connected;
    };
    if (!deviceId) return attempt();

    // Release the chooser immediately on a skip, even if the browser is
    // still retrieving its grants or trying to open the GATT connection.
    const pending = pendingConnection;
    let cancel: () => void = () => {};
    const cancelled = new Promise<false>(resolve => {
      cancel = () => {
        cancelRememberedReconnect = undefined;
        if (pendingConnection === pending) pendingConnection = undefined;
        try { device?.gatt?.disconnect(); } catch { /* already disconnected */ }
        resolve(false);
      };
    });
    cancelRememberedReconnect = cancel;
    const timer = setTimeout(() => disconnect(), 10_000);
    try {
      return await Promise.race([attempt(), cancelled]);
    } finally {
      clearTimeout(timer);
      if (cancelRememberedReconnect === cancel) cancelRememberedReconnect = undefined;
    }
  };

  const getFaces = () => {
    if (!snapshot.status.connected) return null;
    const faceletView = sessionController.getFacelets();
    if (!faceletView) return null;
    // Consumers must see the same state `facelets` shows, hijack included —
    // otherwise the two disagree mid-training and whichever one a caller
    // happens to read decides its behaviour.
    return fromFaceletString(faceletView);
  };

  const setGyro = async (enabled: boolean): Promise<boolean> => {
    const fn = updateDeviceGyro;
    if (!fn) return false;
    try {
      await fn(enabled);
      return true;
    } catch {
      return false;
    }
  };

  function syncGyroPreference() {
    if (!shared || !snapshot.status.connected || !updateDeviceGyro) return;
    const enabled = !!options().onGyro;
    if (enabled === requestedGyro) return;
    requestedGyro = enabled;
    void setGyro(enabled);
  }

  function changeConsumer(next: symbol | undefined) {
    const previous = activeConsumer;
    activeConsumer = undefined;
    cancelMacPrompt?.();
    if (shared && previous !== undefined
      && (simulated || (pendingConnection?.owner === previous && !established))) {
      disconnect();
    }
    activeConsumer = next;
    if (!shared) return;
    // Rebase on the physical state when leaving a training case. A change
    // of page or solve criterion must never count as a completed solve.
    hijack = null;
    hijackStep = null;
    setHijacked(false);
    changingConsumer = true;
    try { sessionController.republish(); }
    finally { changingConsumer = false; }
    syncGyroPreference();
  }

  function bind(owner: symbol, getOptions: () => UseBluetoothCubeOpts) {
    consumers.set(owner, getOptions);
    changeConsumer(owner);
    return () => {
      consumers.delete(owner);
      if (activeConsumer !== owner) return;
      changeConsumer([...consumers.keys()].at(-1));
      if (!shared) disconnect();
    };
  }

  async function connectFor<T>(owner: symbol, start: () => Promise<T>, inactive: T): Promise<T> {
    if (activeConsumer !== owner) return inactive;
    if (!shared) return start();
    if (pendingConnection) return inactive;
    // Register ownership before calling into the browser to retain the user gesture.
    const pending = { owner };
    pendingConnection = pending;
    try { return await start(); }
    finally { if (pendingConnection === pending) pendingConnection = undefined; }
  }

  function commands(owner: symbol) {
    const canControl = () => activeConsumer === owner;
    return {
      connect: (pick?: ConnectPickOptions) => connectFor(owner, () => connect(pick), undefined),
      connectDevice: (device: BluetoothDevice, onDeviceConnected?: (id: string) => void) =>
        connectFor(owner, () => connectDevice(device, onDeviceConnected), undefined),
      preconnectGrantedDevice: (deviceId?: string) =>
        connectFor(owner, () => preconnectGrantedDevice(deviceId), false),
      disconnect: () => { if (canControl()) disconnect(); },
      resetState: () => { if (canControl()) resetState(); },
      resetDeviceState: async () => { if (canControl()) await resetDeviceState(); },
      getFaces: () => canControl() ? getFaces() : null,
      setGyro: (enabled: boolean) => canControl() ? setGyro(enabled) : Promise.resolve(false),
      hijackTo: (target: Parameters<typeof hijackTo>[0], step?: CubeStep) =>
        canControl() && hijackTo(target, step),
      clearHijack: () => { if (canControl()) clearHijack(); },
    };
  }

  return {
    bind,
    commands,
    disconnect,
    syncGyroPreference,
    ownsDevice: (id: string) => activeDevice?.id === id,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

// Created only in the browser, and only on routes that use the primary cube.
// Next.js client navigation keeps this module alive even on pages with no cube UI.
let sharedCubeConnection: ReturnType<typeof createBluetoothCubeConnection> | undefined;
const getServerSnapshot = () => INITIAL_SNAPSHOT;

export function useBluetoothCube(opts: UseBluetoothCubeOpts = {}): BluetoothCubeHandle {
  const [binding] = useState(() => {
    const shared = opts.shareConnection === true && typeof window !== 'undefined';
    const connection = shared
      ? sharedCubeConnection ??= createBluetoothCubeConnection(true)
      : createBluetoothCubeConnection(false);
    const owner = Symbol();
    return { connection, owner, commands: connection.commands(owner) };
  });
  const { connection, owner, commands } = binding;
  const options = useRef(opts);
  useLayoutEffect(() => {
    options.current = opts;
    connection.syncGyroPreference();
  });
  useLayoutEffect(() => connection.bind(owner, () => options.current), [connection, owner]);
  const snapshot = useSyncExternalStore(connection.subscribe, connection.getSnapshot, getServerSnapshot);
  return useMemo(() => ({
    ...snapshot,
    ...commands,
    resetDeviceState: snapshot.resetDeviceState ? commands.resetDeviceState : undefined,
  }), [snapshot, commands]);
}
