/**
 * Runtime-neutral contract for timer hardware surfaces.
 *
 * Discovery, permissions, GATT and microphone APIs stay in host adapters.
 * This module only describes which real devices a host can expose and which
 * actions the timer UI may offer for each device.
 */

export type TimerDeviceKind = 'smart-cube' | 'smart-timer' | 'stackmat';

export type TimerDeviceConnectionPhase =
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface TimerDeviceAvailableDevice {
  id: string;
  name: string;
  rssi?: number;
}

export interface TimerDeviceSnapshot {
  battery?: number | null;
  deviceName?: string | null;
  hasGyro?: boolean;
  lastMove?: string | null;
  phase: TimerDeviceConnectionPhase;
  protocol?: string | null;
  solved?: boolean | null;
}

export type TimerDeviceCapability =
  | 'scan'
  | 'connect'
  | 'disconnect'
  | 'state'
  | 'gyro'
  | 'reset'
  | 'autoTiming';

export type TimerDeviceCapabilities = Readonly<
  Partial<Record<TimerDeviceCapability, boolean>>
>;

/** A device entry that is backed by a host adapter in the current runtime. */
export interface TimerDeviceRegistration {
  capabilities: TimerDeviceCapabilities;
  id: string;
  kind: TimerDeviceKind;
  /** Stable localization key; user-facing copy belongs to the host/UI. */
  labelKey: string;
}

/**
 * The host reports adapter ids rather than handing platform objects to the
 * shared layer. An id absent from this set is never rendered as an entry.
 */
export interface TimerDeviceRegistryInput {
  adapterIds: readonly string[];
  registrations: readonly TimerDeviceRegistration[];
}

export interface TimerDeviceRegistry {
  get(id: string): TimerDeviceRegistration | undefined;
  list(): readonly TimerDeviceRegistration[];
}

function uniqueIds(ids: readonly string[]): ReadonlySet<string> {
  return new Set(ids);
}

/**
 * Build the visible device registry for one host.
 *
 * Registrations are deliberately filtered by adapter id. This prevents a
 * shared UI from displaying smart timers or Stackmat controls before that
 * host has a real transport/permission adapter for them.
 */
export function createTimerDeviceRegistry({
  adapterIds,
  registrations,
}: TimerDeviceRegistryInput): TimerDeviceRegistry {
  const available = uniqueIds(adapterIds);
  const visible = registrations.filter((registration) => available.has(registration.id));
  const byId = new Map(visible.map((registration) => [registration.id, registration]));

  return {
    get: (id) => byId.get(id),
    list: () => visible,
  };
}

/**
 * Canonical registrations for the currently supported smart-cube family.
 * Transport implementations opt in by returning the corresponding id.
 */
export const SMART_CUBE_TIMER_DEVICE_REGISTRATIONS: readonly TimerDeviceRegistration[] = [
  {
    id: 'smart-cube',
    kind: 'smart-cube',
    labelKey: 'smartCube',
    capabilities: {
      connect: true,
      disconnect: true,
      state: true,
      reset: true,
    },
  },
];
