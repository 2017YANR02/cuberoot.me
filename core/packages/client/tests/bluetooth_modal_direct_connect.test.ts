// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BluetoothModal from '@/app/[lang]/timer/_components/BluetoothModal';
import { BluetoothConnectError, type BluetoothCubeHandle } from '@/app/[lang]/timer/_lib/bluetooth';

const disconnectedCube = {
  status: {
    connected: false,
    brand: 'unknown',
    battery: null,
    deviceName: '',
    hasGyro: false,
  },
  lastMove: null,
  solved: false,
  facelets: null,
} as BluetoothCubeHandle;

describe('BluetoothModal direct connection attempt', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: {},
    });
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('shows progress and owns errors from a connection started by the icon click', async () => {
    let rejectAttempt!: (reason: unknown) => void;
    const connectAttempt = new Promise<void>((_resolve, reject) => {
      rejectAttempt = reject;
    });

    await act(async () => {
      root.render(createElement(BluetoothModal, {
        isZh: true,
        cube: disconnectedCube,
        onClose: vi.fn(),
        onConnect: vi.fn(() => Promise.resolve()),
        connectAttempt,
      }));
    });

    expect(host.textContent).toContain('Connecting…');

    await act(async () => {
      rejectAttempt(new BluetoothConnectError('picker', '用户取消选择'));
      await connectAttempt.catch(() => {});
    });

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('choosing the device');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('用户取消选择');
    expect(host.textContent).toContain('Search & connect');
  });
});
