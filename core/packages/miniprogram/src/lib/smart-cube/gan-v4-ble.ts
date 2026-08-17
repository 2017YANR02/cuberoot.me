import {
  GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V4_SERVICE_UUID,
  GAN_V4_WRITE_CHARACTERISTIC_UUID,
  createGanV4BatteryCommand,
  createGanV4Cipher,
  createGanV4FaceletsCommand,
  createGanV4HardwareInfoCommand,
  createGanV4HistoryCommand,
  createGanV4DecodeState,
  decodeGanV4Frame,
  extractGanV4MacFromAdvertisement,
  matchesGanV4Name,
} from '@cuberoot/shared/smart-cube/gan-v4';
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
} from '@cuberoot/shared/smart-cube/gan-v2';
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
import {
  beginBleResourceCleanup,
  claimBleResourceLease,
  createBleNativeOperationQueue,
  ignoreBleFailure,
  invokeBleCleanupForLease,
  invokeBleForLease,
  invokeBleWithLateCleanupForLease,
  normalizeBleUuid,
  raceBleAbort,
  raceBleAbortWithLateCleanup,
  safeBleCallback,
  waitForBleCleanupDrain,
  BleOperationAbortedError,
  type BleAbortSignal,
  type CharacteristicValueChange,
  type BleConnectionStateChange,
  type BleCharacteristic,
  type BleService,
  type DiscoveredDevice,
  type MiniProgramBleApi,
  type BleResourceLease,
} from './ble-api';

// Keep the historical v4 file/API name stable for session callers; this adapter
// now selects the compatible GAN v2, v3, or v4 protocol from the discovered GATT service.
export interface GanV4BleConnection {
  readonly deviceId: string;
  readonly deviceName: string;
  disconnect(): Promise<void>;
  requestBattery(): Promise<number | null>;
}

export interface ConnectGanV4Options {
  api?: MiniProgramBleApi;
  signal?: BleAbortSignal;
  onBattery?(level: number): void;
  onDisconnect?(message: string): void;
  onGyro?(
    quaternion: { w: number; x: number; y: number; z: number },
    velocity: { x: number; y: number; z: number },
  ): void;
  onMove?(move: string, deviceTs?: number): void;
  onState?(facelets: string): void;
  scanTimeoutMs?: number;
}

export class GanV4BleError extends Error {
  constructor(
    public readonly code:
      | 'adapter-unavailable'
      | 'connection-failed'
      | 'device-not-found'
      | 'gatt-unavailable'
      | 'mac-unavailable'
      | 'protocol-error',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'GanV4BleError';
  }
}

interface GanDiscovery {
  device: DiscoveredDevice;
  mac: Uint8Array;
}

type GanProtocolFamily = 'v2' | 'v3' | 'v4';

interface GanProtocolGatt {
  family: GanProtocolFamily;
  notifyCharacteristicUuid: string;
  serviceUuid: string;
  writeCharacteristicUuid: string;
}

const GAN_PROTOCOLS: readonly GanProtocolGatt[] = [
  {
    family: 'v4',
    notifyCharacteristicUuid: GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
    serviceUuid: GAN_V4_SERVICE_UUID,
    writeCharacteristicUuid: GAN_V4_WRITE_CHARACTERISTIC_UUID,
  },
  {
    family: 'v3',
    notifyCharacteristicUuid: GAN_V3_NOTIFY_CHARACTERISTIC_UUID,
    serviceUuid: GAN_V3_SERVICE_UUID,
    writeCharacteristicUuid: GAN_V3_WRITE_CHARACTERISTIC_UUID,
  },
  {
    family: 'v2',
    notifyCharacteristicUuid: GAN_V2_NOTIFY_CHARACTERISTIC_UUID,
    serviceUuid: GAN_V2_SERVICE_UUID,
    writeCharacteristicUuid: GAN_V2_WRITE_CHARACTERISTIC_UUID,
  },
] as const;

const GAN_V3_IDLE_STATE_CHECK_MS = [650, 1600, 3200] as const;

function matchesGanName(name: string | undefined): boolean {
  return matchesGanV4Name(name) || matchesGanV3Name(name) || matchesGanV2Name(name);
}

function macFromText(value: string | undefined): Uint8Array | null {
  if (value && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) return null;
  const match = value?.match(/(?:^|[-_:])([0-9a-f]{2})[-_:]?([0-9a-f]{2})[-_:]?([0-9a-f]{2})[-_:]?([0-9a-f]{2})[-_:]?([0-9a-f]{2})[-_:]?([0-9a-f]{2})$/i);
  if (!match) return null;
  return Uint8Array.from(match.slice(1).map((part) => Number.parseInt(part, 16)));
}

