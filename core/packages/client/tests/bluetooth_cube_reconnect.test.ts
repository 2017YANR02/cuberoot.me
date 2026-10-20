// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  grantedCubeForPreconnect,
  useBluetoothCube,
  type BluetoothConnectionEvent,
  type BluetoothCubeHandle,
} from '@/app/[lang]/timer/_lib/bluetooth';
import { ganV4Driver } from '@/app/[lang]/timer/_lib/bluetooth/gan_v4';
import { gocubeDriver } from '@/app/[lang]/timer/_lib/bluetooth/gocube';
import { moyu32Driver } from '@/app/[lang]/timer/_lib/bluetooth/moyu32';
import { qiyiDriver } from '@/app/[lang]/timer/_lib/bluetooth/qiyi';
import type { CubeDriverContext } from '@/app/[lang]/timer/_lib/bluetooth/driver';
import { clearMac, savedMac, saveMac } from '@/app/[lang]/timer/_lib/bluetooth/mac';
import { applyMoves, solved, toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import { parseScramble } from '@/app/[lang]/timer/_lib/cube/moves';
import { makeFakeGatt } from './_fake_gatt';
import {
  createGanV4Cipher, GAN_V4_SERVICE_UUID, GAN_V4_NOTIFY_CHARACTERISTIC_UUID,
  GAN_V4_WRITE_CHARACTERISTIC_UUID,
} from '@cuberoot/shared/smart-cube/gan-v4';

import { createMoyu32Cipher, MOYU32_SERVICE_UUID, MOYU32_NOTIFY_CHARACTERISTIC_UUID, MOYU32_WRITE_CHARACTERISTIC_UUID } from '@cuberoot/shared/smart-cube/moyu32';

// Exercise the real encrypted address probe before the mocked timer driver starts.
function attachMoyuProbe(rig: FakeGattRig, suppliedMac?: Uint8Array) {
  const gatt = makeFakeGatt(rig.device.name!, {
    [MOYU32_SERVICE_UUID]: [MOYU32_NOTIFY_CHARACTERISTIC_UUID, MOYU32_WRITE_CHARACTERISTIC_UUID],
  });
  vi.mocked(rig.server.getPrimaryService).mockImplementation(uuid => gatt.asServer.getPrimaryService(uuid));
  if (suppliedMac) {
    const cipher = createMoyu32Cipher(suppliedMac);
    const state = new Uint8Array(20);
    state[0] = 0xa3;
    for (let face = 0; face < 6; face++) for (let sticker = 0; sticker < 8; sticker++) {
      for (let bit = 0; bit < 3; bit++) {
        const offset = 8 + face * 24 + sticker * 3 + bit;
        state[offset >> 3] |= ((face >> (2 - bit)) & 1) << (7 - (offset & 7));
      }
    }
    vi.spyOn(gatt.char(MOYU32_SERVICE_UUID, MOYU32_WRITE_CHARACTERISTIC_UUID), 'writeValue')
      .mockImplementation(async value => {
        const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        if (cipher.decrypt(bytes)[0] === 0xa3) {
          gatt.char(MOYU32_SERVICE_UUID, MOYU32_NOTIFY_CHARACTERISTIC_UUID).emit(cipher.encrypt(state));
        }
      });
  }
}

const SCRAMBLED = toFaceletString(applyMoves(solved(3), 3, parseScramble('R U')));

describe('GAN v4 battery notifications', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function rig() {
    const gatt = makeFakeGatt('GAN14', {
      [GAN_V4_SERVICE_UUID]: [GAN_V4_NOTIFY_CHARACTERISTIC_UUID, GAN_V4_WRITE_CHARACTERISTIC_UUID],
    });
    const onBattery = vi.fn();
    const session = await ganV4Driver.start(gatt.asServer, vi.fn(), { onBattery });
    const cipher = createGanV4Cipher(new Uint8Array(6));
    return {
      gatt, session, onBattery,
      batteryRequests: () => gatt.writes.filter(w => cipher.decrypt(Uint8Array.from(w.bytes))[3] === 0xef),
      emit(level: number) {
        const frame = new Uint8Array(20);
        frame.set([0xef, 1, level]);
        gatt.char(GAN_V4_SERVICE_UUID, GAN_V4_NOTIFY_CHARACTERISTIC_UUID).emit(cipher.encrypt(frame));
      },
    };
  }

  it('publishes delayed valid replies including zero and cancels the retry', async () => {
    const r = await rig();
    await expect(r.session.battery()).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(300);
    r.emit(101);
    expect(r.onBattery).not.toHaveBeenCalled();
    r.emit(73);
    expect(r.onBattery).toHaveBeenLastCalledWith(73);
    r.emit(0);
    expect(r.onBattery).toHaveBeenLastCalledWith(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(r.batteryRequests()).toHaveLength(1);
    await expect(r.session.battery()).resolves.toBe(0);
    r.session.cleanup();
    r.emit(50);
    expect(r.onBattery).toHaveBeenCalledTimes(2);
  });

  it('retries once after one second and still accepts a late reply', async () => {
    const r = await rig();
    await vi.advanceTimersByTimeAsync(999);
    expect(r.batteryRequests()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(r.batteryRequests()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(r.batteryRequests()).toHaveLength(2);
    r.emit(64);
    expect(r.onBattery).toHaveBeenLastCalledWith(64);
    r.session.cleanup();
  });

  it('cancels pending battery work on cleanup', async () => {
    const r = await rig();
    r.session.cleanup();
    await vi.advanceTimersByTimeAsync(2000);
    expect(r.batteryRequests()).toHaveLength(1);
    r.emit(64);
    expect(r.onBattery).not.toHaveBeenCalled();
  });
});

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
  let onNeedMac: ((name: string) => Promise<string | null>) | undefined;

  function Harness() {
    cube = useBluetoothCube({ onConnectionEvent: (event) => events.push(event), onNeedMac });
    return null;
  }

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    events = [];
    onNeedMac = undefined;
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

  it('keeps battery notifications through handshake, delayed reads and reconnects', async () => {
    const rig = fakeGattRig('battery');
    const contexts: CubeDriverContext[] = [];
    const read = deferred<number | null>();
    vi.spyOn(gocubeDriver, 'start').mockImplementation(async (_server, _move, ctx) => {
      contexts.push(ctx!);
      ctx?.onBattery?.(80);
      return { battery: () => read.promise, cleanup: vi.fn() };
    });
    await act(async () => { await cube.connectDevice(rig.device); });
    expect(cube.status.battery).toBe(80);
    await act(async () => { contexts[0].onBattery?.(79); read.resolve(null); });
    expect(cube.status.battery).toBe(79);
    await act(async () => rig.drop());
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(contexts).toHaveLength(2);
    await act(async () => { contexts[1].onBattery?.(78); contexts[0].onBattery?.(10); });
    expect(cube.status.battery).toBe(78);
    await act(async () => { cube.disconnect(); contexts[1].onBattery?.(9); });
    expect(cube.status.battery).toBeNull();
  });

  it('does not report a solve when device calibration confirms solved facelets', async () => {
    const rig = fakeGattRig('calibrate');
    const onSolved = vi.fn();
    let current!: BluetoothCubeHandle;
    function CalibrationHarness() { current = useBluetoothCube({ onSolved }); return null; }
    await act(async () => root.render(createElement(CalibrationHarness)));
    vi.spyOn(gocubeDriver, 'start').mockImplementation(async (_server, _move, ctx) => {
      ctx?.onState?.(SCRAMBLED);
      return { battery: async () => null, cleanup: vi.fn(), resetDeviceState: async () => {
        ctx?.onState?.('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
      } };
    });
    await act(async () => { await current.connectDevice(rig.device); });
    expect(current.solved).toBe(false);
    await act(async () => { await current.resetDeviceState!(); });
    expect(current.solved).toBe(true);
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('preserves a real turn received immediately after device reset confirmation', async () => {
    const rig = fakeGattRig('calibrate-turn');
    const onSolved = vi.fn();
    let current!: BluetoothCubeHandle;
    function CalibrationHarness() { current = useBluetoothCube({ onSolved }); return null; }
    await act(async () => root.render(createElement(CalibrationHarness)));
    vi.spyOn(gocubeDriver, 'start').mockImplementation(async (_server, onMove, ctx) => {
      ctx?.onState?.(SCRAMBLED);
      return { battery: async () => null, cleanup: vi.fn(), resetDeviceState: async () => {
        ctx?.onState?.('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
        onMove('R', 1000);
      } };
    });
    await act(async () => { await current.connectDevice(rig.device); });
    await act(async () => { await current.resetDeviceState!(); });
    expect(current.solved).toBe(false);
    expect(current.facelets).toBe(toFaceletString(applyMoves(solved(3), 3, parseScramble('R'))));
    expect(onSolved).not.toHaveBeenCalled();
  });

  it.each([false, true])('detects QiYi gyro per connection, including samples during start (%s)', async (duringStart) => {
    const rig = fakeGattRig('qiyi-gyro');
    Object.defineProperty(rig.device, 'name', { value: 'XMD-TornadoV4-i-1-A1B2' });
    saveMac(rig.device.name, 'CC:A3:00:00:A1:B2');
    vi.mocked(rig.server.getPrimaryServices).mockResolvedValue([{ uuid: qiyiDriver.service } as BluetoothRemoteGATTService]);
    const contexts: CubeDriverContext[] = [];
    let emitDuringStart = duringStart;
    vi.spyOn(qiyiDriver, 'start').mockImplementation(async (_server, _move, ctx) => {
      contexts.push(ctx!);
      if (emitDuringStart) ctx?.onGyro?.({ w: 1, x: 0, y: 0, z: 0 });
      return { battery: async () => 80, cleanup: vi.fn() };
    });
    await act(async () => { await cube.connectDevice(rig.device); });
    expect(cube.status.hasGyro).toBe(duringStart);
    // The harness has no rendering callback; capability detection still works.
    expect(contexts[0].onGyro).toBeTypeOf('function');
    await act(async () => contexts[0].onGyro?.({ w: 1, x: 0, y: 0, z: 0 }));
    expect(cube.status.hasGyro).toBe(true);
    await act(async () => cube.disconnect());
    expect(cube.status.hasGyro).toBe(false);
    emitDuringStart = false;
    await act(async () => { await cube.connectDevice(rig.device); });
    expect(cube.status.hasGyro).toBe(false);
    await act(async () => contexts[0].onGyro?.({ w: 1, x: 0, y: 0, z: 0 }));
    expect(cube.status.hasGyro).toBe(false);
    clearMac(rig.device.name);
  });

  it.each(['WCU_MY32_A1B2', 'WCU_MY32_AABBCCDDEEFF'])('asks for MY32 MAC once and reuses the validated address: %s', async (name) => {
    const rig = fakeGattRig(name);
    Object.defineProperty(rig.device, 'name', { value: name });
    clearMac(rig.device.id);
    attachMoyuProbe(rig, Uint8Array.of(0x11, 0x22, 0x33, 0x44, 0x55, 0x66));
    vi.mocked(rig.server.getPrimaryServices).mockResolvedValue([{ uuid: moyu32Driver.service } as BluetoothRemoteGATTService]);
    const input = deferred<string | null>();
    onNeedMac = vi.fn(() => input.promise);
    await act(async () => root.render(createElement(Harness)));
    const start = vi.spyOn(moyu32Driver, 'start').mockImplementation(async (_server, _move, ctx) => {
      ctx?.onState?.(SCRAMBLED);
      return { battery: async () => 80, cleanup: vi.fn() };
    });
    let connection!: Promise<void>;
    await act(async () => {
      connection = cube.connectDevice(rig.device);
      // MY32 now prompts directly; it does not probe guessed addresses.
      await vi.advanceTimersByTimeAsync(0);
      expect(onNeedMac).toHaveBeenCalledWith(name);
    });
    expect(rig.device.watchAdvertisements).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(savedMac(rig.device.id)).toBeNull();
    await act(async () => { input.resolve('11:22:33:44:55:66'); await connection; });
    expect(start.mock.calls[0][2]?.mac).toBe('11:22:33:44:55:66');
    expect(savedMac(name)).toBe('11:22:33:44:55:66');
    await act(async () => cube.disconnect());
    await act(async () => { await cube.connectDevice(rig.device); });
    expect(onNeedMac).toHaveBeenCalledOnce();
    expect(start.mock.calls[1][2]?.mac).toBe('11:22:33:44:55:66');
    expect(rig.device.watchAdvertisements).not.toHaveBeenCalled();
    clearMac(rig.device.id);
  });

  it('cancels MY32 connection without saving a MAC or starting its driver', async () => {
    const rig = fakeGattRig('my32-cancel');
    Object.defineProperty(rig.device, 'name', { value: 'WCU_MY32_1234' });
    clearMac(rig.device.id);
    attachMoyuProbe(rig);
    vi.mocked(rig.server.getPrimaryServices).mockResolvedValue([{ uuid: moyu32Driver.service } as BluetoothRemoteGATTService]);
    onNeedMac = vi.fn(async () => null);
    await act(async () => root.render(createElement(Harness)));
    const start = vi.spyOn(moyu32Driver, 'start');
    let failure: unknown;
    await act(async () => {
      const connection = cube.connectDevice(rig.device).catch(error => { failure = error; });
      await vi.advanceTimersByTimeAsync(0);
      await connection;
    });
    // Dismissing the prompt is a clean cancellation, not a connection error.
    expect(failure).toBeUndefined();
    expect(onNeedMac).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(rig.device.watchAdvertisements).not.toHaveBeenCalled();
    expect(cube.status.connected).toBe(false);
    expect(savedMac(rig.device.id)).toBeNull();
    expect(rig.disconnect).toHaveBeenCalled();
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

  it('preconnects exactly one previously authorised supported cube without a chooser', async () => {
    const rig = fakeGattRig('granted');
    const getDevices = vi.fn(async () => [rig.device]);
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: { getDevices },
    });
    const start = vi.spyOn(gocubeDriver, 'start').mockResolvedValue({
      battery: async () => null,
      cleanup: vi.fn(),
    });

    let connected = false;
    await act(async () => { connected = await cube.preconnectGrantedDevice(); });

    expect(connected).toBe(true);
    expect(getDevices).toHaveBeenCalledTimes(1);
    expect(rig.connect).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(cube.status.connected).toBe(true);
  });

  it('does not guess when more than one supported cube was authorised', async () => {
    const first = fakeGattRig('first');
    const second = fakeGattRig('second');
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: { getDevices: vi.fn(async () => [first.device, second.device]) },
    });

    let connected = true;
    await act(async () => { connected = await cube.preconnectGrantedDevice(); });

    expect(connected).toBe(false);
    expect(first.connect).not.toHaveBeenCalled();
    expect(second.connect).not.toHaveBeenCalled();
  });

  it('requires a reusable MAC before preconnecting a GAN cube', () => {
    const device = { name: 'GAN16ui_PRECONNECT_TEST' } as BluetoothDevice;
    clearMac(device.name);
    expect(grantedCubeForPreconnect([device])).toBeNull();

    saveMac(device.name, '11:22:33:44:55:66');
    expect(grantedCubeForPreconnect([device])).toBe(device);
    clearMac(device.name);
  });

  it('retries one transient code-19 handshake without reopening the picker', async () => {
    const rig = fakeGattRig('transient');
    const transient = {
      name: 'NetworkError',
      message: 'GATT Server is disconnected. Cannot retrieve services.',
      code: 19,
    };
    const start = vi.spyOn(gocubeDriver, 'start')
      .mockImplementationOnce(async () => {
        rig.drop();
        throw transient;
      })
      .mockResolvedValueOnce({ battery: async () => null, cleanup: vi.fn() });

    await act(async () => { await cube.connectDevice(rig.device); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(rig.connect).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(2);
    expect(cube.status.connected).toBe(true);
  });

  it('persists a GAN MAC after a valid initial state, before the first move', async () => {
    const rig = fakeGattRig('gan-state');
    Object.defineProperty(rig.device, 'name', {
      configurable: true,
      value: 'GAN16ui_STATE_SAVE_TEST',
    });
    (rig.server.getPrimaryServices as ReturnType<typeof vi.fn>).mockResolvedValue([
      { uuid: ganV4Driver.service } as BluetoothRemoteGATTService,
    ]);
    saveMac(rig.device.name, '11:22:33:44:55:66');
    const start = vi.spyOn(ganV4Driver, 'start').mockImplementation(async (_server, _onMove, ctx) => {
      clearMac(rig.device.name);
      ctx?.onState?.(SCRAMBLED);
      return { battery: async () => null, cleanup: vi.fn() };
    });

    await act(async () => { await cube.connectDevice(rig.device); });

    expect(start).toHaveBeenCalledTimes(1);
    expect(savedMac(rig.device.name)).toBe('11:22:33:44:55:66');
    clearMac(rig.device.name);
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
