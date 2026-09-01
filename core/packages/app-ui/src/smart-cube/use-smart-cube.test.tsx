// @vitest-environment jsdom

import { SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { InstalledAppSmartCube } from '../platform';
import type { BleTransport } from './transport';
import { useInstalledSmartCube } from './use-smart-cube';

const state = vi.hoisted(() => ({
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
      state.callbacks?.onState(SOLVED_3X3);
    }

    async disconnect() {}
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
    cube = useInstalledSmartCube(() => transport, { language: 'en', onMove: vi.fn() });
    useEffect(() => undefined);
    return <output>{`${cube.phase}:${cube.lastMove}:${cube.facelets}`}</output>;
  }

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    state.callbacks = null;
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