function ganMac(device: DiscoveredDevice): Uint8Array | null {
  return extractGanV4MacFromAdvertisement(device.advertisData)
    ?? macFromText(device.deviceId)
    ?? macFromText(device.name)
    ?? macFromText(device.localName);
}

async function findGan(
  api: MiniProgramBleApi,
  lease: BleResourceLease,
  timeoutMs: number,
  signal: BleAbortSignal | undefined,
): Promise<GanDiscovery> {
  return new Promise<GanDiscovery>((resolve, reject) => {
    let settled = false;
    let sawGan = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let offAbort = (): void => {};

    const finish = (result: GanDiscovery | Error): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      offAbort();
      api.offBluetoothDeviceFound(onFound);
      void ignoreBleFailure(
        () => invokeBleCleanupForLease(lease, (callbacks) => {
          api.stopBluetoothDevicesDiscovery(callbacks);
        }),
      );
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    const onFound = (result: { devices: DiscoveredDevice[] }): void => {
      for (const device of result.devices) {
        if (!device.deviceId
          || !(matchesGanName(device.name) || matchesGanName(device.localName))) continue;
        sawGan = true;
        const mac = ganMac(device);
        if (mac) {
          finish({ device, mac });
          return;
        }
      }
    };

    api.onBluetoothDeviceFound(onFound);
    offAbort = signal?.onAbort(() => finish(new BleOperationAbortedError())) ?? offAbort;
    if (settled) return;
    timer = setTimeout(() => finish(new GanV4BleError(
      sawGan ? 'mac-unavailable' : 'device-not-found',
      sawGan
        ? '已发现 GAN，但未读取到设备地址。请让魔方保持唤醒并重新搜索'
        : '未发现 GAN 智能魔方，请唤醒魔方后重试',
    )), timeoutMs);

    const stopDiscovery = (): Promise<unknown> => invokeBleCleanupForLease(
      lease,
      (callbacks) => api.stopBluetoothDevicesDiscovery(callbacks),
    );
    const startDiscovery = invokeBleWithLateCleanupForLease(
      lease,
      (callbacks) => api.startBluetoothDevicesDiscovery({
        ...callbacks,
        allowDuplicatesKey: true,
      }),
      stopDiscovery,
    );
    void raceBleAbortWithLateCleanup(
      startDiscovery,
      signal,
      stopDiscovery,
    ).catch((error: unknown) => {
      if (error instanceof BleOperationAbortedError) {
        finish(error);
        return;
      }
      finish(new GanV4BleError(
        'adapter-unavailable',
        error instanceof Error ? error.message : '无法开始搜索 GAN 智能魔方',
        { cause: error },
      ));
    });
  });
}

