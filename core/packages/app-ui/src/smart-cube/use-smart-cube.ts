import { GAN_V4_SERVICE_UUID } from '@cuberoot/shared/smart-cube/gan-v4';
import { SmartCubeStateTracker } from '@cuberoot/shared/smart-cube/cubie';
import { MoveClock } from '@cuberoot/shared/smart-cube/move-clock';
import type { GyroQuaternion } from '@cuberoot/shared/smart-cube/gan-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { InstalledAppSmartCube, InstalledAppSmartCubeOptions } from '../platform';
import { GanV4CubeConnection, type GanV4CubeStatus } from './gan-v4-cube';
import type { BleTransport } from './transport';

export function useInstalledSmartCube(
  createTransport: () => BleTransport,
  { language, onMove, onSolved, onGyro }: InstalledAppSmartCubeOptions,
): InstalledAppSmartCube {
  const transportRef = useRef<BleTransport | null>(null);
  if (!transportRef.current) transportRef.current = createTransport();
  const connectionRef = useRef<GanV4CubeConnection | null>(null);
  const trackerRef = useRef(new SmartCubeStateTracker());
  const moveClockRef = useRef(new MoveClock());
  const wasSolvedRef = useRef(true);
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
  const [lastMove, setLastMove] = useState('');
  const [facelets, setFacelets] = useState('');
  const [quaternion, setQuaternion] = useState<GyroQuaternion | null>(null);
  const [status, setStatus] = useState<GanV4CubeStatus | null>(null);
  const [solved, setSolved] = useState(true);

  const publishSolved = useCallback((nextSolved: boolean, timestamp: number) => {
    const becameSolved = nextSolved && !wasSolvedRef.current;
    // Commit the edge before invoking a host that may synchronously reset/disconnect.
    wasSolvedRef.current = nextSolved;
    setSolved(nextSolved);
    if (becameSolved) onSolvedRef.current?.(timestamp);
  }, []);

  const resetCubeState = useCallback(() => {
    setLastMove('');
    setFacelets('');
    trackerRef.current.reset();
    moveClockRef.current.reset();
    wasSolvedRef.current = true;
    setSolved(true);
    setQuaternion(null);
    setStatus(null);
  }, []);

  const disposeConnection = useCallback((connection: GanV4CubeConnection | null) => {
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
      const device = await transport.requestDevice({
        captureManufacturerData: true,
        namePrefix: 'GAN',
        optionalServices: [GAN_V4_SERVICE_UUID],
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
      const connection = new GanV4CubeConnection(transport, {
        onDisconnect: () => {
          if (connectionRef.current !== connection) return;
          connectionRef.current = null;
          setDeviceName('');
          resetCubeState();
          setPhase('idle');
        },
        onMove: (move, deviceTimestamp) => {
          if (connectionRef.current !== connection) return;
          const timestamp = moveClockRef.current.stamp(deviceTimestamp, performance.now());
          const solved = trackerRef.current.applyMove(move);
          const nextFacelets = trackerRef.current.getFacelets();
          setLastMove(move);
          setFacelets(nextFacelets);
          onMoveRef.current(move, timestamp, nextFacelets);
          publishSolved(solved, timestamp);
        },
        onProtocolError: () => {
          if (connectionRef.current !== connection) return;
          connectionRef.current = null;
          void disposeConnection(connection);
          setDeviceName('');
          resetCubeState();
          setPhase('error');
        },
        onState: (nextFacelets) => {
          if (connectionRef.current !== connection) return;
          if (!trackerRef.current.adoptFacelets(nextFacelets)) return;
          setFacelets(nextFacelets);
          publishSolved(trackerRef.current.isSolved(), performance.now());
        },
        onGyro: (nextQuaternion, velocity) => {
          if (connectionRef.current !== connection) return;
          setQuaternion(nextQuaternion);
          onGyroRef.current?.(nextQuaternion, performance.now(), velocity);
        },
        onStatus: (nextStatus) => {
          if (connectionRef.current === connection) setStatus(nextStatus);
        },
      });
      connectionRef.current = connection;
      await connection.connect(device);
      if (connectionRef.current !== connection) throw new Error('smart cube connection closed');
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
  }, [disconnect, disposeConnection, language, publishSolved, resetCubeState]);

  const resetState = useCallback(() => {
    trackerRef.current.reset();
    wasSolvedRef.current = true;
    setSolved(true);
    setFacelets(trackerRef.current.getFacelets());
  }, []);

  const requestState = useCallback(async () => {
    if (!connectionRef.current) throw new Error('smart cube is not connected');
    await connectionRef.current.requestState();
  }, []);

  useEffect(() => () => {
    generationRef.current++;
    busyRef.current = false;
    void disposeConnection(connectionRef.current);
    connectionRef.current = null;
  }, [disposeConnection]);

  return { connect, deviceName, disconnect, facelets, lastMove, phase, quaternion, requestState, resetState, solved, status };
}
