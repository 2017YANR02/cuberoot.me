/**
 * Web Bluetooth transport for GAN's Nordic-UART v2 protocol.
 * Frame parsing, encryption and commands live in @cuberoot/shared so the
 * website and mini program consume one protocol implementation.
 */

import {
  GAN_V2_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V2_SERVICE_UUID,
  GAN_V2_WRITE_CHARACTERISTIC_UUID,
  createGanV2BatteryCommand,
  createGanV2Cipher,
  createGanV2DecodeState,
  createGanV2FaceletsCommand,
  createGanV2HardwareInfoCommand,
  decodeGanV2Frame,
  matchesGanV2Name,
  type GanV2DecodeState,
} from '@cuberoot/shared/smart-cube/gan-v2';
import type { CubeDriver, CubeDriverContext, CubeDriverStartResult } from './driver';
import { BATTERY_SERVICE, writeGattValue } from './driver';
import type { CubeBrand } from './types';
import { GAN_MAC_ADV, macStringToBytes, parseMacFromName } from './mac';

export { decodeGanV2Frame } from '@cuberoot/shared/smart-cube/gan-v2';
export type MoveDecodeState = GanV2DecodeState;

const BATTERY_LEVEL_CHAR = 0x2a19;

export const ganV2Driver: CubeDriver = {
  brand: 'gan-v2' satisfies CubeBrand,
  service: GAN_V2_SERVICE_UUID,
  namePrefixes: ['GAN', 'MG', 'AiCube'],
  optionalServices: [BATTERY_SERVICE],
  needsMac: true,
  macAdv: GAN_MAC_ADV,
  hasGyro: true,

  matches(device: BluetoothDevice): boolean {
    return matchesGanV2Name(device.name);
  },

  async start(
    server,
    onMove,
    ctx?: CubeDriverContext,
  ): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GAN_V2_SERVICE_UUID);
    const notifyChar = await service.getCharacteristic(GAN_V2_NOTIFY_CHARACTERISTIC_UUID);
    const nameMac = parseMacFromName(server.device.name);
    const mac = ctx?.mac
      ? macStringToBytes(ctx.mac)
      : (nameMac ? macStringToBytes(nameMac) : new Uint8Array(6));
    const cipher = createGanV2Cipher(mac, server.device.name ?? '');
    const decodeState = createGanV2DecodeState();
    let keyErrorFired = false;

    const onCharacteristic = (event: Event): void => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
      if (!value) return;
      const encrypted = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      let frame: Uint8Array;
      try {
        frame = cipher.decrypt(encrypted);
      } catch {
        return;
      }
      for (const move of decodeGanV2Frame(frame, decodeState, ctx?.onGyro)) onMove(move);
      if (!keyErrorFired && decodeState.badFrames >= 3) {
        keyErrorFired = true;
        ctx?.onKeyError?.();
      }
    };

    notifyChar.addEventListener('characteristicvaluechanged', onCharacteristic);
    await notifyChar.startNotifications();

    let commandChar: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      commandChar = await service.getCharacteristic(GAN_V2_WRITE_CHARACTERISTIC_UUID);
    } catch {
      // Some early firmware variants stream without exposing the write pipe.
    }

    let writeTail: Promise<void> = Promise.resolve();
    const sendCommand = (command: Uint8Array): Promise<void> => {
      if (!commandChar) return Promise.resolve();
      const encrypted = cipher.encrypt(command);
      const bytes = new Uint8Array(encrypted.length);
      bytes.set(encrypted);
      const task = writeTail.then(() => writeGattValue(commandChar!, bytes));
      writeTail = task.catch(() => {});
      return task.catch(() => {});
    };

    if (commandChar) {
      await sendCommand(createGanV2HardwareInfoCommand());
      await sendCommand(createGanV2FaceletsCommand());
      await sendCommand(createGanV2BatteryCommand());
    }

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      notifyChar.removeEventListener('characteristicvaluechanged', onCharacteristic);
      void notifyChar.stopNotifications().catch(() => {});
    };

    const battery = async (): Promise<number | null> => {
      try {
        const batteryService = await server.getPrimaryService(BATTERY_SERVICE);
        const batteryChar = await batteryService.getCharacteristic(BATTERY_LEVEL_CHAR);
        return (await batteryChar.readValue()).getUint8(0);
      } catch {
        return decodeState.battery;
      }
    };

    return { battery, cleanup };
  },
};
