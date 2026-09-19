import { miniProgramApi } from '../platform';
import {
  createMoyu32Cipher,
  createMoyu32Command,
  createMoyu32DecodeState,
  decodeMoyu32Notification,
  matchesMoyu32Name,
  MOYU32_MESSAGE_BATTERY,
  MOYU32_MESSAGE_GYRO_SWITCH,
  MOYU32_MESSAGE_INFO,
  MOYU32_MESSAGE_STATE,
  MOYU32_NOTIFY_CHARACTERISTIC_UUID,
  MOYU32_SERVICE_UUID,
  MOYU32_WRITE_CHARACTERISTIC_UUID,
  moyu32DefaultMac,
} from '@cuberoot/shared/smart-cube/moyu32';
import type { BleAbortSignal, DiscoveredDevice, MiniProgramBleApi } from './ble-api';
import { connectEncryptedBle, type EncryptedBleConnection } from './encrypted-ble';

export type Moyu32BleConnection = EncryptedBleConnection;
export interface ConnectMoyu32Options {
  api?: MiniProgramBleApi;
  device?: DiscoveredDevice;
  signal?: BleAbortSignal;
  onBattery?(level: number): void;
  onDisconnect?(message: string): void;
  onGyro?(quaternion: { w: number; x: number; y: number; z: number }): void;
  onMove?(move: string, timestamp?: number): void;
  onState?(facelets: string): void;
}

export async function connectMoyu32(options: ConnectMoyu32Options = {}): Promise<Moyu32BleConnection> {
  const api = options.api ?? (miniProgramApi() as unknown as MiniProgramBleApi);
  const state = createMoyu32DecodeState();
  const initialFrames = [
    createMoyu32Command(MOYU32_MESSAGE_INFO),
    createMoyu32Command(MOYU32_MESSAGE_STATE),
    createMoyu32Command(MOYU32_MESSAGE_BATTERY),
  ];
  return connectEncryptedBle({
    api,
    device: options.device,
    signal: options.signal,
    serviceUuid: MOYU32_SERVICE_UUID,
    notifyCharacteristicUuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID,
    characteristicUuid: MOYU32_WRITE_CHARACTERISTIC_UUID,
    matches: (device) => matchesMoyu32Name(device.name) || matchesMoyu32Name(device.localName),
    resolveMac: (device) => moyu32DefaultMac(device.name) ?? moyu32DefaultMac(device.localName),
    createCipher: (mac) => {
      return createMoyu32Cipher(mac);
    },
    initialFrames,
    onDisconnect: options.onDisconnect,
    onFrame: (frame) => {
      const notification = decodeMoyu32Notification(frame, state);
      if (notification.state) options.onState?.(notification.state);
      if (notification.gyro) options.onGyro?.(notification.gyro);
      for (const move of notification.moves) options.onMove?.(move.mv, move.ts);
      return notification.battery;
    },
  });
}
