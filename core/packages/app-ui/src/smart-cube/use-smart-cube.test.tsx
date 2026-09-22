// @vitest-environment jsdom

import { SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { GAN_V4_SERVICE_UUID } from '@cuberoot/shared/smart-cube/gan-v4';
import { MOYU32_SERVICE_UUID } from '@cuberoot/shared/smart-cube/moyu32';
import { QIYI_SERVICE_UUID } from '@cuberoot/shared/smart-cube/qiyi';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { InstalledAppSmartCube, InstalledSmartCubeMoveMetadata } from '../platform';
import type { BleTransport } from './transport';
import { useInstalledSmartCube } from './use-smart-cube';

const state = vi.hoisted(() => ({
  onMove: vi.fn(), onSolved: vi.fn(), requestState: vi.fn(),
  connect: vi.fn<() => Promise<void>>(), disconnect: vi.fn<() => Promise<void>>(),
  connectionKind: '' as '' | 'gan-v4' | 'moyu32' | 'qiyi',
  callbacks: null as null | {
    onDisconnect(): void;
    onMove(move: string, timestamp: number, metadata?: InstalledSmartCubeMoveMetadata): void;
    onProtocolError(): void;
    onState(facelets: string): void;
  },
}));

vi.mock('./gan-v4-cube', () => ({
  GanV4CubeConnection: class {
    constructor(_transport: BleTransport, callbacks: NonNullable<typeof state.callbacks>) {
      state.connectionKind = 'gan-v4';
      state.callbacks = callbacks;
    }

    async connect() {
      await state.connect();
      state.callbacks?.onState(SOLVED_3X3);
    }

    async disconnect() { await state.disconnect(); }
    async requestState() { state.requestState(); }
  },
}));

vi.mock('./moyu32-cube', () => ({
  Moyu32CubeConnection: class {
    constructor(_transport: BleTransport, callbacks: NonNullable<typeof state.callbacks>) {
      state.connectionKind = 'moyu32';
      state.callbacks = callbacks;
    }

    async connect() {
      await state.connect();
      state.callbacks?.onState(SOLVED_3X3);
    }

    async disconnect() { await state.disconnect(); }
    async requestState() { state.requestState(); }
  },
}));

vi.mock('./qiyi-cube', () => ({
  QiyiCubeConnection: class {
    constructor(_transport: BleTransport, callbacks: NonNullable<typeof state.callbacks>) {
      state.connectionKind = 'qiyi';
      state.callbacks = callbacks;
    }

    async connect() {
      await state.connect();
      state.callbacks?.onState(SOLVED_3X3);
    }

    async disconnect() { await state.disconnect(); }
    async requestState() { state.requestState(); }
  },
}));

describe('useInstalledSmartCube', () => {
  let container: HTMLDivElement;
  let root: Root;
  let cube: InstalledAppSmartCube;

  const transport: BleTransport = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    getMtu: vi.fn(async () => 517),
    initialize: vi.fn(async () => undefined),
    read: vi.fn(async () => new DataView(new ArrayBuffer(0))),
    requestDevice: vi.fn(async () => ({ id: 'cube', name: 'GAN16ui' })),
    subscribe: vi.fn(async () => vi.fn(async () => undefined)),
    write: vi.fn(async () => undefined),
  };

  function Harness() {
    cube = useInstalledSmartCube(() => transport, { language: 'en', onMove: state.onMove, onSolved: state.onSolved });
    useEffect(() => undefined);
    return <output>{`${cube.phase}:${cube.lastMove}:${cube.facelets}`}</output>;
  }

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    state.callbacks = null;
    state.connectionKind = '';
    delete transport.getServices;
    delete transport.scanDevices;
    vi.clearAllMocks();
    vi.mocked(transport.requestDevice).mockResolvedValue({ id: 'cube', name: 'GAN16ui' });
    state.connect.mockResolvedValue(undefined);
    state.disconnect.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
    await act(async () => { await cube.connect(); });
    await act(async () => state.callbacks?.onMove('R', 1));
    expect(cube.facelets).not.toBe('');
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps hosts without service discovery on the GAN v4 picker', () => {
    expect(state.connectionKind).toBe('gan-v4');
    expect(cube.model).toBe('gan-v4');
    expect(transport.requestDevice).toHaveBeenCalledWith(expect.objectContaining({
      namePrefix: 'GAN',
      optionalServices: [GAN_V4_SERVICE_UUID],
    }));
    const options = vi.mocked(transport.requestDevice).mock.calls[0]?.[0];
    expect(options).not.toHaveProperty('namePrefixes');
    expect(options).not.toHaveProperty('services');
  });

  it('opens the native service picker for MoYu32 and exposes its protocol model', async () => {
    await act(async () => { await cube.disconnect(); });
    transport.getServices = vi.fn(async () => []);
    vi.mocked(transport.requestDevice).mockResolvedValueOnce({
      id: 'CF:30:16:00:A1:B2',
      name: 'WCU_MY32_A1B2',
    });

    await act(async () => { await cube.connect(); });

    expect(state.connectionKind).toBe('moyu32');
    expect(cube.model).toBe('moyu32');
    expect(transport.requestDevice).toHaveBeenLastCalledWith(expect.objectContaining({
      namePrefix: 'GAN',
      namePrefixes: ['GAN', 'MG', 'AiCube', 'Gi', 'WCU_MY3', 'QY-QYSC', 'XMD-TornadoV4-i'],
      services: expect.arrayContaining([GAN_V4_SERVICE_UUID, MOYU32_SERVICE_UUID, QIYI_SERVICE_UUID]),
      optionalServices: expect.arrayContaining([GAN_V4_SERVICE_UUID, MOYU32_SERVICE_UUID, QIYI_SERVICE_UUID]),
    }));
  });

  it('opens the native service picker for QiYi and exposes its protocol model', async () => {
    await act(async () => { await cube.disconnect(); });
    transport.getServices = vi.fn(async () => []);
    vi.mocked(transport.requestDevice).mockResolvedValueOnce({
      id: 'CC:A3:00:00:A1:B2',
      name: 'XMD-TornadoV4-i-1-A1B2',
    });

    await act(async () => { await cube.connect(); });

    expect(state.connectionKind).toBe('qiyi');
    expect(cube.model).toBe('qiyi');
    expect(transport.requestDevice).toHaveBeenLastCalledWith(expect.objectContaining({
      namePrefixes: ['GAN', 'MG', 'AiCube', 'Gi', 'WCU_MY3', 'QY-QYSC', 'XMD-TornadoV4-i'],
      services: expect.arrayContaining([QIYI_SERVICE_UUID]),
      optionalServices: expect.arrayContaining([QIYI_SERVICE_UUID]),
    }));
  });

  it('publishes a live device list and connects the selected desktop device without reopening a picker', async () => {
    transport.getServices = vi.fn(async () => []);
    const stopScan = vi.fn(async () => undefined);
    transport.scanDevices = vi.fn(async (options, onDevices) => {
      expect(options.namePrefixes).toEqual([
        'GAN', 'MG', 'AiCube', 'Gi', 'WCU_MY3', 'QY-QYSC', 'XMD-TornadoV4-i',
      ]);
      onDevices([
        { id: 'moyu', name: 'WCU_MY32_A1B2', rssi: -41 },
        { id: 'gan', name: 'GAN16ui', rssi: -58 },
      ]);
      return stopScan;
    });
    await act(async () => { await cube.disconnect(); });
    const pickerCalls = vi.mocked(transport.requestDevice).mock.calls.length;

    await act(async () => { await cube.scanDevices?.(); });
    expect(cube.scanning).toBe(true);
    expect(cube.availableDevices).toEqual([
      { id: 'moyu', name: 'WCU_MY32_A1B2', rssi: -41 },
      { id: 'gan', name: 'GAN16ui', rssi: -58 },
    ]);

    await act(async () => { await cube.connect('moyu'); });
    expect(stopScan).toHaveBeenCalledOnce();
    expect(transport.requestDevice).toHaveBeenCalledTimes(pickerCalls);
    expect(state.connectionKind).toBe('moyu32');
    expect(cube.deviceName).toBe('WCU_MY32_A1B2');
    expect(cube.availableDevices).toEqual([]);
  });

  it('clears tracked cube state on an unexpected disconnect', async () => {
    await act(async () => state.callbacks?.onDisconnect());
    expect(cube.phase).toBe('idle');
    expect(cube.deviceName).toBe('');
    expect(cube.lastMove).toBe('');
    expect(cube.facelets).toBe('');
  });

  it('does not let an older failed connection cleanup overwrite a newer connected session', async () => {
    let finishCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => { finishCleanup = resolve; });
    state.connect.mockRejectedValueOnce(new Error('old connect failed'));
    // Dispose the current fixture connection normally; delay disposal only of
    // the next failed attempt, while the user can already retry from idle.
    state.disconnect.mockResolvedValueOnce(undefined).mockReturnValueOnce(cleanup);
    let failedAttempt!: Promise<unknown>;
    await act(async () => { failedAttempt = cube.connect().catch((error: unknown) => error); });
    expect(cube.phase).toBe('idle');
    let retry!: Promise<string>;
    await act(async () => { retry = cube.connect(); });
    expect(cube.phase).toBe('idle');
    await act(async () => { finishCleanup(); await Promise.all([failedAttempt, retry]); });
    expect(cube.phase).toBe('connected');
    expect(cube.deviceName).toBe('GAN16ui');
  });

  it('publishes a verified state-resync solved edge exactly once instead of swallowing auto-stop', async () => {
    expect(cube.solved).toBe(false);
    await act(async () => state.callbacks?.onState(SOLVED_3X3));
    expect(cube.solved).toBe(true);
    expect(state.onSolved).toHaveBeenCalledOnce();
    expect(Number.isFinite(state.onSolved.mock.calls[0][0])).toBe(true);
    await act(async () => state.callbacks?.onState(SOLVED_3X3));
    expect(state.onSolved).toHaveBeenCalledOnce();
  });

  it('records the solved final turn before publishing the stop edge', async () => {
    await act(async () => state.callbacks?.onMove("R'", 251));
    expect(state.onMove).toHaveBeenLastCalledWith("R'", expect.any(Number), SOLVED_3X3);
    expect(state.onSolved).toHaveBeenCalledOnce();
    expect(state.onMove.mock.invocationCallOrder.at(-1)).toBeLessThan(state.onSolved.mock.invocationCallOrder[0]);
  });

  it('forwards future-history metadata with the tracked facelets', async () => {
    await act(async () => state.callbacks?.onMove("R'", 251, { futureHistory: true }));
    expect(state.onMove).toHaveBeenLastCalledWith(
      "R'",
      expect.any(Number),
      SOLVED_3X3,
      { futureHistory: true },
    );
  });

  it('explicit physical-solved reset is not a solve completion and uses the same state model', async () => {
    await act(async () => cube.resetState?.());
    expect(cube.facelets).toBe(SOLVED_3X3);
    expect(cube.solved).toBe(true);
    expect(state.onSolved).not.toHaveBeenCalled();
    await act(async () => { await cube.requestState?.(); });
    expect(state.requestState).toHaveBeenCalledOnce();
  });

  it('clears tracked cube state on a protocol error', async () => {
    await act(async () => state.callbacks?.onProtocolError());
    expect(cube.phase).toBe('error');
    expect(cube.lastMove).toBe('');
    expect(cube.facelets).toBe('');

    await act(async () => {
      state.callbacks?.onMove('R', 2);
      state.callbacks?.onState(SOLVED_3X3);
    });
    expect(cube.phase).toBe('error');
    expect(cube.lastMove).toBe('');
    expect(cube.facelets).toBe('');
  });
});
