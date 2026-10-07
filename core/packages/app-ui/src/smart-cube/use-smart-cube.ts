import { matchesGiikerName, GIIKER_DATA_SERVICE_UUID, GIIKER_RW_SERVICE_UUID } from '@cuberoot/shared/smart-cube/giiker';
import { matchesGoCubeName, GOCUBE_SERVICE_UUID } from '@cuberoot/shared/smart-cube/gocube';
import { matchesMoyuName, MOYU_SERVICE_UUID } from '@cuberoot/shared/smart-cube/moyu';
import { LegacyCubeConnection, type LegacyCubeStatus } from './legacy-cube';
import { GAN_V2_SERVICE_UUID, matchesGanV2Name } from '@cuberoot/shared/smart-cube/gan-v2';
import { GAN_V3_SERVICE_UUID, matchesGanV3Name } from '@cuberoot/shared/smart-cube/gan-v3';
import { GAN_V4_SERVICE_UUID, matchesGanV4Name } from '@cuberoot/shared/smart-cube/gan-v4';
import { matchesMoyu32Name, MOYU32_SERVICE_UUID } from '@cuberoot/shared/smart-cube/moyu32';
import { matchesQiyiName, QIYI_SERVICE_UUID } from '@cuberoot/shared/smart-cube/qiyi';
import { normalizeMac } from '@cuberoot/shared/timer/external/mac';
import { SmartCubeSessionController } from '@cuberoot/shared/smart-cube/session';
import type { TimerDeviceConnectionEvent } from '@cuberoot/shared/timer/device-contract';
import type { GyroQuaternion, GyroVelocity } from '@cuberoot/shared/smart-cube/gan-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  InstalledAppSmartCube,
  InstalledAppSmartCubeOptions,
  InstalledSmartCubeMoveMetadata,
} from '../platform';
import { GanCubeConnection, type GanCubeStatus } from './gan-cube';
import { GanV4CubeConnection, type GanV4CubeStatus } from './gan-v4-cube';
import { Moyu32CubeConnection, type Moyu32CubeStatus } from './moyu32-cube';
import { QiyiCubeConnection, type QiyiCubeStatus } from './qiyi-cube';
import type { BleDeviceRef, BleRequestOptions, BleTransport } from './transport';

type InstalledCubeModel = 'gan-v2' | 'gan-v3' | 'gan-v4' | 'moyu32' | 'qiyi' | 'giiker' | 'gocube' | 'moyu';

const DISCOVERABLE_CUBE_SERVICES = [
  GAN_V2_SERVICE_UUID,
  GAN_V3_SERVICE_UUID,
  GAN_V4_SERVICE_UUID,
  MOYU32_SERVICE_UUID,
  QIYI_SERVICE_UUID,
  GIIKER_DATA_SERVICE_UUID, GIIKER_RW_SERVICE_UUID, GOCUBE_SERVICE_UUID, MOYU_SERVICE_UUID,
] as const;

const SMART_CUBE_NAME_PREFIXES = [
  'GAN', 'MG', 'AiCube', 'Gi',
  'WCU_MY3', 'QY-QYSC', 'XMD-TornadoV4-i',
  'Mi Smart Magic Cube', 'Hi-', 'GoCube', 'Rubik', 'MHC', 'MoYu', 'MY-',
] as const;
const SMART_CUBE_SCAN_TIMEOUT_MS = 8_000;

function requestOptions(
  language: InstalledAppSmartCubeOptions['language'],
  supportsServiceDiscovery: boolean,
): BleRequestOptions {
  return {
    captureManufacturerData: true,
    namePrefix: 'GAN',
    ...(supportsServiceDiscovery ? {
      namePrefixes: [...SMART_CUBE_NAME_PREFIXES],
      services: [...DISCOVERABLE_CUBE_SERVICES],
    } : {}),
    optionalServices: supportsServiceDiscovery
      ? [...DISCOVERABLE_CUBE_SERVICES]
      : [GAN_V4_SERVICE_UUID],
    pickerLabels: language === 'zh' ? {
      scanning: '正在扫描智能魔方…',
      cancel: '取消',
      availableDevices: '可用设备',
      noDeviceFound: '没有发现设备',
    } : {
      scanning: 'Scanning for a smart cube…',
      cancel: 'Cancel',
      availableDevices: 'Available devices',
      noDeviceFound: 'No device found',
    },
  };
}