export async function connectGanV4(
  options: ConnectGanV4Options = {},
): Promise<GanV4BleConnection> {
  const api = options.api ?? (wx as unknown as MiniProgramBleApi);
  const scanTimeoutMs = options.scanTimeoutMs ?? 12_000;
  if (!Number.isFinite(scanTimeoutMs) || scanTimeoutMs < 1_000 || scanTimeoutMs > 30_000) {
    throw new RangeError('scanTimeoutMs must be between 1000 and 30000.');
  }
  const lease = claimBleResourceLease(api);

  let adapterOpen = false;
  let active = false;
  let connectedDeviceId: string | null = null;
  let deviceName = 'GAN 智能魔方';
  let serviceId: string | null = null;
  let writeCharacteristicId: string | null = null;
  let notifyCharacteristicId: string | null = null;
  let notificationsEnabled = false;
  let notificationListener: ((result: CharacteristicValueChange) => void) | null = null;
  let connectionStateListener: ((result: BleConnectionStateChange) => void) | null = null;
  let disconnectPromise: Promise<void> | null = null;
  let closing = false;
  const writeQueue = createBleNativeOperationQueue(lease);
  let lastBattery: number | null = null;
  let protocolCleanup = (): void => {};
  const batteryWaiters = new Set<(level: number | null) => void>();

  const disconnect = (): Promise<void> => {
    if (disconnectPromise) return disconnectPromise;
    disconnectPromise = (async () => {
      const releaseCleanupBarrier = beginBleResourceCleanup(lease);
      closing = true;
      active = false;
      const pendingWrites = writeQueue.drain();
      protocolCleanup();
      for (const resolve of batteryWaiters) resolve(lastBattery);
      batteryWaiters.clear();
      if (notificationListener) {
        api.offBLECharacteristicValueChange(notificationListener);
        notificationListener = null;
      }
      if (connectionStateListener) {
        api.offBLEConnectionStateChange?.(connectionStateListener);
        connectionStateListener = null;
      }
      const finishCleanup = async (): Promise<void> => {
        try {
          // WeChat cannot cancel a write already handed to native code. Keep the
          // transport quarantined until its real callback arrives, even if the
          // public write promise has already timed out.
          await pendingWrites;
          if (notificationsEnabled && connectedDeviceId && serviceId && notifyCharacteristicId) {
            await ignoreBleFailure(
              () => invokeBleCleanupForLease(lease, (callbacks) => api.notifyBLECharacteristicValueChange({
                ...callbacks,
                characteristicId: notifyCharacteristicId as string,
                deviceId: connectedDeviceId as string,
                serviceId: serviceId as string,
                state: false,
              })),
            );
            notificationsEnabled = false;
          }
          if (connectedDeviceId) {
            await ignoreBleFailure(() => invokeBleCleanupForLease(lease, (callbacks) => api.closeBLEConnection({
              ...callbacks,
              deviceId: connectedDeviceId as string,
            })));
          }
          if (adapterOpen) {
            await ignoreBleFailure(
              () => invokeBleCleanupForLease(lease, (callbacks) => api.closeBluetoothAdapter(callbacks)),
            );
          }
        } finally {
          releaseCleanupBarrier();
        }
      };
      const cleanup = finishCleanup();
      if (await waitForBleCleanupDrain(pendingWrites)) await cleanup;
      else void cleanup.catch(() => {});
    })();
    return disconnectPromise;
  };

  const reportUnexpectedDisconnect = (message: string): void => {
    if (!active || closing) return;
    safeBleCallback(options.onDisconnect ? () => options.onDisconnect?.(message) : undefined);
    void disconnect();
  };

  try {
    try {
      const closeAdapter = (): Promise<unknown> => invokeBleCleanupForLease(
        lease,
        (callbacks) => api.closeBluetoothAdapter(callbacks),
      );
      await raceBleAbortWithLateCleanup(
        invokeBleWithLateCleanupForLease(
          lease,
          (callbacks) => api.openBluetoothAdapter(callbacks),
          closeAdapter,
        ),
        options.signal,
        closeAdapter,
      );
      adapterOpen = true;
    } catch (error) {
      if (error instanceof BleOperationAbortedError) throw error;
      throw new GanV4BleError('adapter-unavailable', '蓝牙不可用，请开启系统蓝牙后重试', {
        cause: error,
      });
    }

    const discovery = await findGan(api, lease, scanTimeoutMs, options.signal);
    connectedDeviceId = discovery.device.deviceId;
    deviceName = discovery.device.name ?? discovery.device.localName ?? deviceName;
    try {
      const closeConnection = (): Promise<unknown> => invokeBleCleanupForLease(
        lease,
        (callbacks) => api.closeBLEConnection({
          ...callbacks,
          deviceId: discovery.device.deviceId,
        }),
      );
      await raceBleAbortWithLateCleanup(
        invokeBleWithLateCleanupForLease(
          lease,
          (callbacks) => api.createBLEConnection({
            ...callbacks,
            deviceId: discovery.device.deviceId,
            timeout: 10_000,
          }),
          closeConnection,
        ),
        options.signal,
        closeConnection,
      );
    } catch (error) {
      if (error instanceof BleOperationAbortedError) throw error;
      throw new GanV4BleError('connection-failed', 'GAN 智能魔方连接失败', { cause: error });
    }
    active = true;
    connectionStateListener = (result): void => {
      if (result.deviceId === connectedDeviceId && !result.connected) {
        reportUnexpectedDisconnect('GAN 智能魔方连接已断开');
      }
    };
    api.onBLEConnectionStateChange?.(connectionStateListener);

    const services = await raceBleAbort(invokeBleForLease<{ services: BleService[] }>(lease, (callbacks) => api.getBLEDeviceServices({
      ...callbacks,
      deviceId: discovery.device.deviceId,
    })), options.signal);
    const protocol = GAN_PROTOCOLS.find((candidate) => services.services.some((serviceCandidate) =>
      normalizeBleUuid(serviceCandidate.uuid) === candidate.serviceUuid));
    const service = protocol
      ? services.services.find((candidate) =>
        normalizeBleUuid(candidate.uuid) === protocol.serviceUuid)
      : undefined;
    if (!service) throw new GanV4BleError('gatt-unavailable', 'GAN 通信服务不可用');
    if (!protocol) throw new GanV4BleError('gatt-unavailable', 'GAN 协议不可识别');
    serviceId = service.uuid;

    const characteristics = await raceBleAbort(invokeBleForLease<{ characteristics: BleCharacteristic[] }>(lease, (callbacks) => api.getBLEDeviceCharacteristics({
      ...callbacks,
      deviceId: discovery.device.deviceId,
      serviceId: service.uuid,
    })), options.signal);
    const writeCharacteristic = characteristics.characteristics.find((candidate) =>
      normalizeBleUuid(candidate.uuid) === protocol.writeCharacteristicUuid
      && Boolean(candidate.properties?.write || candidate.properties?.writeNoResponse));
    const notifyCharacteristic = characteristics.characteristics.find((candidate) =>
      normalizeBleUuid(candidate.uuid) === protocol.notifyCharacteristicUuid
      && Boolean(candidate.properties?.notify || candidate.properties?.indicate));
    if (!writeCharacteristic || !notifyCharacteristic) {
      throw new GanV4BleError('gatt-unavailable', 'GAN 通信特征不可用');
    }
    writeCharacteristicId = writeCharacteristic.uuid;
    notifyCharacteristicId = notifyCharacteristic.uuid;

    const cipher = protocol.family === 'v4'
      ? createGanV4Cipher(discovery.mac)
      : protocol.family === 'v3'
        ? createGanV3Cipher(discovery.mac)
        : createGanV2Cipher(discovery.mac, deviceName);
    const sendCommand = (command: Uint8Array): Promise<void> => {
      return writeQueue.enqueue(() => {
        if (closing || !connectedDeviceId || !serviceId || !writeCharacteristicId) {
          throw new GanV4BleError('connection-failed', 'GAN 智能魔方连接已断开');
        }
        const encrypted = cipher.encrypt(command);
        return invokeBleForLease(lease, (callbacks) => api.writeBLECharacteristicValue({
          ...callbacks,
          characteristicId: writeCharacteristicId as string,
          deviceId: connectedDeviceId as string,
          serviceId: serviceId as string,
          value: new Uint8Array(encrypted).buffer,
        })).then(() => undefined);
      }, options.signal);
    };

    const publishState = (facelets: string): void => safeBleCallback(
      options.onState ? () => options.onState?.(facelets) : undefined,
    );
    const publishMove = (move: string, deviceTs?: number): void => safeBleCallback(
      options.onMove ? () => options.onMove?.(move, deviceTs) : undefined,
    );
    const publishGyro = (
      quaternion: { w: number; x: number; y: number; z: number },
      velocity?: { x: number; y: number; z: number },
    ): void => safeBleCallback(options.onGyro
      ? () => options.onGyro?.(quaternion, velocity ?? { x: 0, y: 0, z: 0 })
      : undefined);

    let badFrameCount = (): number => 0;
    let recordDecodeFailure = (): void => {};
    let readProtocolBattery = (): number | null => null;
    let decodeNotification: (frame: Uint8Array) => void;
    let batteryCommand: () => Uint8Array;
    let initialCommands: readonly Uint8Array[];

    if (protocol.family === 'v4') {
      const decodeState = createGanV4DecodeState({
        requestHistory: (startMoveCounter, numberOfMoves) => {
          void sendCommand(createGanV4HistoryCommand(startMoveCounter, numberOfMoves)).catch(() => {});
        },
        onWedged: () => {
          void sendCommand(createGanV4FaceletsCommand()).catch(() => {});
        },
        onState: publishState,
      });
      decodeNotification = (frame): void => {
        for (const move of decodeGanV4Frame(frame, decodeState, publishGyro)) {
          publishMove(move.mv, move.ts);
        }
      };
      badFrameCount = () => decodeState.badFrames;
      recordDecodeFailure = () => { decodeState.badFrames++; };
      readProtocolBattery = () => decodeState.battery;
      batteryCommand = createGanV4BatteryCommand;
      initialCommands = [
        createGanV4HardwareInfoCommand(),
        createGanV4FaceletsCommand(),
        createGanV4BatteryCommand(),
      ];
    } else if (protocol.family === 'v3') {
      const idleStateChecks = new Set<ReturnType<typeof setTimeout>>();
      const clearIdleStateChecks = (): void => {
        for (const timer of idleStateChecks) clearTimeout(timer);
        idleStateChecks.clear();
      };
      const scheduleIdleStateChecks = (): void => {
        clearIdleStateChecks();
        for (const delay of GAN_V3_IDLE_STATE_CHECK_MS) {
          const timer = setTimeout(() => {
            idleStateChecks.delete(timer);
            if (!closing) void sendCommand(createGanV3FaceletsCommand()).catch(() => {});
          }, delay);
          idleStateChecks.add(timer);
        }
      };
      let decodeState!: ReturnType<typeof createGanV3DecodeState>;
      decodeState = createGanV3DecodeState({
        requestHistory: (startMoveCounter, numberOfMoves) => {
          void sendCommand(createGanV3HistoryCommand(startMoveCounter, numberOfMoves)).catch(() => {});
        },
        onWedged: () => {
          decodeState.sync.reset();
          void sendCommand(createGanV3FaceletsCommand()).catch(() => {});
        },
        onState: publishState,
      });
      decodeNotification = (frame): void => {
        const moves = decodeGanV3Frame(frame, decodeState);
        for (const move of moves) publishMove(move.mv, move.ts);
        if (moves.length > 0) scheduleIdleStateChecks();
      };
      badFrameCount = () => decodeState.badFrames;
      recordDecodeFailure = () => { decodeState.badFrames++; };
      readProtocolBattery = () => decodeState.battery;
      batteryCommand = createGanV3BatteryCommand;
      initialCommands = [
        createGanV3HardwareInfoCommand(),
        createGanV3FaceletsCommand(),
        createGanV3BatteryCommand(),
      ];
      protocolCleanup = clearIdleStateChecks;
    } else {
      const decodeState = createGanV2DecodeState();
      decodeNotification = (frame): void => {
        for (const move of decodeGanV2Frame(frame, decodeState, publishGyro)) publishMove(move);
      };
      badFrameCount = () => decodeState.badFrames;
      recordDecodeFailure = () => { decodeState.badFrames++; };
      readProtocolBattery = () => decodeState.battery;
      batteryCommand = createGanV2BatteryCommand;
      initialCommands = [
        createGanV2HardwareInfoCommand(),
        createGanV2FaceletsCommand(),
        createGanV2BatteryCommand(),
      ];
    }

    notificationListener = (result): void => {
      if (!active
        || result.deviceId !== connectedDeviceId
        || normalizeBleUuid(result.serviceId) !== normalizeBleUuid(serviceId as string)
        || normalizeBleUuid(result.characteristicId) !== normalizeBleUuid(notifyCharacteristicId as string)) {
        return;
      }
      try {
        const decoded = cipher.decrypt(new Uint8Array(result.value));
        decodeNotification(decoded);
        const protocolBattery = readProtocolBattery();
        if (protocolBattery !== null && protocolBattery !== lastBattery) {
          lastBattery = protocolBattery;
          safeBleCallback(options.onBattery ? () => options.onBattery?.(lastBattery as number) : undefined);
          for (const resolve of batteryWaiters) resolve(lastBattery);
          batteryWaiters.clear();
        }
      } catch {
        recordDecodeFailure();
      }
      if (badFrameCount() >= 5) {
        reportUnexpectedDisconnect('GAN 通信数据连续异常，请重新连接');
      }
    };
    api.onBLECharacteristicValueChange(notificationListener);
    await raceBleAbort(invokeBleForLease(lease, (callbacks) => api.notifyBLECharacteristicValueChange({
      ...callbacks,
      characteristicId: notifyCharacteristic.uuid,
      deviceId: discovery.device.deviceId,
      serviceId: service.uuid,
      state: true,
    })), options.signal);
    notificationsEnabled = true;
    for (const command of initialCommands) await sendCommand(command);

    return {
      deviceId: discovery.device.deviceId,
      deviceName,
      disconnect,
      async requestBattery(): Promise<number | null> {
        let finish: (level: number | null) => void = () => {};
        const response = new Promise<number | null>((resolve) => {
          let finished = false;
          finish = (level): void => {
            if (finished) return;
            finished = true;
            batteryWaiters.delete(finish);
            resolve(level);
          };
          batteryWaiters.add(finish);
          setTimeout(() => finish(lastBattery), 1_500);
        });
        try {
          await sendCommand(batteryCommand());
        } catch (error) {
          finish(lastBattery);
          throw error;
        }
        return response;
      },
    };
  } catch (error) {
    await disconnect();
    throw error;
  }
}
