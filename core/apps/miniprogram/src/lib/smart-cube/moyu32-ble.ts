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
import {
  connectEncryptedBle,
  extractBleMacFromAdvertisement,
  normalizeBleMac,
  type EncryptedBleConnection,
} from './encrypted-ble';

const MOYU32_COMPANY_IDS = Array.from({ length: 255 }, (_value, index) => (index + 1) << 8);

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
  let initialStateReceived = false;
  const initialFrames = [
    createMoyu32Command(MOYU32_MESSAGE_INFO),
    createMoyu32Command(MOYU32_MESSAGE_STATE),
    createMoyu32Command(MOYU32_MESSAGE_BATTERY),
  ];
  return connectEncryptedBle({
    api,
    diagnosticLabel: 'moyu32',
    device: options.device,
    signal: options.signal,
    serviceUuid: MOYU32_SERVICE_UUID,
    notifyCharacteristicUuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID,
    characteristicUuid: MOYU32_WRITE_CHARACTERISTIC_UUID,
    matches: (device) => matchesMoyu32Name(device.name) || matchesMoyu32Name(device.localName),
    resolveMac: (device) => {
      const deviceMac = normalizeBleMac(device.deviceId);
      if (deviceMac) return { source: 'device-id', value: deviceMac };
      const advertised = extractBleMacFromAdvertisement(device.advertisData, {
        companyIds: MOYU32_COMPANY_IDS,
        layout: 'last6-reversed',
      });
      if (advertised) return { source: 'manufacturer-data', value: advertised };
      const named = moyu32DefaultMac(device.name) ?? moyu32DefaultMac(device.localName);
      return named ? { source: 'device-name-default', value: named } : null;
    },
    createCipher: (mac) => {
      return createMoyu32Cipher(mac);
    },
    initialFrames,
    isReadyFrame: () => initialStateReceived,
    readyTimeoutMs: 4_000,
    retryInitialFramesAfterMs: 1_000,
    onDisconnect: options.onDisconnect,
    onFrame: (frame, _write, diagnostic) => {
      const notification = decodeMoyu32Notification(frame, state);
      if (notification.state !== null || notification.moves.length > 0
        || notification.battery !== null || state.badFrames > 0) {
        diagnostic.info('decoded-frame', {
          messageType: frame[0] ?? null,
          state: notification.state !== null,
          moves: notification.moves,
          battery: notification.battery,
          gyro: notification.gyro !== null,
          badFrames: state.badFrames,
          prevMoveCount: state.prevMoveCount,
        });
      }
      if (notification.state) {
        initialStateReceived = true;
        options.onState?.(notification.state);
      }
      if (notification.gyro) options.onGyro?.(notification.gyro);
      for (const move of notification.moves) options.onMove?.(move.mv, move.ts);
      return notification.battery;
    },
  });
}
