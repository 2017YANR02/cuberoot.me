import { miniProgramApi } from '../platform';
import {
  createQiyiAckCommand,
  createQiyiCipher,
  createQiyiHelloCommand,
  decodeQiyiNotification,
  matchesQiyiName,
  QIYI_CHARACTERISTIC_UUID,
  QIYI_OP_HELLO,
  QIYI_OP_STATE,
  QIYI_SERVICE_UUID,
  QIYI_WRITE_CHARACTERISTIC_UUID,
  qiyiDefaultMac,
} from '@cuberoot/shared/smart-cube/qiyi';
import type { BleAbortSignal, DiscoveredDevice, MiniProgramBleApi } from './ble-api';
import {
  connectEncryptedBle,
  extractBleMacFromAdvertisement,
  normalizeBleMac,
  type EncryptedBleConnection,
} from './encrypted-ble';

export type QiyiBleConnection = EncryptedBleConnection;
export interface QiyiMoveMetadata {
  futureHistory?: boolean;
}
export interface ConnectQiyiOptions {
  api?: MiniProgramBleApi;
  device?: DiscoveredDevice;
  signal?: BleAbortSignal;
  onBattery?(level: number): void;
  onDisconnect?(message: string): void;
  onGyro?(quaternion: { w: number; x: number; y: number; z: number }): void;
  onMove?(move: string, timestamp?: number, metadata?: QiyiMoveMetadata): void;
  onState?(facelets: string): void;
}

export async function connectQiyi(options: ConnectQiyiOptions = {}): Promise<QiyiBleConnection> {
  const api = options.api ?? (miniProgramApi() as unknown as MiniProgramBleApi);
  let timestamp = 0;
  return connectEncryptedBle({
    api,
    diagnosticLabel: 'qiyi',
    device: options.device,
    signal: options.signal,
    mtu: 64,
    serviceUuid: QIYI_SERVICE_UUID,
    characteristicUuid: QIYI_CHARACTERISTIC_UUID,
    writeCharacteristicUuid: QIYI_WRITE_CHARACTERISTIC_UUID,
    preferNotifyCharacteristicForWrite: true,
    preferWriteNoResponse: true,
    matches: (device) => matchesQiyiName(device.name) || matchesQiyiName(device.localName),
    resolveMac: (device) => {
      const deviceMac = normalizeBleMac(device.deviceId);
      if (deviceMac) return { source: 'device-id', value: deviceMac };
      const advertised = extractBleMacFromAdvertisement(device.advertisData, {
        companyIds: [0x0504],
        layout: 'first6-reversed',
      });
      if (advertised) return { source: 'manufacturer-data', value: advertised };
      const named = qiyiDefaultMac(device.name) ?? qiyiDefaultMac(device.localName);
      return named ? { source: 'device-name-default', value: named } : null;
    },
    createCipher: () => createQiyiCipher(),
    initialFrames: (mac) => [createQiyiHelloCommand(mac)],
    isReadyFrame: (frame) => {
      const notification = decodeQiyiNotification(frame, 0);
      return notification.opcode === QIYI_OP_HELLO || notification.opcode === QIYI_OP_STATE;
    },
    readyTimeoutMs: 5_000,
    retryInitialFramesAfterMs: 1_500,
    onDisconnect: options.onDisconnect,
    onFrame: (frame, write, diagnostic) => {
      const notification = decodeQiyiNotification(frame, timestamp);
      if (notification.opcode !== null || notification.moves.length > 0
        || notification.futureMoves.length > 0 || notification.battery !== null) {
        diagnostic.info('decoded-frame', {
          header: frame[0] ?? null,
          opcode: notification.opcode,
          timestamp: notification.timestamp,
          state: notification.state !== null,
          moves: notification.moves,
          futureMoves: notification.futureMoves,
          battery: notification.battery,
          gyro: notification.gyro !== null,
        });
      }
      if (notification.latestTimestamp !== null) {
        timestamp = Math.max(timestamp, notification.latestTimestamp);
      }
      if (notification.opcode === QIYI_OP_HELLO || notification.opcode === QIYI_OP_STATE) {
        const ts = notification.timestamp ?? 0;
        void write(createQiyiAckCommand(notification.opcode, ts)).catch(() => {});
      }
      for (const move of notification.moves) options.onMove?.(move.mv, move.ts);
      if (notification.state) options.onState?.(notification.state);
      for (const move of notification.futureMoves) {
        options.onMove?.(move.mv, move.ts, { futureHistory: true });
      }
      if (notification.gyro) options.onGyro?.(notification.gyro);
      return notification.battery;
    },
  });
}
