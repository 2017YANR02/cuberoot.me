// @vitest-environment jsdom

import { SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { InstalledAppSmartCube } from '../platform';
import type { BleTransport } from './transport';
import { useInstalledSmartCube } from './use-smart-cube';

const state = vi.hoisted(() => ({
  onMove: vi.fn(), onSolved: vi.fn(), requestState: vi.fn(),
  connect: vi.fn<() => Promise<void>>(), disconnect: vi.fn<() => Promise<void>>(),
  callbacks: null as null | {
    onDisconnect(): void;
    onMove(move: string, timestamp: number): void;
    onProtocolError(): void;
    onState(facelets: string): void;
  },
}));

vi.mock('./gan-v4-cube', () => ({
  GanV4CubeConnection: class {
    constructor(_transport: BleTransport, callbacks: NonNullable<typeof state.callbacks>) {
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
    vi.clearAllMocks();
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
