// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useBluetoothCube,
  type BluetoothConnectionEvent,
  type BluetoothCubeHandle,
} from '@/app/[lang]/timer/_lib/bluetooth';
import { ganV4Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v4';
import { gocubeDriver } from '@/app/[lang]/timer/_lib/bluetooth/gocube';
import { applyMoves, solved, toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import { parseScramble } from '@/app/[lang]/timer/_lib/cube/moves';

const SCRAMBLED = toFaceletString(applyMoves(solved(3), 3, parseScramble('R U')));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

interface FakeGattRig {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  drop: () => void;
  reconnectThrough: (gate: Deferred<void>) => void;
}

function fakeGattRig(id: string): FakeGattRig {
  let connected = false;
  const target = new EventTarget();
  let server!: BluetoothRemoteGATTServer;
  const connect = vi.fn(async () => {
    connected = true;
    return server;
  });
  const disconnect = vi.fn(() => { connected = false; });
  const device = Object.assign(target, {
    id,
    name: `GoCube ${id}`,
    watchAdvertisements: vi.fn(async () => {}),
  }) as BluetoothDevice;
  server = {
    device,
    get connected() { return connected; },
    connect,
    disconnect,
    getPrimaryService: vi.fn(),
    getPrimaryServices: vi.fn(async () => [{ uuid: gocubeDriver.service } as BluetoothRemoteGATTService]),
  } as BluetoothRemoteGATTServer;
  Object.defineProperty(device, 'gatt', { configurable: true, value: server });

  return {
    device,
    server,
    connect,
    disconnect,
    drop: () => {
      connected = false;
      target.dispatchEvent(new Event('gattserverdisconnected'));
    },
    reconnectThrough: (gate) => {
      connect.mockImplementationOnce(async () => {
        await gate.promise;
        connected = true;
        return server;
      });
    },
  };
}

describe('smart-cube reconnect ownership', () => {
  let host: HTMLDivElement;
  let root: Root;
  let cube: BluetoothCubeHandle;
  let events: BluetoothConnectionEvent[];

  function Harness() {
    cube = useBluetoothCube({ onConnectionEvent: (event) => events.push(event) });
    return null;
  }

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    events = [];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(createElement(Harness)));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: undefined,
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('discards an awaited reconnect after manual disconnect', async () => {
    const rig = fakeGattRig('old');
    const reconnectGate = deferred<void>();
    const cleanup = vi.fn();
    const start = vi.spyOn(gocubeDriver, 'start').mockResolvedValue({
      battery: async () => null,
      cleanup,
    });

    await act(async () => { await cube.connectDevice(rig.device); });
    rig.reconnectThrough(reconnectGate);
    await act(async () => rig.drop());
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    await act(async () => cube.disconnect());
    await act(async () => {
      reconnectGate.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(rig.disconnect).toHaveBeenCalledTimes(1);
    expect(cube.status.connected).toBe(false);
    expect(events.some((event) => event.kind === 'reconnected')).toBe(false);
  });

  it('does not let an initial handshake finish after manual disconnect', async () => {
    const rig = fakeGattRig('initial');
    const startGate = deferred<{
      battery: () => Promise<null>;
      cleanup: () => void;
    }>();
    const cleanup = vi.fn();
    const start = vi.spyOn(gocubeDriver, 'start').mockImplementationOnce(() => startGate.promise);
    let connectPromise!: Promise<void>;

    await act(async () => {
      connectPromise = cube.connectDevice(rig.device);
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
    expect(start).toHaveBeenCalledTimes(1);

    await act(async () => cube.disconnect());
    await act(async () => {
      startGate.resolve({ battery: async () => null, cleanup });
      await connectPromise;
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(cube.status.connected).toBe(false);
  });

  it('cannot overwrite a newly selected device when an old reconnect resolves', async () => {
    const oldRig = fakeGattRig('old');
    const newRig = fakeGattRig('new');
    const reconnectGate = deferred<void>();
    const start = vi.spyOn(gocubeDriver, 'start').mockResolvedValue({
      battery: async () => null,
      cleanup: vi.fn(),
    });

    await act(async () => { await cube.connectDevice(oldRig.device); });
    oldRig.reconnectThrough(reconnectGate);
    await act(async () => oldRig.drop());
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    await act(async () => { await cube.connectDevice(newRig.device); });

    await act(async () => {
      reconnectGate.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(start).toHaveBeenCalledTimes(2);
    expect(oldRig.disconnect).toHaveBeenCalledTimes(1);
    expect(cube.status.connected).toBe(true);
    expect(cube.status.deviceId).toBe('new');
    expect(events.some((event) => event.kind === 'reconnected')).toBe(false);
  });

  it('discards an awaited reconnect after unmount', async () => {
    const rig = fakeGattRig('unmount');
    const reconnectGate = deferred<void>();
    const start = vi.spyOn(gocubeDriver, 'start').mockResolvedValue({
      battery: async () => null,
      cleanup: vi.fn(),
    });

    await act(async () => { await cube.connectDevice(rig.device); });
    rig.reconnectThrough(reconnectGate);
    await act(async () => rig.drop());
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    await act(async () => root.unmount());
    rig.disconnect.mockClear();

    await act(async () => {
      reconnectGate.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(rig.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not connect a cube selected after the pending picker was unmounted', async () => {
    const rig = fakeGattRig('picker-unmount');
    const picked = deferred<BluetoothDevice>();
    const requestDevice = vi.fn(() => picked.promise);
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: { requestDevice },
    });

    let connection!: Promise<void>;
    await act(async () => {
      connection = cube.connect();
      await vi.waitFor(() => expect(requestDevice).toHaveBeenCalledOnce());
    });
    await act(async () => root.unmount());
    await act(async () => {
      picked.resolve(rig.device);
      await connection;
    });

    expect(rig.connect).not.toHaveBeenCalled();
  });

  it('reads a fresh GAN16 advertisement before GATT and reuses its verified MAC', async () => {
    const target = new EventTarget();
    const order: string[] = [];
    let connected = false;
    let server!: BluetoothRemoteGATTServer;
    const connect = vi.fn(async () => {
      order.push('connect');
      connected = true;
      return server;
    });
    const device = Object.assign(target, {
      id: 'gan16',
      name: 'GAN16ui_C296',
      watchAdvertisements: vi.fn(async () => {
        order.push('watch');
        const payload = new Uint8Array([0, 0, 0, 0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa]);
        const event = Object.assign(new Event('advertisementreceived'), {
          manufacturerData: new Map([[0x0001, new DataView(payload.buffer)]]),
        });
        queueMicrotask(() => target.dispatchEvent(event));
      }),
    }) as BluetoothDevice;
    server = {
      device,
      get connected() { return connected; },
      connect,
      disconnect: vi.fn(() => { connected = false; }),
      getPrimaryService: vi.fn(),
      getPrimaryServices: vi.fn(async () => [
        { uuid: ganV4Driver.service } as BluetoothRemoteGATTService,
      ]),
    } as BluetoothRemoteGATTServer;
    Object.defineProperty(device, 'gatt', { configurable: true, value: server });

    let handshakeMac: string | null | undefined;
    vi.spyOn(ganV4Driver, 'start').mockImplementation(async (_server, onMove, ctx) => {
      handshakeMac = ctx?.mac;
      onMove('R', performance.now());
      return { battery: async () => null, cleanup: vi.fn() };
    });

    await act(async () => { await cube.connectDevice(device); });

    expect(order).toEqual(['watch', 'connect']);
    expect(handshakeMac).toBe('AA:BB:CC:DD:EE:FF');
    expect(cube.status.connected).toBe(true);
    expect(cube.status.brand).toBe('gan-v4');
    expect(cube.advertisementDiagnostic).toMatchObject({
      phase: 'connected',
      eventNumber: 1,
      complete: true,
      advertisementMs: expect.any(Number),
      gattMs: expect.any(Number),
      discoveryMs: expect.any(Number),
      handshakeMs: expect.any(Number),
      totalElapsedMs: expect.any(Number),
    });

    await act(async () => cube.disconnect());
    order.length = 0;
    await act(async () => { await cube.connectDevice(device); });

    expect(device.watchAdvertisements).toHaveBeenCalledOnce();
    expect(order).toEqual(['connect']);
    expect(handshakeMac).toBe('AA:BB:CC:DD:EE:FF');
    expect(cube.advertisementDiagnostic).toBeNull();
  });

  it('disconnects the reconnect server when the driver handshake fails', async () => {
    const rig = fakeGattRig('failure');
    const cleanup = vi.fn();
    const start = vi.spyOn(gocubeDriver, 'start')
      .mockResolvedValueOnce({ battery: async () => null, cleanup })
      .mockRejectedValueOnce(new Error('notification setup failed'));
    const removeListener = vi.spyOn(rig.device, 'removeEventListener');

    await act(async () => { await cube.connectDevice(rig.device); });
    await act(async () => rig.drop());
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(start).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith('gattserverdisconnected', expect.any(Function));
    expect(rig.disconnect).toHaveBeenCalledTimes(1);
    expect(cube.status.connected).toBe(false);
  });

  it('keeps authoritative state published during initial and reconnect handshakes', async () => {
    const rig = fakeGattRig('state');
    vi.spyOn(gocubeDriver, 'start').mockImplementation(async (_server, _onMove, ctx) => {
      ctx?.onState?.(SCRAMBLED);
      return { battery: async () => null, cleanup: vi.fn() };
    });

    await act(async () => { await cube.connectDevice(rig.device); });
    expect(cube.facelets).toBe(SCRAMBLED);
    expect(cube.solved).toBe(false);

    await act(async () => rig.drop());
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(cube.facelets).toBe(SCRAMBLED);
    expect(cube.solved).toBe(false);
    expect(events.some((event) => event.kind === 'reconnected')).toBe(true);
  });

  it('rejects legacy GAN v1 services instead of selecting the QiYi driver', async () => {
    const rig = fakeGattRig('legacy-gan');
    vi.mocked(rig.server.getPrimaryServices).mockResolvedValue([
      { uuid: '0000fff0-0000-1000-8000-00805f9b34fb' } as BluetoothRemoteGATTService,
      { uuid: '0000180a-0000-1000-8000-00805f9b34fb' } as BluetoothRemoteGATTService,
    ]);

    await expect(cube.connectDevice(rig.device)).rejects.toMatchObject({
      name: 'BluetoothConnectError',
      stage: 'discover',
    });
    expect(rig.disconnect).toHaveBeenCalledTimes(1);
  });
});
