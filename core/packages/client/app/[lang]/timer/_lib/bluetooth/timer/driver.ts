/**
 * BluetoothTimerDriver — protocol abstraction for one brand of BLE smart TIMER.
 *
 * Deliberately parallel to `../driver.ts` (`CubeDriver`) but a separate
 * contract, because the two device classes have nothing in common at the
 * payload level: a cube emits moves, a timer emits states + recorded times.
 * csTimer makes the same split — `GiikerCube` and `BluetoothTimer` are two
 * independent instances of its `BtDeviceGroupFactory`.
 *
 * The Web Bluetooth ambient types (`BluetoothDevice`,
 * `BluetoothRemoteGATTServer`, ...) are declared globally by `../driver.ts`.
 * We rely on those declarations; they are in scope for the whole program.
 */

import type { ExternalTimerEvent, ExternalTimerKind } from './types';

export interface BluetoothTimerContext {
  /**
   * Device MAC as "XX:XX:XX:XX:XX:XX" (upper-case, colon-separated), or null
   * when it could not be resolved. Only QiYi needs it, and only as a payload
   * inside its hello message — unlike the cube drivers, the AES key is fixed.
   */
  mac?: string | null;
}

export interface BluetoothTimerStartResult {
  /** Tear down notification subscriptions; safe to call multiple times. */
  cleanup: () => void;
}

export interface BluetoothTimerDriver {
  kind: Exclude<ExternalTimerKind, 'stackmat-mic' | 'unknown'>;
  /** Primary GATT service UUID; also what we pass as `optionalServices`. */
  service: string;
  /**
   * Device-name prefixes used as `requestDevice` filters. csTimer filters
   * smart timers by name only (the GAN timer does not advertise fff0 in its
   * scan record), so we do the same.
   */
  namePrefixes: readonly string[];
  /**
   * Company Identifier Codes whose manufacturer data must be exposed in
   * advertisement events, or Chrome strips them. Only QiYi uses this.
   */
  manufacturerDataCics?: readonly number[];
  /** True when `start()` wants a MAC in its context (QiYi only). */
  needsMac?: boolean;
  /** True if `device` looks like one of this driver's timers. */
  matches(device: BluetoothDevice): boolean;
  /**
   * Subscribe to the device's notifications on an already-open GATT server and
   * call `emit` once per decoded state change.
   */
  start(
    server: BluetoothRemoteGATTServer,
    emit: (ev: ExternalTimerEvent) => void,
    ctx?: BluetoothTimerContext,
  ): Promise<BluetoothTimerStartResult>;
}
