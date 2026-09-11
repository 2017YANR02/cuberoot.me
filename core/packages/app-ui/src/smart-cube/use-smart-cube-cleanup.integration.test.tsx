// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { InstalledAppSmartCube } from '../platform';
import type { BleTransport } from './transport';
import { useInstalledSmartCube } from './use-smart-cube';

it.each(['handshake failure', 'manual disconnect', 'pending subscription'] as const)(
  'waits for real GAN notification and GATT cleanup before retrying after %s', async (scenario) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let cube!: InstalledAppSmartCube;
  let releaseStop!: () => void;
  const stopGate = new Promise<void>((resolve) => { releaseStop = resolve; });
  let releaseSubscribe!: () => void;
  const subscribeGate = new Promise<void>((resolve) => { releaseSubscribe = resolve; });
  const order: string[] = [];
  let attempt = 0;
  let failHandshake = scenario === 'handshake failure';
  let disconnected: () => void = () => undefined;
  const transport: BleTransport = {
    initialize: async () => undefined,
    requestDevice: async () => ({ id: 'AB:CD:EF:01:23:45', name: 'GAN16ui' }),
    connect: async (_id, onDisconnect) => {
      order.push(`connect:${++attempt}`);
      disconnected = onDisconnect;
    },
    disconnect: async () => {
      order.push('disconnect');
      // Native disconnect addresses the device, not a particular JS session.
      disconnected();
    },
    getMtu: async () => 517,
    read: async () => new DataView(new ArrayBuffer(0)),
    subscribe: async () => {
      const owner = attempt;
      if (owner === 1 && scenario === 'pending subscription') await subscribeGate;
      return async () => {
        order.push(`stop:${owner}`);
        if (owner === 1) await stopGate;
      };
    },
    write: async () => {
      if (failHandshake) { failHandshake = false; throw new Error('handshake write failed'); }
    },
  };
  function Harness() {
    cube = useInstalledSmartCube(() => transport, { language: 'en', onMove: () => undefined });
    return <output>{cube.phase}</output>;
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let failed!: Promise<unknown>;
  let retry!: Promise<unknown>;
  let closing: Promise<void> | undefined;
  try {
    await act(async () => root.render(<Harness />));
    if (scenario === 'pending subscription') {
      await act(async () => { failed = cube.connect().catch((error: unknown) => error); });
      expect(cube.phase).toBe('connecting');
      await act(async () => { closing = cube.disconnect(); });
    } else if (scenario === 'handshake failure') {
      await act(async () => { failed = cube.connect().catch((error: unknown) => error); });
    } else {
      await act(async () => { await cube.connect(); });
      await act(async () => { failed = cube.disconnect(); });
    }
    expect(cube.phase).toBe('idle');
    const pendingOrder = scenario === 'pending subscription' ? ['connect:1'] : ['connect:1', 'stop:1'];
    expect(order).toEqual(pendingOrder);
    await act(async () => { retry = cube.connect().catch((error: unknown) => error); });
    expect(order).toEqual(pendingOrder);
    await act(async () => releaseSubscribe());
    expect(order).toEqual(['connect:1', 'stop:1']);
    await act(async () => { releaseStop(); await Promise.all([failed, retry, closing]); });
    expect(order).toEqual(['connect:1', 'stop:1', 'disconnect', 'connect:2']);
    expect(cube.phase).toBe('connected');
    expect(cube.deviceName).toBe('GAN16ui');
  } finally {
    await act(async () => { releaseSubscribe(); releaseStop(); await Promise.all([failed, retry, closing]); root.unmount(); });
    container.remove();
    vi.unstubAllGlobals();
  }
});
