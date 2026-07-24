/**
 * ExternalTimerSource — one interface for every external timing device.
 *
 * "External timer" here means a device that does the timing itself and tells
 * us about it, as opposed to a smart CUBE (which streams moves and lets the
 * page do the timing — see `../index.ts`). Three implementations exist today:
 *
 *   - `stackmat-mic`  Stackmat Gen 3/4 decoded from the microphone jack
 *                     (`_lib/stackmat/source.ts`) — the original, mic-based.
 *   - `gan-timer`     GAN Smart Timer over BLE (`./gan_timer.ts`).
 *   - `qiyi-timer`    QiYi Timer / QiYi Adapter over BLE (`./qiyi_timer.ts`).
 *
 * State vocabulary
 * ----------------
 * We adopt csTimer's vocabulary verbatim (upstream `src/js/hardware/
 * bluetooth.js:178-191`) so that porting more devices is a table lookup and
 * nothing else. Upstream uses small integers; we use string literals because
 * they survive logging, storage and React DevTools intact. The numeric codes
 * are still exported as `EXTERNAL_TIMER_STATE_CODE` for wire-level debugging
 * and for anyone diffing us against csTimer.
 *
 * Not every device produces every state:
 *
 *   state        GAN   QiYi   Stackmat(mic)   meaning
 *   ----------   ---   ----   -------------   --------------------------------
 *   DISCONNECT    o      o          o         link lost / source torn down
 *   GET_SET       o      o          o         grace delay expired, ready to go
 *   HANDS_OFF     o      -          -         hands lifted before grace expired
 *   RUNNING       o      o          o         counting
 *   STOPPED       o      o          o         stopped; carries `solveTime`
 *   IDLE          -      o          o         reset, waiting for hands
 *   HANDS_ON      o      -          o         hands placed on the pads
 *   FINISHED      o      o          -         emitted right after STOPPED
 *   INSPECTION    -      o          -         device-side WCA inspection
 *   GAN_RESET     o      -          -         GAN-specific reset event
 *
 * The consumer contract is deliberately narrow: **record a solve on STOPPED**,
 * reading `solveTime` (and `inspectTime` when present). Everything else is
 * presentation (green "ready" ring, running display, etc.).
 *
 * This file must stay free of Web Bluetooth types so the mic Stackmat can
 * implement the interface without dragging BLE ambient declarations in.
 */

/* ------------------------------------------------------------------ */
/*  State vocabulary                                                   */
/* ------------------------------------------------------------------ */

export type ExternalTimerState =
  | 'DISCONNECT'
  | 'GET_SET'
  | 'HANDS_OFF'
  | 'RUNNING'
  | 'STOPPED'
  | 'IDLE'
  | 'HANDS_ON'
  | 'FINISHED'
  | 'INSPECTION'
  | 'GAN_RESET';

/**
 * csTimer's numeric codes for the same states (bluetooth.js:178-191). Kept so
 * captured traces from upstream can be compared against ours byte-for-byte.
 * NOT used on the wire by us — the drivers index their own state tables.
 */
export const EXTERNAL_TIMER_STATE_CODE: Readonly<Record<ExternalTimerState, number>> = {
  DISCONNECT: 0,
  GET_SET: 1,
  HANDS_OFF: 2,
  RUNNING: 3,
  STOPPED: 4,
  IDLE: 5,
  HANDS_ON: 6,
  FINISHED: 7,
  INSPECTION: 8,
  GAN_RESET: 9,
};

/* ------------------------------------------------------------------ */
/*  Events                                                             */
/* ------------------------------------------------------------------ */

export interface ExternalTimerEvent {
  state: ExternalTimerState;
  /**
   * Recorded solve time in MILLISECONDS. Always present on STOPPED. QiYi also
   * attaches a running value to its plain state frames, so treat it as
   * "the device's current reading" and only *record* it on STOPPED.
   */
  solveTime?: number;
  /**
   * WCA inspection time in MILLISECONDS as measured by the device itself.
   * Only QiYi reports this (on its result frame); undefined everywhere else.
   */
  inspectTime?: number;
}

export type ExternalTimerListener = (ev: ExternalTimerEvent) => void;

/* ------------------------------------------------------------------ */
/*  Source                                                             */
/* ------------------------------------------------------------------ */

export type ExternalTimerKind = 'stackmat-mic' | 'gan-timer' | 'qiyi-timer' | 'unknown';

export interface ExternalTimerSource {
  /**
   * Which device this source talks to. `'unknown'` until connect() has picked
   * a device — the BLE source can't know before the browser picker resolves.
   */
  readonly kind: ExternalTimerKind;
  /** Human-readable label for the UI; `''` before connect() resolves. */
  readonly deviceName: string;
  /** True between a successful connect() and disconnect() / link loss. */
  readonly connected: boolean;
  /** Most recent state. `'DISCONNECT'` before the first event arrives. */
  readonly state: ExternalTimerState;
  /** ms carried by the most recent STOPPED event; 0 before the first one. */
  readonly lastTimeMs: number;
  /**
   * Subscribe to state events. Returns an unsubscribe function. Safe to call
   * before connect(); listeners persist across connect/disconnect cycles.
   */
  subscribe(listener: ExternalTimerListener): () => void;
  /**
   * Acquire the device. For BLE this opens the browser picker (must be called
   * from a user gesture); for the mic Stackmat it calls getUserMedia. Rejects
   * with a descriptive Error on failure; resolves without connecting if the
   * user cancels the picker.
   */
  connect(): Promise<void>;
  /** Release the device. Idempotent. Emits a final DISCONNECT event. */
  disconnect(): Promise<void>;
}

/** Plain, render-friendly snapshot of a source. What the UI binds to. */
export interface ExternalTimerStatus {
  connected: boolean;
  kind: ExternalTimerKind;
  deviceName: string;
  state: ExternalTimerState;
  lastTimeMs: number;
}

export function snapshotExternalTimer(source: ExternalTimerSource): ExternalTimerStatus {
  return {
    connected: source.connected,
    kind: source.kind,
    deviceName: source.deviceName,
    state: source.state,
    lastTimeMs: source.lastTimeMs,
  };
}

/* ------------------------------------------------------------------ */
/*  Small shared event bus                                             */
/* ------------------------------------------------------------------ */

export interface ExternalTimerBus {
  subscribe(listener: ExternalTimerListener): () => void;
  emit(ev: ExternalTimerEvent): void;
  /** Number of live listeners — for tests / leak assertions. */
  size(): number;
}

/**
 * Minimal listener set. Iterates over a snapshot so a listener that
 * unsubscribes (or subscribes) during dispatch can't corrupt the walk, and
 * a throwing listener can't starve the ones behind it.
 */
export function createExternalTimerBus(): ExternalTimerBus {
  const listeners = new Set<ExternalTimerListener>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    emit(ev) {
      for (const l of Array.from(listeners)) {
        try {
          l(ev);
        } catch {
          // A broken consumer must not take the device down.
        }
      }
    },
    size() {
      return listeners.size;
    },
  };
}
