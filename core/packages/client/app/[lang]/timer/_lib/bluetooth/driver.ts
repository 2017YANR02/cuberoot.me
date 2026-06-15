/**
 * CubeDriver — protocol abstraction for one brand of smart cube.
 *
 * A driver knows:
 *   - which BLE GATT service identifies its cubes,
 *   - how to recognize a device that belongs to it (by name / advertised
 *     services),
 *   - how to open notifications and decode each notification into one or more
 *     moves in WCA face notation (`R`, `R'`, `R2`, `U`, `U'`, ...).
 *
 * The hook in `index.ts` walks the registry to find a driver for the picked
 * device, then calls `start()` once GATT is connected.
 *
 * Web Bluetooth ambient typings:
 *   The TypeScript DOM lib does not include Web Bluetooth. We declare a
 *   minimal subset of the API we use here so consumers don't need extra
 *   `@types` packages. These declarations are intentionally narrow.
 */

import type { CubeBrand } from './types';

/* ------------------------------------------------------------------ */
/*  Minimal Web Bluetooth ambient types                               */
/* ------------------------------------------------------------------ */

declare global {
  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    readonly uuid: string;
    readonly value?: DataView;
    readonly service: BluetoothRemoteGATTService;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
    writeValueWithResponse?(value: BufferSource): Promise<void>;
    writeValueWithoutResponse?(value: BufferSource): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(
      type: 'characteristicvaluechanged',
      listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => void,
    ): void;
    removeEventListener(
      type: 'characteristicvaluechanged',
      listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => void,
    ): void;
  }

  interface BluetoothRemoteGATTService {
    readonly uuid: string;
    readonly device: BluetoothDevice;
    getCharacteristic(uuid: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(uuid?: string | number): Promise<BluetoothRemoteGATTCharacteristic[]>;
  }

  interface BluetoothRemoteGATTServer {
    readonly device: BluetoothDevice;
    readonly connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(uuid: string | number): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(uuid?: string | number): Promise<BluetoothRemoteGATTService[]>;
  }

  interface BluetoothDevice extends EventTarget {
    readonly id: string;
    readonly name?: string;
    readonly gatt?: BluetoothRemoteGATTServer;
    addEventListener(
      type: 'gattserverdisconnected',
      listener: (this: BluetoothDevice, ev: Event) => void,
    ): void;
    removeEventListener(
      type: 'gattserverdisconnected',
      listener: (this: BluetoothDevice, ev: Event) => void,
    ): void;
  }

  interface BluetoothLEScanFilter {
    name?: string;
    namePrefix?: string;
    services?: (string | number)[];
  }

  interface RequestDeviceOptions {
    filters?: BluetoothLEScanFilter[];
    optionalServices?: (string | number)[];
    acceptAllDevices?: boolean;
  }

  interface Bluetooth extends EventTarget {
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
    getAvailability?(): Promise<boolean>;
  }

  interface Navigator {
    readonly bluetooth?: Bluetooth;
  }
}

/* ------------------------------------------------------------------ */
/*  Driver contract                                                   */
/* ------------------------------------------------------------------ */

export interface CubeDriverStartResult {
  /** Read the most recent battery level (0..100) or null if unavailable. */
  battery: () => Promise<number | null>;
  /** Tear down notification subscriptions; safe to call multiple times. */
  cleanup: () => void;
}

export interface CubeDriver {
  brand: CubeBrand;
  /** Primary GATT service UUID this driver advertises with. */
  service: string;
  /** Extra services the picker needs access to (battery, device-info, etc.). */
  optionalServices?: string[];
  /** Returns true if `device` looks like one of this driver's cubes. */
  matches(device: BluetoothDevice): boolean;
  /**
   * Connect to characteristics on an already-opened GATT server, subscribe to
   * notifications, and call `onMove` for every detected move (face notation).
   */
  start(
    server: BluetoothRemoteGATTServer,
    onMove: (move: string) => void,
  ): Promise<CubeDriverStartResult>;
}
