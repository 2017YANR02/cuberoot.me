import { miniProgramApi } from '../platform';
import {
  buildQiyiPacket,
  createQiyiCipher,
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
import { connectEncryptedBle, type EncryptedBleConnection } from './encrypted-ble';

export type QiyiBleConnection = EncryptedBleConnection;
export interface ConnectQiyiOptions {
  api?: MiniProgramBleApi;
  device?: DiscoveredDevice;
  signal?: BleAbortSignal;
  onBattery?(level: number): void;
  onDisconnect?(message: string): void;
  onGyro?(quaternion: { w: number; x: number; y: number; z: number }): void;
  onMove?(move: string, timestamp?: number): void;
  onState?(facelets: string): void;
}

export async function connectQiyi(options: ConnectQiyiOptions = {}): Promise<QiyiBleConnection> {
  const api = options.api ?? (miniProgramApi() as unknown as MiniProgramBleApi);
  let timestamp = 0;
  return connectEncryptedBle({
    api,
    device: options.device,
    signal: options.signal,
    serviceUuid: QIYI_SERVICE_UUID,
    characteristicUuid: QIYI_CHARACTERISTIC_UUID,
    writeCharacteristicUuid: QIYI_WRITE_CHARACTERISTIC_UUID,
    matches: (device) => matchesQiyiName(device.name) || matchesQiyiName(device.localName),
    resolveMac: (device) => qiyiDefaultMac(device.name) ?? qiyiDefaultMac(device.localName),
    createCipher: () => createQiyiCipher(),
    initialFrames: (mac) => {
      const content = [0x00, 0x6b, 0x01, 0x00, 0x00, 0x22, 0x06, 0x00, 0x02, 0x08, 0x00];
      for (let index = 5; index >= 0; index--) content.push(mac[index]);
      return [buildQiyiPacket(content)];
    },
    onDisconnect: options.onDisconnect,
    onFrame: (frame, write) => {
      const notification = decodeQiyiNotification(frame, timestamp);
      if (notification.timestamp !== null) timestamp = Math.max(timestamp, notification.timestamp);
      if (notification.opcode === QIYI_OP_HELLO || notification.opcode === QIYI_OP_STATE) {
        const ts = notification.timestamp ?? 0;
        void write(buildQiyiPacket([
          notification.opcode,
          (ts >>> 24) & 0xff,
          (ts >>> 16) & 0xff,
          (ts >>> 8) & 0xff,
          ts & 0xff,
        ])).catch(() => {});
      }
      if (notification.state) options.onState?.(notification.state);
      if (notification.gyro) options.onGyro?.(notification.gyro);
      for (const move of [...notification.moves, ...notification.futureMoves]) options.onMove?.(move.mv, move.ts);
      return notification.battery;
    },
  });
}