function modelForDeviceName(name: string): InstalledCubeModel | null {
  if (matchesMoyu32Name(name)) return 'moyu32';
  if (matchesQiyiName(name)) return 'qiyi';
  if (matchesGanV4Name(name)) return 'gan-v4';
  if (matchesGanV3Name(name)) return 'gan-v3';
  if (matchesGanV2Name(name)) return 'gan-v2';
  if (matchesGiikerName(name)) return 'giiker';
  if (matchesGoCubeName(name)) return 'gocube';
  if (matchesMoyuName(name)) return 'moyu';
  return null;
}

export function useInstalledSmartCube(
  createTransport: () => BleTransport,
  { language, onMove, onSolved, onGyro, onConnectionEvent }: InstalledAppSmartCubeOptions,
): InstalledAppSmartCube {
  const transportRef = useRef<BleTransport | null>(null);
  if (!transportRef.current) transportRef.current = createTransport();
  type SmartCubeConnection =
    | GanV4CubeConnection
    | GanCubeConnection
    | Moyu32CubeConnection
    | QiyiCubeConnection
    | LegacyCubeConnection;
  const connectionRef = useRef<SmartCubeConnection | null>(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const calibratingRef = useRef(false);
  const cleanupRef = useRef<Promise<void>>(Promise.resolve());
  const scannedDevicesRef = useRef(new Map<string, BleDeviceRef>());
  const scanGenerationRef = useRef(0);
  const scanStopRef = useRef<(() => Promise<void>) | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanStartupRef = useRef<Promise<void>>(Promise.resolve());
  const scanCleanupRef = useRef<Promise<void>>(Promise.resolve());
  const onMoveRef = useRef(onMove);
  const onSolvedRef = useRef(onSolved);
  const onGyroRef = useRef(onGyro);
  const onConnectionEventRef = useRef(onConnectionEvent);
  onMoveRef.current = onMove;
  onSolvedRef.current = onSolved;
  onGyroRef.current = onGyro;
  onConnectionEventRef.current = onConnectionEvent;
  const [macPrompt, setMacPrompt] = useState<InstalledAppSmartCube['macPrompt']>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelMacRef = useRef<(() => void) | null>(null);
  const cancelReadyRef = useRef<(() => void) | null>(null);
  const knownMacsRef = useRef(new Map<string, string>());
  const [phase, setPhase] = useState<InstalledAppSmartCube['phase']>('idle');
  const [availableDevices, setAvailableDevices] = useState<readonly BleDeviceRef[]>([]);
  const [scanning, setScanning] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [model, setModel] = useState<InstalledCubeModel | null>(null);
  const [lastMove, setLastMove] = useState('');
  const [facelets, setFacelets] = useState('');
  const [quaternion, setQuaternion] = useState<GyroQuaternion | null>(null);
  const [status, setStatus] = useState<
    GanV4CubeStatus | GanCubeStatus | Moyu32CubeStatus | QiyiCubeStatus | LegacyCubeStatus | null
  >(null);
  const [solved, setSolved] = useState(true);

  const sessionControllerRef = useRef<SmartCubeSessionController<InstalledSmartCubeMoveMetadata> | null>(null);
  if (!sessionControllerRef.current) {
    sessionControllerRef.current = new SmartCubeSessionController({
      now: () => performance.now(),
      onChange: (snapshot) => {
        setLastMove(snapshot.lastMove ?? '');
        setFacelets(snapshot.facelets ?? '');
        setSolved(snapshot.solved);
      },
      onMove: ({ facelets: nextFacelets, metadata, move, timestamp }) => {
        if (calibratingRef.current) return;
        if (metadata) onMoveRef.current(move, timestamp, nextFacelets, metadata);
        else onMoveRef.current(move, timestamp, nextFacelets);
      },
      onSolved: (timestamp) => {
        if (!calibratingRef.current && timestamp !== undefined) onSolvedRef.current?.(timestamp);
      },
    });
  }
  const sessionController = sessionControllerRef.current;

  const resetCubeState = useCallback(() => {
    sessionController.close();
    setQuaternion(null);
    setStatus(null);
    setModel(null);
  }, [sessionController]);

  const disposeConnection = useCallback((connection: SmartCubeConnection | null) => {
    // Invalidate this connection immediately, but retain its asynchronous native
    // cleanup even after connectionRef is cleared. GATT disconnect is device-wide:
    // a new connection must not race an older stopNotifications/disconnect pair.
    const cleanup = Promise.all([cleanupRef.current, connection?.disconnect()])
      .then(() => undefined);
    cleanupRef.current = cleanup;
    return cleanup;
  }, []);

  const stopScan = useCallback(async () => {
    scanGenerationRef.current++;
    if (scanTimerRef.current !== null) {
      globalThis.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    const stop = scanStopRef.current;
    scanStopRef.current = null;
    setScanning(false);
    const cleanup = Promise.all([scanCleanupRef.current, scanStartupRef.current, stop?.().catch(() => undefined)])
      .then(() => undefined);
    scanCleanupRef.current = cleanup;
    await cleanup;
  }, []);

  const disconnect = useCallback(async () => {
    generationRef.current++;
    calibratingRef.current = false;
    cancelMacRef.current?.();
    cancelMacRef.current = null;
    cancelReadyRef.current?.();
    cancelReadyRef.current = null;
    setMacPrompt(null);
    busyRef.current = false;
    const connection = connectionRef.current;
    connectionRef.current = null;
    setPhase('idle');
    setDeviceName('');
    resetCubeState();
    await Promise.all([stopScan(), disposeConnection(connection)]);
  }, [disposeConnection, resetCubeState, stopScan]);

  const scanDevices = useCallback(async () => {
    const transport = transportRef.current!;
    if (!transport.scanDevices || connectionRef.current || busyRef.current) return;
    const cleanup = stopScan();
    const generation = scanGenerationRef.current;
    const current = () => scanGenerationRef.current === generation;
    await cleanup;
    if (!current()) return;
    scannedDevicesRef.current = new Map();
    setAvailableDevices([]);
    setScanning(true);
    setPhase((value) => value === 'error' ? 'idle' : value);
    const startup = (async () => {
      try {
        await transport.initialize();
        if (!current()) return;
        const stop = await transport.scanDevices!(
          requestOptions(language, Boolean(transport.getServices)),
          (devices) => {
            if (!current()) return;
            scannedDevicesRef.current = new Map(devices.map((device) => [device.id, device]));
            setAvailableDevices(devices);
          },
        );
        if (!current()) {
          await stop().catch(() => undefined);
          return;
        }
        scanStopRef.current = stop;
        scanTimerRef.current = globalThis.setTimeout(() => {
          if (!current()) return;
          const finish = scanStopRef.current;
          scanStopRef.current = null;
          scanTimerRef.current = null;
          setScanning(false);
          scanCleanupRef.current = Promise.all([scanCleanupRef.current, finish?.().catch(() => undefined)])
            .then(() => undefined);
        }, SMART_CUBE_SCAN_TIMEOUT_MS);
      } catch (error) {
        if (current()) {
          setScanning(false);
          setPhase('error');
        }
        throw error;
      }
    })();
    scanStartupRef.current = startup.catch(() => undefined);
    await startup;
  }, [language, stopScan]);

  const connect = useCallback(async (deviceId?: string): Promise<string> => {
    if (busyRef.current) throw new Error('connection already in progress');
    const scannedDevice = deviceId ? scannedDevicesRef.current.get(deviceId) : undefined;
    if (deviceId && !scannedDevice) throw new Error('smart cube is no longer available');
    const cleanup = disconnect();
    busyRef.current = true;
    const generation = ++generationRef.current;
    const current = () => generationRef.current === generation;
    const transport = transportRef.current!;
    try {
      await cleanup;
      if (!current()) throw new Error('smart cube connection closed');
      setError(null);
      setPhase('requesting');
      await transport.initialize();
      if (!current()) throw new Error('smart cube connection closed');
      const supportsServiceDiscovery = Boolean(transport.getServices);
      let device = scannedDevice
        ?? await transport.requestDevice(requestOptions(language, supportsServiceDiscovery));
      if (!current()) throw new Error('smart cube connection closed');
      setPhase('connecting');
      setDeviceName(device.name);
      const namedModel = modelForDeviceName(device.name);
      setModel(namedModel);
      if (namedModel === 'moyu32' || namedModel?.startsWith('gan-')) {
        const macAddress = await transport.getDeviceMac?.(device.id);
        if (!current()) throw new Error('smart cube connection closed');
        if (macAddress) device = { ...device, macAddress };
      }
      // Old MoYu is a turn-only protocol; its software baseline starts solved, like Web.
      const session = sessionController.open({ publishInitialState: namedModel === 'moyu' });
      let connection!: SmartCubeConnection;
      let resolveReady!: () => void;
      let rejectReady!: (error: Error) => void;
      const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
      // State may fail while native setup is still pending. Observe immediately.
      void ready.catch(() => undefined);
      const cancelReady = () => rejectReady(new Error('smart cube connection closed'));
      cancelReadyRef.current = cancelReady;
      let suppliedMac: string | null = null;
      const connectionCallbacks = {
        onNeedMac: async (deviceName: string): Promise<string | null> => {
          if (!current()) throw new Error('smart cube connection closed');
          const cached = knownMacsRef.current.get(device.id);
          if (cached) { suppliedMac = cached; return cached; }
          const mac = await new Promise<string | null>((resolve) => {
            const finish = (value: string | null) => {
              if (cancelMacRef.current !== cancel) return;
              cancelMacRef.current = null;
              setMacPrompt(null);
              resolve(value);
            };
            const cancel = () => finish(null);
            cancelMacRef.current = cancel;
            setMacPrompt({ deviceName, onSubmit: (value) => finish(normalizeMac(value)), onCancel: () => { void disconnect(); } });
          });
          if (!current()) throw new Error('smart cube connection closed');
          suppliedMac = mac;
          return mac;
        },
        onDisconnect: () => {
          if (connectionRef.current !== connection || !session.isCurrent()) return;
          cancelReady();
          onConnectionEventRef.current?.({ kind: 'disconnected', reason: 'gatt-lost' });
          void disposeConnection(connection);
          connectionRef.current = null;
          setDeviceName('');
          resetCubeState();
          setPhase('idle');
        },
        onMove: (
          move: string,
          deviceTimestamp?: number,
          metadata?: InstalledSmartCubeMoveMetadata,
        ) => {
          if (connectionRef.current !== connection || !session.isCurrent()) return;
          session.move(move, deviceTimestamp, metadata);
        },
        onProtocolError: () => {
          if (connectionRef.current !== connection || !session.isCurrent()) return;
          rejectReady(new Error('Cube protocol error; check the MAC address'));
          const event: TimerDeviceConnectionEvent = {
            kind: 'error',
            error: { code: 'protocol-error', retryable: true },
          };
          onConnectionEventRef.current?.(event);
          connectionRef.current = null;
          void disposeConnection(connection);
          setDeviceName('');
          resetCubeState();
          setPhase('error');
        },
        onState: (nextFacelets: string) => {
          if (connectionRef.current !== connection || !session.isCurrent()) return;
          if (session.adoptFacelets(nextFacelets, performance.now())) resolveReady();
        },
        onGyro: onGyroRef.current
          ? (nextQuaternion: GyroQuaternion, velocity?: GyroVelocity) => {
            if (connectionRef.current !== connection || !session.isCurrent()) return;
            setQuaternion(nextQuaternion);
            onGyroRef.current?.(nextQuaternion, performance.now(), velocity);
          }
          : undefined,
        onStatus: (
          nextStatus: GanV4CubeStatus | GanCubeStatus | Moyu32CubeStatus | QiyiCubeStatus | LegacyCubeStatus,
        ) => {
          if (connectionRef.current !== connection || !session.isCurrent()) return;
          setStatus(nextStatus);
          setModel(nextStatus.protocol);
        },
      };
      if (namedModel === 'giiker' || namedModel === 'gocube' || namedModel === 'moyu') {
        connection = new LegacyCubeConnection(transport, connectionCallbacks, namedModel);
      } else if (namedModel === 'moyu32') {
        connection = new Moyu32CubeConnection(transport, connectionCallbacks);
      } else if (namedModel === 'qiyi') {
        connection = new QiyiCubeConnection(transport, connectionCallbacks);
      } else if (supportsServiceDiscovery) {
        connection = new GanCubeConnection(transport, connectionCallbacks);
      } else {
        connection = new GanV4CubeConnection(transport, connectionCallbacks);
      }
      connectionRef.current = connection;
      try {
        await connection.connect(device);
        if (namedModel === 'moyu') resolveReady();
        if (!current()) throw new Error('smart cube connection closed');
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([ready, new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => reject(new Error('Cube did not return a valid state; check the MAC address')), 8_000);
          })]);
        } finally {
          if (timeout !== undefined) clearTimeout(timeout);
        }
      } catch (error) {
        if (suppliedMac) knownMacsRef.current.delete(device.id);
        throw error;
      } finally {
        if (cancelReadyRef.current === cancelReady) cancelReadyRef.current = null;
      }
      if (suppliedMac) knownMacsRef.current.set(device.id, suppliedMac);
      if (connectionRef.current !== connection) throw new Error('smart cube connection closed');
      if (connection instanceof GanCubeConnection) {
        setModel(connection.getProtocol() ?? namedModel);
      }
      scannedDevicesRef.current = new Map();
      setAvailableDevices([]);
      setPhase('connected');
      return device.name;
    } catch (error) {
      if (current()) {
        onConnectionEventRef.current?.({
          kind: 'error',
          error: {
            code: 'connection-failed',
            message: error instanceof Error ? error.message : String(error),
            retryable: true,
          },
        });
        const cleanup = disconnect();
        const cleanupGeneration = generationRef.current;
        await cleanup;
        // Disconnect permits retry immediately. Its asynchronous transport
        // cleanup must not mark a newer connection (or unmounted host) failed.
        if (generationRef.current === cleanupGeneration) {
          const detail = error instanceof Error ? error.message : String(error);
          const explanations: Record<string, { en: string; zh: string }> = {
            'Cube MAC address required': { en: 'Enter the cube’s real Bluetooth MAC address to connect.', zh: '连接需要这颗魔方的真实蓝牙 MAC 地址。' },
            'Cube did not return a valid state; check the MAC address': { en: 'No valid cube state received. Check the MAC address and reconnect.', zh: '未收到有效魔方状态，请核对 MAC 地址后重新连接。' },
            'Cube protocol error; check the MAC address': { en: 'Cube data could not be decoded. Check the MAC address and reconnect.', zh: '无法解码魔方数据，请核对 MAC 地址后重新连接。' },
          };
          setError(explanations[detail]?.[language] ?? detail);
          setPhase('error');
        }
      }
      throw error;
    } finally {
      if (current()) busyRef.current = false;
    }
  }, [disconnect, disposeConnection, language, resetCubeState, sessionController]);

  const resetState = useCallback(() => {
    sessionController.resetState();
  }, [sessionController]);

  const resetDeviceState = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection || !('resetDeviceState' in connection)) throw new Error('Device calibration unavailable');
    if (calibratingRef.current) throw new Error('Device calibration already in progress');
    const generation = generationRef.current;
    calibratingRef.current = true;
    sessionController.resetState();
    try {
      await connection.resetDeviceState();
      if (generation !== generationRef.current) throw new Error('Cube connection changed');
      sessionController.resetClock();
      sessionController.republish();
    } finally {
      if (generation === generationRef.current) calibratingRef.current = false;
    }
  }, [sessionController]);

  const requestState = useCallback(async () => {
    if (!connectionRef.current) throw new Error('smart cube is not connected');
    await connectionRef.current.requestState();
  }, []);

  useEffect(() => () => {
    generationRef.current++;
    cancelMacRef.current?.();
    cancelReadyRef.current?.();
    scanGenerationRef.current++;
    busyRef.current = false;
    if (scanTimerRef.current !== null) globalThis.clearTimeout(scanTimerRef.current);
    void scanStopRef.current?.().catch(() => undefined);
    scanStopRef.current = null;
    sessionController.dispose();
    void disposeConnection(connectionRef.current);
    connectionRef.current = null;
  }, [disposeConnection, sessionController]);

  const supportsDeviceScan = Boolean(transportRef.current?.scanDevices);
  return {
    connect, deviceName, disconnect, error, facelets, lastMove, macPrompt, model, phase, quaternion,
    requestState, resetState, solved, status,
    ...(phase === 'connected' && model !== 'giiker' && model !== 'gocube' && model !== 'moyu' ? { resetDeviceState } : {}),
    ...(supportsDeviceScan ? {
      availableDevices: availableDevices.map(({ id, name, rssi }) => ({ id, name, rssi })),
      scanDevices,
      scanning,
      stopScan,
    } : {}),
  };
}
