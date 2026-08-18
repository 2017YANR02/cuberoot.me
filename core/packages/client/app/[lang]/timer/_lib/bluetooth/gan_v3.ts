/**
 * Web Bluetooth transport for GAN's 8653000a v3 protocol.
 * Shared owns frame parsing, recovery state, crypto and commands; this file
 * only adapts those contracts to the browser GATT API.
 */

import {
  GAN_V3_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V3_SERVICE_UUID,
  GAN_V3_WRITE_CHARACTERISTIC_UUID,
  createGanV3BatteryCommand,
  createGanV3Cipher,
  createGanV3DecodeState,
  createGanV3FaceletsCommand,
  createGanV3HardwareInfoCommand,
  createGanV3HistoryCommand,
  decodeGanV3Frame,
  matchesGanV3Name,
} from '@cuberoot/shared/smart-cube/gan-v3';
import { BATTERY_SERVICE, writeGattValue, type CubeDriver, type CubeDriverStartResult } from './driver';
import type { CubeBrand } from './types';
import { GAN_MAC_ADV, macStringToBytes } from './mac';

const BATTERY_LEVEL_CHAR = 0x2a19;
const IDLE_STATE_CHECK_MS = [650, 1600, 3200] as const;

function tryParseMacFromName(name: string | undefined): Uint8Array | null {
  const match = /([0-9A-Fa-f]{12})$/.exec(name ?? '');
  if (!match) return null;
  const mac = new Uint8Array(6);
  for (let index = 0; index < mac.length; index++) {
    mac[index] = Number.parseInt(match[1].slice(index * 2, index * 2 + 2), 16);
  }
  return mac;
}

export const ganV3Driver: CubeDriver = {
  brand: 'gan-v3' satisfies CubeBrand,
  service: GAN_V3_SERVICE_UUID,
  namePrefixes: ['GAN', 'Gi'],
  optionalServices: [BATTERY_SERVICE],
  needsMac: true,
  macAdv: GAN_MAC_ADV,

  matches(device: BluetoothDevice): boolean {
    return matchesGanV3Name(device.name);
  },

  async start(server, onMove, ctx): Promise<CubeDriverStartResult> {
    const service = await server.getPrimaryService(GAN_V3_SERVICE_UUID);
    const notifyChar = await service.getCharacteristic(GAN_V3_NOTIFY_CHARACTERISTIC_UUID);
    const mac = ctx?.mac
      ? macStringToBytes(ctx.mac)
      : (tryParseMacFromName(server.device.name) ?? new Uint8Array(6));
    const cipher = createGanV3Cipher(mac);

    let commandChar: BluetoothRemoteGATTCharacteristic | null = null;
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

    const decodeState = createGanV3DecodeState({
      requestHistory: (startMoveCounter, numberOfMoves) => {
        void sendCommand(createGanV3HistoryCommand(startMoveCounter, numberOfMoves));
      },
      onWedged: () => {
        decodeState.sync.reset();
        void sendCommand(createGanV3FaceletsCommand());
      },
      onState: (facelets) => ctx?.onState?.(facelets),
    });
    let keyErrorFired = false;
    let cleaned = false;
    const idleStateChecks = new Set<ReturnType<typeof setTimeout>>();

    const clearIdleStateChecks = (): void => {
      for (const timer of idleStateChecks) clearTimeout(timer);
      idleStateChecks.clear();
    };
    const scheduleIdleStateChecks = (): void => {
      clearIdleStateChecks();
      for (const delay of IDLE_STATE_CHECK_MS) {
        const timer = setTimeout(() => {
          idleStateChecks.delete(timer);
          if (!cleaned) void sendCommand(createGanV3FaceletsCommand());
        }, delay);
        idleStateChecks.add(timer);
      }
    };

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
      const moves = decodeGanV3Frame(frame, decodeState);
      for (const move of moves) onMove(move.mv, move.ts);
      if (moves.length > 0) scheduleIdleStateChecks();
      if (!keyErrorFired && decodeState.badFrames >= 6) {
        keyErrorFired = true;
        ctx?.onKeyError?.();
      }
    };

    notifyChar.addEventListener('characteristicvaluechanged', onCharacteristic);
    await notifyChar.startNotifications();
    try {
      commandChar = await service.getCharacteristic(GAN_V3_WRITE_CHARACTERISTIC_UUID);
    } catch {
      // Some firmware variants stream without exposing the write pipe.
    }

    if (commandChar) {
      await sendCommand(createGanV3HardwareInfoCommand());
      await sendCommand(createGanV3FaceletsCommand());
      await sendCommand(createGanV3BatteryCommand());
    }

    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      clearIdleStateChecks();
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
