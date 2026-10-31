import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  pickerOptions, requestBluetoothDevice, useBluetoothCube,
  type BluetoothCubeHandle,
} from '@/lib/bluetooth';
import { tr } from '@/i18n/tr';

type CubeOptions = NonNullable<Parameters<typeof useBluetoothCube>[0]>;
export const FIRST_TRAINING_CUBE = 'cube-1';

function CubeConnection({ id, options, report }: {
  id: string;
  options: CubeOptions;
  report(id: string, handle: BluetoothCubeHandle | null): void;
}) {
  const handle = useBluetoothCube(options);
  const latest = useRef(handle);
  latest.current = handle;
  // The transport returns a fresh facade on every render. Notify the parent
  // only for actual transport changes, never for the facade's object identity.
  useLayoutEffect(() => {
    report(id, latest.current);
  }, [id, report, handle.status, handle.facelets, handle.lastMove, handle.lastMoveMetadata,
    handle.solved, handle.hijacked, handle.advertisementDiagnostic]);
  useLayoutEffect(() => () => report(id, null), [id, report]);
  return null;
}

/** Existing single-cube transport per slot; no fixed limit or dynamic hook calls. */
export function useTrainingCubes(optionsFor: (id: string) => CubeOptions) {
  const first = useBluetoothCube(optionsFor(FIRST_TRAINING_CUBE));
  const [extraIds, setExtraIds] = useState(['cube-2']);
  const nextSlotRef = useRef(3);
  const [extras, setExtras] = useState<Record<string, BluetoothCubeHandle>>({});
  const handlesRef = useRef(new Map<string, BluetoothCubeHandle>());
  const knownDevicesRef = useRef(new Map<string, { deviceId: string; deviceName: string }>());
  handlesRef.current.set(FIRST_TRAINING_CUBE, first);
  if (first.status.deviceId) knownDevicesRef.current.set(FIRST_TRAINING_CUBE,
    { deviceId: first.status.deviceId, deviceName: first.status.deviceName });
  const connectingRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const [connecting, setConnecting] = useState(false);
  const report = useCallback((id: string, handle: BluetoothCubeHandle | null) => {
    if (handle?.status.deviceId) knownDevicesRef.current.set(id,
      { deviceId: handle.status.deviceId, deviceName: handle.status.deviceName });
    if (!handle) knownDevicesRef.current.delete(id);
    if (handle) handlesRef.current.set(id, handle);
    else handlesRef.current.delete(id);
    setExtras(previous => {
      if (previous[id] === handle || (!handle && !previous[id])) return previous;
      const next = { ...previous };
      if (handle) next[id] = handle;
      else delete next[id];
      return next;
    });
  }, []);
  const connectSlot = useCallback(async (id: string) => {
    if (connectingRef.current) return;
    const handle = handlesRef.current.get(id);
    if (!handle) return;
    const generation = ++generationRef.current;
    connectingRef.current = id;
    setConnecting(true);
    try {
      const device = await requestBluetoothDevice(nameOnly => pickerOptions(false, nameOnly));
      if (!device || generation !== generationRef.current) return;
      if ([...knownDevicesRef.current].some(([otherId, cube]) => otherId !== id && cube.deviceId === device.id)) {
        throw new Error(tr({ zh: '这颗智能魔方已在连接列表中', en: 'This smart cube is already in the connection list' }));
      }
      await handle.connectDevice(device);
      if (generation !== generationRef.current) { handle.disconnect(); return; }
      const spareId = `cube-${nextSlotRef.current++}`;
      setExtraIds(previous => previous.at(-1) === id ? [...previous, spareId] : previous);
    } finally {
      if (generation === generationRef.current) {
        connectingRef.current = null;
        setConnecting(false);
      }
    }
  }, []);
  const connectNext = useCallback(async () => {
    // The spare component is mounted before the click, preserving the chooser gesture.
    const slot = [...handlesRef.current].find(([id, cube]) => id !== FIRST_TRAINING_CUBE
      && !cube.status.connected && !knownDevicesRef.current.has(id));
    if (slot) await connectSlot(slot[0]);
  }, [connectSlot]);
  const cancelConnect = useCallback(() => {
    generationRef.current++;
    if (connectingRef.current) handlesRef.current.get(connectingRef.current)?.disconnect();
    connectingRef.current = null;
    setConnecting(false);
  }, []);
  const disconnectExtras = useCallback(() => {
    cancelConnect();
    for (const [id, handle] of handlesRef.current) if (id !== FIRST_TRAINING_CUBE) handle.disconnect();
    setExtraIds([`cube-${nextSlotRef.current++}`]);
  }, [cancelConnect]);
  const handles = [{ id: FIRST_TRAINING_CUBE, cube: first }, ...extraIds.flatMap(id => extras[id]
    ? [{ id, cube: extras[id] }] : [])].map(entry => ({
      ...entry,
      deviceId: entry.cube.status.deviceId ?? knownDevicesRef.current.get(entry.id)?.deviceId,
      deviceName: entry.cube.status.deviceName || knownDevicesRef.current.get(entry.id)?.deviceName || '',
    }));
  return {
    first, handles, handlesRef, connecting, connectNext, connectSlot, cancelConnect, disconnectExtras,
    connections: extraIds.map(id => <CubeConnection key={id} id={id} options={optionsFor(id)} report={report} />),
  };
}
