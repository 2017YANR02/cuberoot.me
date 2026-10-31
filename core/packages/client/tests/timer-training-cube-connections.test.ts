// @vitest-environment jsdom
import { act, createElement, StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BluetoothCubeHandle } from '@/lib/bluetooth';

const rig = vi.hoisted(() => ({ picker: vi.fn(), disconnect: vi.fn(), live: new Map<string, (move: string) => void>() }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('@/lib/bluetooth', () => ({
  pickerOptions: () => ({}),
  requestBluetoothDevice: rig.picker,
  useBluetoothCube: (options: { onMove?(move: string, timestamp: number, facelets: string): void }) => {
    const [status, setStatus] = useState({ connected: false, deviceId: undefined as string | undefined, deviceName: '', brand: 'gan-v4' as const, hasGyro: false, battery: 80 });
    const callbacks = useRef(options); callbacks.current = options;
    const connectDevice = useCallback(async (device: BluetoothDevice) => {
      setStatus(previous => ({ ...previous, connected: true, deviceId: device.id, deviceName: device.name! }));
    }, []);
    useEffect(() => {
      if (!status.deviceId) return;
      const id = status.deviceId;
      rig.live.set(id, move => callbacks.current.onMove?.(move, 100, 'facelets'));
      return () => { rig.live.delete(id); };
    }, [status.deviceId]);
    const disconnect = useCallback(() => {
      rig.disconnect(status.deviceId);
      setStatus(previous => ({ ...previous, connected: false, deviceId: undefined, deviceName: '' }));
    }, [status.deviceId]);
    return { status, connectDevice, disconnect, facelets: null, lastMove: null,
      solved: true, advertisementDiagnostic: null } as unknown as BluetoothCubeHandle;
  },
}));

import { useTrainingCubes } from '@/app/[lang]/timer/_shared/useTrainingCubes';

let root: Root;
let host: HTMLDivElement;
let pool: ReturnType<typeof useTrainingCubes>;
let renders = 0;
let moves: string[] = [];
function Host() {
  if (++renders > 80) throw new Error('connection reporting caused a render loop');
  pool = useTrainingCubes(id => ({ onMove: move => moves.push(`${id}:${move}`) }));
  return createElement('div', null, pool.connections);
}
const device = (id: string) => ({ id, name: `GAN ${id}` }) as BluetoothDevice;
beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); rig.live.clear(); renders = 0; moves = [];
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(StrictMode, null, createElement(Host))));
  await act(async () => pool.first.connectDevice(device('A')));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('adds a third connection while retaining both previous subscriptions and their identities', async () => {
  rig.picker.mockResolvedValueOnce(device('B')).mockResolvedValueOnce(device('C'));
  await act(async () => pool.connectNext());
  await act(async () => pool.connectNext());
  expect(pool.handles.filter(({ cube }) => cube.status.connected).map(({ cube }) => cube.status.deviceId)).toEqual(['A', 'B', 'C']);
  rig.live.get('C')!('F'); rig.live.get('A')!('R'); rig.live.get('B')!('U');
  expect(moves).toEqual(['cube-3:F', 'cube-1:R', 'cube-2:U']);
  expect(rig.disconnect).not.toHaveBeenCalled();
  await act(async () => root.render(createElement(StrictMode, null, createElement(Host))));
  expect(rig.live.size).toBe(3);
});

it('rejects a duplicate device before it can replace or disconnect the first connection', async () => {
  rig.picker.mockResolvedValueOnce(device('A'));
  await act(async () => { await expect(pool.connectNext()).rejects.toThrow('already in the connection list'); });
  expect(pool.first.status.deviceId).toBe('A');
  expect(rig.live.size).toBe(1);
  expect(rig.disconnect).not.toHaveBeenCalled();
});

it('ignores a chooser result after closing the connection panel', async () => {
  let resolve!: (value: BluetoothDevice) => void;
  rig.picker.mockReturnValueOnce(new Promise<BluetoothDevice>(done => { resolve = done; }));
  let pending!: Promise<void>;
  await act(async () => { pending = pool.connectNext(); });
  await act(async () => pool.cancelConnect());
  await act(async () => { resolve(device('B')); await pending; });
  expect(pool.handles.filter(({ cube }) => cube.status.connected).map(({ cube }) => cube.status.deviceId)).toEqual(['A']);
});

it('serializes repeated add clicks and releases all extra subscriptions on mode exit', async () => {
  rig.picker.mockResolvedValueOnce(device('B'));
  await act(async () => { await Promise.all([pool.connectNext(), pool.connectNext()]); });
  expect(rig.picker).toHaveBeenCalledTimes(1);
  await act(async () => pool.disconnectExtras());
  expect(rig.disconnect.mock.calls.some(([id]) => id === 'A')).toBe(false);
  expect(rig.live.has('B')).toBe(false);
});

it('keeps the disconnected cube’s identity and appends the next cube after it', async () => {
  rig.picker.mockResolvedValueOnce(device('B')).mockResolvedValueOnce(device('C'));
  await act(async () => pool.connectNext());
  await act(async () => pool.handles.find(({ deviceId }) => deviceId === 'B')!.cube.disconnect());
  await act(async () => pool.connectNext());
  expect(pool.handles.filter(({ deviceId }) => deviceId).map(({ id, deviceId, deviceName, cube }) =>
    [id, deviceId, deviceName, cube.status.connected])).toEqual([
    ['cube-1', 'A', 'GAN A', true], ['cube-2', 'B', 'GAN B', false], ['cube-3', 'C', 'GAN C', true],
  ]);
});
