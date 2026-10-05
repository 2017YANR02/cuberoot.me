import { extractGanV4MacFromAdvertisement, GAN_V4_MANUFACTURER_DATA_CICS } from '@cuberoot/shared/smart-cube/gan-v4';
import { macStringToBytes, normalizeMac } from '@cuberoot/shared/timer/external/mac';
import type { BleDeviceRef } from './transport';

/** Device IDs are MACs on Windows/Android, but UUIDs on Apple platforms. */
export async function resolveCubeMac(
  device: BleDeviceRef,
  family: 'gan' | 'moyu32',
  requestMac?: (deviceName: string) => Promise<string | null>,
): Promise<Uint8Array> {
  const nativeMac = normalizeMac(device.macAddress) ?? normalizeMac(device.id);
  if (nativeMac && nativeMac !== '00:00:00:00:00:00') return macStringToBytes(nativeMac);
  if (family === 'gan') {
    for (const companyId of GAN_V4_MANUFACTURER_DATA_CICS) {
      const mac = extractGanV4MacFromAdvertisement(device.manufacturerData?.get(companyId));
      if (mac) return mac;
    }
    const fullMac = /([0-9a-f]{12})$/i.exec(device.name)?.[1];
    if (fullMac) return macStringToBytes(fullMac.match(/.{2}/g)!.join(':'));
  }
  // MY32 name suffixes are not a complete address. Like Web, require the
  // actual MAC instead of assuming the CF:30:16:00 prefix on Apple platforms.
  const supplied = normalizeMac(await requestMac?.(device.name));
  if (!supplied || supplied === '00:00:00:00:00:00') throw new Error('Cube MAC address required');
  return macStringToBytes(supplied);
}
