import { extractGanV4MacFromAdvertisement, GAN_V4_MANUFACTURER_DATA_CICS } from '@cuberoot/shared/smart-cube/gan-v4';
import { macStringToBytes, normalizeMac } from '@cuberoot/shared/timer/external/mac';
import type { BleDeviceRef } from './transport';

/** Device IDs are MACs on Windows/Android, but UUIDs on Apple platforms. */
export async function resolveCubeMac(
  device: BleDeviceRef,
  family: 'gan',
  requestMac?: (deviceName: string) => Promise<string | null>,
): Promise<Uint8Array> {
  const nativeMac = normalizeMac(device.macAddress) ?? normalizeMac(device.id);
  if (nativeMac && nativeMac !== '00:00:00:00:00:00') return macStringToBytes(nativeMac);
  if (family === 'gan') {
    for (const companyId of GAN_V4_MANUFACTURER_DATA_CICS) {
      const payload = device.manufacturerData?.get(companyId);
      if (!payload) continue;
      // Apple/Web adapters separate the company ID from its payload. Restore the
      // canonical segment consumed by the Mini Programs' shared parser, including
      // longer firmware payloads whose MAC is NOT in the trailing six bytes.
      const segment = Uint8Array.from([companyId & 0xff, companyId >> 8, ...payload]);
      const mac = extractGanV4MacFromAdvertisement(segment);
      if (mac) return mac;
    }
    const fullMac = /([0-9a-f]{12})$/i.exec(device.name)?.[1];
    if (fullMac) return macStringToBytes(fullMac.match(/.{2}/g)!.join(':'));
  }
  // MoYu32 uses resolveMoyu32Address with a verified encrypted handshake.
  const supplied = normalizeMac(await requestMac?.(device.name));
  if (!supplied || supplied === '00:00:00:00:00:00') throw new Error('Cube MAC address required');
  return macStringToBytes(supplied);
}
