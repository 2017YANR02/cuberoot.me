import { tr } from '../i18n';
import { resolveMoyu32Address, moyu32AdvertisementMac } from '@cuberoot/shared/smart-cube/moyu32';
import { createDeviceStateReset } from '@cuberoot/shared/smart-cube/device-reset';
import { miniProgramApi } from '../platform';
import {
  createMoyu32Cipher,
  createMoyu32ResetCommand,
  MOYU32_MESSAGE_MOVE,
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
} from '@cuberoot/shared/smart-cube/moyu32';
import type { BleAbortSignal, DiscoveredDevice, MiniProgramBleApi } from './ble-api';
import {
  connectEncryptedBle,
  type EncryptedBleConnection,
} from './encrypted-ble';


export type Moyu32BleConnection = EncryptedBleConnection & { resetDeviceState(): Promise<void> };
export interface ConnectMoyu32Options {
  api?: MiniProgramBleApi;
  requestMac?(): Promise<string | null>;
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
  let resetting = false;
  let disposed = false;
  let confirmed: { facelets: string; counter: number } | null = null;
  let pending: Uint8Array[] = [];
  let calibration: ReturnType<typeof createDeviceStateReset> | undefined;
  const connection = await connectEncryptedBle({
    api,
    diagnosticLabel: 'moyu32',
    device: options.device,
    signal: options.signal,
    serviceUuid: MOYU32_SERVICE_UUID,
    notifyCharacteristicUuid: MOYU32_NOTIFY_CHARACTERISTIC_UUID,
    characteristicUuid: MOYU32_WRITE_CHARACTERISTIC_UUID,
    matches: (device) => matchesMoyu32Name(device.name) || matchesMoyu32Name(device.localName),
    negotiateMac: (device, io) => {
      const key = 'cuberoot.moyu32.mac.' + device.deviceId;
      let cached: string | null = null;
      try { cached = miniProgramApi().getStorageSync(key) || null; } catch { /* unavailable in test hosts */ }
      const raw = device.advertisData && new Uint8Array(device.advertisData);
      return resolveMoyu32Address({
        id: device.deviceId, name: device.name || device.localName || '',
        hints: [device.deviceId, raw && raw.length >= 8 ? moyu32AdvertisementMac(raw.subarray(2)) : null, cached],
        io,
        onVerified: mac => { try { miniProgramApi().setStorageSync(key, mac); } catch { /* optional persistence */ } },
        requestMac: options.requestMac ?? (() => new Promise(resolve => {
          try {
            miniProgramApi().removeStorageSync(key);
            miniProgramApi().showModal({
              title: tr({ en: 'Cube Bluetooth MAC', zh: '魔方蓝牙 MAC 地址' }),
              editable: true, placeholderText: 'CF:30:16:00:12:34',
              success: result => resolve(result.confirm ? result.content ?? null : null),
              fail: () => resolve(null),
            });
          } catch { resolve(null); }
        })),
      });
    },
    createCipher: (mac) => {
      return createMoyu32Cipher(mac);
    },
    initialFrames,
    isReadyFrame: () => initialStateReceived,
    readyTimeoutMs: 4_000,
    retryInitialFramesAfterMs: 1_000,
    onDisconnect: options.onDisconnect,
    onDispose: () => { disposed = true; calibration?.dispose(); },
    onFrame: (frame, _write, diagnostic) => {
      if (resetting && frame[0] === MOYU32_MESSAGE_STATE) {
        if (calibration?.waiting) {
          const snapshotState = createMoyu32DecodeState();
          const snapshot = decodeMoyu32Notification(frame, snapshotState);
          if (snapshot.state === 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB') {
            confirmed = { facelets: snapshot.state, counter: snapshotState.prevMoveCount };
            calibration.observe(snapshot.state);
          }
        }
        return;
      }
      if (resetting && frame[0] === MOYU32_MESSAGE_MOVE) {
        if (pending.length >= 128) calibration?.cancel(new Error('Too many turns during calibration'));
        else pending.push(frame.slice());
        return;
      }
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
  calibration = createDeviceStateReset({
    automaticReply: true,
    sendReset: begin => connection.write(createMoyu32ResetCommand(), begin),
    prepareSnapshot() {}, requestSnapshot: async () => {},
  });
  return { ...connection, async resetDeviceState() {
    if (resetting) throw new Error('Device calibration already in progress');
    resetting = true; confirmed = null; pending = [];
    try {
      await calibration!.run();
      const snapshot = confirmed as { facelets: string; counter: number } | null;
      if (!snapshot) throw new Error('Missing confirmed cube state');
      state.prevMoveCount = snapshot.counter; state.deviceTime = 0;
      options.onState?.(snapshot.facelets);
    } finally {
      if (!disposed) for (const frame of pending) {
        const diff = (frame[11] - state.prevMoveCount) & 255;
        if (diff === 0 || diff >= 128) continue;
        for (const move of decodeMoyu32Notification(frame, state).moves) options.onMove?.(move.mv, move.ts);
      }
      resetting = false; pending = [];
    }
  } };
}
