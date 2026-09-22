import { GAN_V2_SERVICE_UUID, matchesGanV2Name } from '@cuberoot/shared/smart-cube/gan-v2';
import { GAN_V3_SERVICE_UUID, matchesGanV3Name } from '@cuberoot/shared/smart-cube/gan-v3';
import { GAN_V4_SERVICE_UUID, matchesGanV4Name } from '@cuberoot/shared/smart-cube/gan-v4';
import { matchesMoyu32Name, MOYU32_SERVICE_UUID } from '@cuberoot/shared/smart-cube/moyu32';
import { matchesQiyiName, QIYI_SERVICE_UUID } from '@cuberoot/shared/smart-cube/qiyi';
import { SmartCubeSessionController } from '@cuberoot/shared/smart-cube/session';
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
import type { BleTransport } from './transport';

type InstalledCubeModel = 'gan-v2' | 'gan-v3' | 'gan-v4' | 'moyu32' | 'qiyi';

const DISCOVERABLE_CUBE_SERVICES = [
  GAN_V2_SERVICE_UUID,
  GAN_V3_SERVICE_UUID,
  GAN_V4_SERVICE_UUID,
  MOYU32_SERVICE_UUID,
  QIYI_SERVICE_UUID,
] as const;

function modelForDeviceName(name: string): InstalledCubeModel | null {
  if (matchesMoyu32Name(name)) return 'moyu32';
  if (matchesQiyiName(name)) return 'qiyi';
  if (matchesGanV4Name(name)) return 'gan-v4';
  if (matchesGanV3Name(name)) return 'gan-v3';
  if (matchesGanV2Name(name)) return 'gan-v2';
  return null;
}

