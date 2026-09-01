import { GAN_V4_SERVICE_UUID } from '@cuberoot/shared/smart-cube/gan-v4';
import { SmartCubeStateTracker } from '@cuberoot/shared/smart-cube/cubie';
import { MoveClock } from '@cuberoot/shared/smart-cube/move-clock';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { InstalledAppSmartCube, InstalledAppSmartCubeOptions } from '../platform';
import { GanV4CubeConnection } from './gan-v4-cube';
import type { BleTransport } from './transport';

export function useInstalledSmartCube(
  createTransport: () => BleTransport,
  { language, onMove, onSolved }: InstalledAppSmartCubeOptions,
): InstalledAppSmartCube {
  const transportRef = useRef<BleTransport | null>(null);
  if (!transportRef.current) transportRef.current = createTransport();
  const connectionRef = useRef<GanV4CubeConnection | null>(null);
  const trackerRef = useRef(new SmartCubeStateTracker());
  const moveClockRef = useRef(new MoveClock());
  const wasSolvedRef = useRef(true);
  const onMoveRef = useRef(onMove);
  const onSolvedRef = useRef(onSolved);
  onMoveRef.current = onMove;
  onSolvedRef.current = onSolved;
  const [phase, setPhase] = useState<InstalledAppSmartCube['phase']>('idle');
  const [deviceName, setDeviceName] = useState('');
  const [lastMove, setLastMove] = useState('');
  const [facelets, setFacelets] = useState('');

  const resetCubeState = useCallback(() => {
    setLastMove('');
    setFacelets('');
    trackerRef.current.reset();
    moveClockRef.current.reset();
    wasSolvedRef.current = true;
  }, []);

  const disconnect = useCallback(async () => {
    const connection = connectionRef.current;
    connectionRef.current = null;
    await connection?.disconnect();
    setPhase('idle');
    setDeviceName('');
    resetCubeState();
  }, [resetCubeState]);

  const connect = useCallback(async (): Promise<string> => {
    if (phase === 'requesting' || phase === 'connecting') throw new Error('connection already in progress');
    await disconnect();
    const transport = transportRef.current!;
    try {
      setPhase('requesting');
      await transport.initialize();
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
          if (solved && !wasSolvedRef.current) onSolvedRef.current?.(timestamp);
          wasSolvedRef.current = solved;
        },
        onProtocolError: () => {
          if (connectionRef.current !== connection) return;
          connectionRef.current = null;
          void connection.disconnect();
          setDeviceName('');
          resetCubeState();
          setPhase('error');
        },
        onState: (nextFacelets) => {
          if (connectionRef.current !== connection) return;
          if (!trackerRef.current.adoptFacelets(nextFacelets)) return;
          setFacelets(nextFacelets);
          wasSolvedRef.current = trackerRef.current.isSolved();
        },
      });
      connectionRef.current = connection;
      await connection.connect(device);
      if (connectionRef.current !== connection) throw new Error('smart cube connection closed');
      setPhase('connected');
      return device.name;
    } catch (error) {
      await disconnect();
      setPhase('error');
      throw error;
    }
  }, [disconnect, language, phase, resetCubeState]);

  useEffect(() => () => {
    void connectionRef.current?.disconnect();
    connectionRef.current = null;
  }, []);

  return { connect, deviceName, disconnect, facelets, lastMove, phase };
}
