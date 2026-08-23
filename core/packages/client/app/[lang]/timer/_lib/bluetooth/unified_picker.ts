import {
  CUBE_DRIVERS,
  pickerOptions,
  requestBluetoothDevice,
} from './index';
import { BLUETOOTH_TIMER_DRIVERS } from './timer';

export type UnifiedBluetoothDeviceKind = 'smart-cube' | 'smart-timer';

/** GAN v1 cubes share FFF0 with GAN timers but additionally expose 180A. */
export const GAN_V1_DEVICE_INFORMATION_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

/** One chooser containing every smart cube and BLE timer we can drive. */
export function unifiedBluetoothPickerOptions(nameOnly = false): RequestDeviceOptions {
  const cube = pickerOptions(false, nameOnly);
  const timerNameFilters = BLUETOOTH_TIMER_DRIVERS.flatMap((driver) =>
    driver.namePrefixes.map((namePrefix) => ({ namePrefix })));

  return {
    filters: [
      ...(cube.filters ?? []),
      ...timerNameFilters,
    ],
    optionalServices: unique([
      ...(cube.optionalServices ?? []),
      ...BLUETOOTH_TIMER_DRIVERS.map((driver) => driver.service),
      GAN_V1_DEVICE_INFORMATION_SERVICE,
    ]),
    optionalManufacturerData: unique([
      ...(cube.optionalManufacturerData ?? []),
      ...BLUETOOTH_TIMER_DRIVERS.flatMap((driver) =>
        Array.from(driver.manufacturerDataCics ?? [])),
    ]),
  };
}

/** Open the unified picker through the cube adapter's browser compatibility path. */
export function requestUnifiedBluetoothDevice(): Promise<BluetoothDevice | null> {
  return requestBluetoothDevice(unifiedBluetoothPickerOptions);
}

/**
 * GAN cubes and GAN timers share their advertised name, so their primary GATT
 * service is the only reliable discriminator. Other supported devices can be
 * routed from the driver registries without opening GATT first.
 */
export async function classifyUnifiedBluetoothDevice(
  device: BluetoothDevice,
): Promise<UnifiedBluetoothDeviceKind> {
  const cubeMatch = CUBE_DRIVERS.some((driver) => driver.matches(device));
  const timerMatches = BLUETOOTH_TIMER_DRIVERS.filter((driver) => driver.matches(device));

  if (timerMatches.length === 0) {
    // A cube may enter through a service filter even when a firmware revision
    // uses an unknown name. The cube connection path performs the final driver
    // check after service discovery and will report a useful error if needed.
    return 'smart-cube';
  }
  if (!cubeMatch) return 'smart-timer';
  if (!device.gatt) throw new Error('Selected device does not expose a GATT server.');

  const server = await device.gatt.connect();
  try {
    const timerServices = new Set(timerMatches.map((driver) => driver.service.toLowerCase()));

    // Legacy GAN v1 cubes expose the same FFF0 primary service as the GAN
    // timer. csTimer distinguishes them by the cube's additional Device
    // Information service (180A), so probe that exact service before FFF0.
    // The cube connector will then either select a supported cube driver or
    // report that this legacy protocol is unsupported; it must never subscribe
    // to the cube's FFF5 move history as though it were timer state.
    if (timerMatches.some((driver) => driver.kind === 'gan-timer')) {
      try {
        await server.getPrimaryService(GAN_V1_DEVICE_INFORMATION_SERVICE);
        server.disconnect();
        return 'smart-cube';
      } catch {
        // No 180A: continue with the direct smart-timer service probe.
      }
    }

    // Ask for the known timer service directly, as csTimer does. Some Web
    // Bluetooth bridges can resolve a specific service but cannot enumerate
    // every primary service, so enumeration must only be the fallback.
    let directProbeError: unknown;
    for (const driver of timerMatches) {
      try {
        await server.getPrimaryService(driver.service);
        return 'smart-timer';
      } catch (error) {
        directProbeError ??= error;
      }
    }

    try {
      const services = await server.getPrimaryServices();
      const isTimer = services.some((service) => timerServices.has(service.uuid.toLowerCase()));
      if (isTimer) return 'smart-timer';
    } catch {
      throw directProbeError;
    }

    server.disconnect();
    return 'smart-cube';
  } catch (error) {
    try { server.disconnect(); } catch { /* ignore cleanup errors */ }
    throw error;
  }
}