export function useInstalledSmartCube(
  createTransport: () => BleTransport,
  { language, onMove, onSolved, onGyro }: InstalledAppSmartCubeOptions,
): InstalledAppSmartCube {
  const transportRef = useRef<BleTransport | null>(null);
  if (!transportRef.current) transportRef.current = createTransport();
  type SmartCubeConnection =
    | GanV4CubeConnection
    | GanCubeConnection
    | Moyu32CubeConnection
    | QiyiCubeConnection;
  const connectionRef = useRef<SmartCubeConnection | null>(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const cleanupRef = useRef<Promise<void>>(Promise.resolve());
  const onMoveRef = useRef(onMove);
  const onSolvedRef = useRef(onSolved);
  const onGyroRef = useRef(onGyro);
  onMoveRef.current = onMove;
  onSolvedRef.current = onSolved;
  onGyroRef.current = onGyro;
  const [phase, setPhase] = useState<InstalledAppSmartCube['phase']>('idle');
  const [deviceName, setDeviceName] = useState('');
  const [model, setModel] = useState<InstalledCubeModel | null>(null);
  const [lastMove, setLastMove] = useState('');
  const [facelets, setFacelets] = useState('');
  const [quaternion, setQuaternion] = useState<GyroQuaternion | null>(null);
  const [status, setStatus] = useState<
    GanV4CubeStatus | GanCubeStatus | Moyu32CubeStatus | QiyiCubeStatus | null
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
        if (metadata) onMoveRef.current(move, timestamp, nextFacelets, metadata);
        else onMoveRef.current(move, timestamp, nextFacelets);
      },
      onSolved: (timestamp) => {
        if (timestamp !== undefined) onSolvedRef.current?.(timestamp);
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

  const disconnect = useCallback(async () => {
    generationRef.current++;
    busyRef.current = false;
    const connection = connectionRef.current;
    connectionRef.current = null;
    setPhase('idle');
    setDeviceName('');
    resetCubeState();
    await disposeConnection(connection);
  }, [disposeConnection, resetCubeState]);

  const connect = useCallback(async (): Promise<string> => {
    if (busyRef.current) throw new Error('connection already in progress');
    const cleanup = disconnect();
    busyRef.current = true;
    const generation = ++generationRef.current;
    const current = () => generationRef.current === generation;
    const transport = transportRef.current!;
    try {
      await cleanup;
      if (!current()) throw new Error('smart cube connection closed');
      setPhase('requesting');
      await transport.initialize();
      if (!current()) throw new Error('smart cube connection closed');
      const supportsServiceDiscovery = Boolean(transport.getServices);
      const device = await transport.requestDevice({
        captureManufacturerData: true,
        namePrefix: 'GAN',
        ...(supportsServiceDiscovery ? {
          namePrefixes: ['GAN', 'WCU_MY3', 'QY-QYSC', 'XMD-TornadoV4-i'],
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
      });
      if (!current()) throw new Error('smart cube connection closed');
      setPhase('connecting');
      setDeviceName(device.name);
      const namedModel = modelForDeviceName(device.name);
      setModel(namedModel);
      const session = sessionController.open({ publishInitialState: false });
      let connection!: SmartCubeConnection;
      const connectionCallbacks = {
        onDisconnect: () => {
          if (connectionRef.current !== connection || !session.isCurrent()) return;
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
          connectionRef.current = null;
          void disposeConnection(connection);
          setDeviceName('');
          resetCubeState();
          setPhase('error');
        },
        onState: (nextFacelets: string) => {
          if (connectionRef.current !== connection || !session.isCurrent()) return;
          session.adoptFacelets(nextFacelets, performance.now());
        },
        onGyro: onGyroRef.current
          ? (nextQuaternion: GyroQuaternion, velocity?: GyroVelocity) => {
            if (connectionRef.current !== connection || !session.isCurrent()) return;
            setQuaternion(nextQuaternion);
            onGyroRef.current?.(nextQuaternion, performance.now(), velocity);
          }
          : undefined,
        onStatus: (
          nextStatus: GanV4CubeStatus | GanCubeStatus | Moyu32CubeStatus | QiyiCubeStatus,
        ) => {
          if (connectionRef.current !== connection || !session.isCurrent()) return;
          setStatus(nextStatus);
          setModel(nextStatus.protocol);
        },
      };
      if (namedModel === 'moyu32') {
        connection = new Moyu32CubeConnection(transport, connectionCallbacks);
      } else if (namedModel === 'qiyi') {
        connection = new QiyiCubeConnection(transport, connectionCallbacks);
      } else if (supportsServiceDiscovery) {
        connection = new GanCubeConnection(transport, connectionCallbacks);
      } else {
        connection = new GanV4CubeConnection(transport, connectionCallbacks);
      }
      connectionRef.current = connection;
      await connection.connect(device);
      if (connectionRef.current !== connection) throw new Error('smart cube connection closed');
      if (connection instanceof GanCubeConnection) {
        setModel(connection.getProtocol() ?? namedModel);
      }
      setPhase('connected');
      return device.name;
    } catch (error) {
      if (current()) {
        const cleanup = disconnect();
        const cleanupGeneration = generationRef.current;
        await cleanup;
        // Disconnect permits retry immediately. Its asynchronous transport
        // cleanup must not mark a newer connection (or unmounted host) failed.
        if (generationRef.current === cleanupGeneration) setPhase('error');
      }
      throw error;
    } finally {
      if (current()) busyRef.current = false;
    }
  }, [disconnect, disposeConnection, language, resetCubeState, sessionController]);

  const resetState = useCallback(() => {
    sessionController.resetState();
  }, [sessionController]);

  const requestState = useCallback(async () => {
    if (!connectionRef.current) throw new Error('smart cube is not connected');
    await connectionRef.current.requestState();
  }, []);

  useEffect(() => () => {
    generationRef.current++;
    busyRef.current = false;
    sessionController.dispose();
    void disposeConnection(connectionRef.current);
    connectionRef.current = null;
  }, [disposeConnection, sessionController]);

  return {
    connect, deviceName, disconnect, facelets, lastMove, model, phase, quaternion,
    requestState, resetState, solved, status,
  };
}
