import {
  GIIKER_COMMAND_BATTERY,
  GIIKER_DATA_SERVICE_UUID,
  GIIKER_NOTIFY_CHARACTERISTIC_UUID,
  GIIKER_READ_CHARACTERISTIC_UUID,
  GIIKER_RW_SERVICE_UUID,
  GIIKER_WRITE_CHARACTERISTIC_UUID,
  matchesGiikerName,
  parseGiikerFrame,
} from '@cuberoot/shared/smart-cube/giiker';
import {
  writeGattValue,
  type CubeDriver,
  type CubeDriverContext,
  type CubeDriverStartResult,
} from './driver';
import type { CubeBrand } from './types';

export const giikerDriver: CubeDriver = {
  brand: 'giiker' satisfies CubeBrand,
  service: GIIKER_DATA_SERVICE_UUID,
  namePrefixes: ['Gi', 'Mi Smart Magic Cube', 'Hi-'],
  optionalServices: [GIIKER_RW_SERVICE_UUID],

  matches(device: BluetoothDevice): boolean {
    return matchesGiikerName(device.name);
  },

  async start(server, onMove, ctx?: CubeDriverContext): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GIIKER_DATA_SERVICE_UUID);
    const notifyChar = await service.getCharacteristic(GIIKER_NOTIFY_CHARACTERISTIC_UUID);
    let previousHistory: number[] | null = null;
    let lastBattery: number | null = null;

    const handleFrame = (value: DataView): void => {
      const frame = parseGiikerFrame(value, previousHistory);
      if (!frame) return;
      previousHistory = frame.history;
      for (const move of frame.moves) onMove(move);
      if (frame.facelets) ctx?.onState?.(frame.facelets);
    };
    const onValue = (event: Event): void => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
      if (!value) return;
      try { handleFrame(value); } catch { /* Ignore malformed device frames. */ }
    };

    notifyChar.addEventListener('characteristicvaluechanged', onValue);
    await notifyChar.startNotifications();
    try { handleFrame(await notifyChar.readValue()); } catch { /* Read is optional. */ }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      notifyChar.removeEventListener('characteristicvaluechanged', onValue);
      void notifyChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => {
      try {
        const rwService = await server.getPrimaryService(GIIKER_RW_SERVICE_UUID);
        const readChar = await rwService.getCharacteristic(GIIKER_READ_CHARACTERISTIC_UUID);
        const writeChar = await rwService.getCharacteristic(GIIKER_WRITE_CHARACTERISTIC_UUID);
        const level = await new Promise<number | null>((resolve) => {
          let settled = false;
          const finish = (value: number | null): void => {
            if (settled) return;
            settled = true;
            readChar.removeEventListener('characteristicvaluechanged', onBattery);
            void readChar.stopNotifications().catch(() => {});
            resolve(value);
          };
          const onBattery = (event: Event): void => {
            const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
            const percent = value && value.byteLength >= 2 ? value.getUint8(1) : null;
            finish(percent !== null && percent <= 100 ? percent : null);
          };
          readChar.addEventListener('characteristicvaluechanged', onBattery);
          void readChar.startNotifications().then(async () => {
            const command = new Uint8Array([GIIKER_COMMAND_BATTERY]);
            await writeGattValue(writeChar, command);
          }).catch(() => finish(null));
          setTimeout(() => finish(null), 1_500);
        });
        if (level !== null) lastBattery = level;
        return level ?? lastBattery;
      } catch {
        return lastBattery;
      }
    };

    return { battery, cleanup };
  },
};
