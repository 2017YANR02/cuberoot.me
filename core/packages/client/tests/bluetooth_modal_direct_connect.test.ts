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

const originalUserAgent = navigator.userAgent;

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
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    window.__wxjs_environment = undefined;
    window.wx = undefined;
    window.jWeixin = undefined;
    vi.restoreAllMocks();
  });

  it('offers the native bridge on iOS WeChat instead of sending the user to Bluefy', async () => {
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone) MicroMessenger/8.0',
    });

    await act(async () => {
      root.render(createElement(BluetoothModal, {
        isZh: true,
        cube: disconnectedCube,
        onClose: vi.fn(),
        onConnect: vi.fn(() => Promise.resolve()),
      }));
    });

    expect(host.textContent).toContain('Search & connect');
    expect(host.textContent).not.toContain('Bluefy');
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
    expect(host.textContent).not.toContain('Supported timing devices');

    await act(async () => {
      rejectAttempt(new BluetoothConnectError('picker', '用户取消选择'));
      await connectAttempt.catch(() => {});
    });

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('choosing the device');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('用户取消选择');
    expect(host.textContent).toContain('Search & connect');
  });

  it('keeps the essential connected-cube facts and recovery actions', async () => {
    const connectedCube = {
      ...disconnectedCube,
      status: {
        connected: true,
        brand: 'gan-v4',
        battery: 72,
        deviceName: 'GAN16ui_ (C2:AF)',
        hasGyro: true,
      },
      solved: true,
      lastMove: "R'",
      resetState: vi.fn(),
      disconnect: vi.fn(),
    } as BluetoothCubeHandle;

    await act(async () => {
      root.render(createElement(BluetoothModal, {
        isZh: false,
        cube: connectedCube,
        onClose: vi.fn(),
        onConnect: vi.fn(() => Promise.resolve()),
      }));
    });

    const content = host.textContent ?? '';
    expect(content).toContain('Connected');
    expect(content).toContain('GAN16ui_ (C2:AF)');
    expect(content).toContain('gan-v4');
    expect(content).toContain('72%');
    expect(content).toContain('solved');
    expect(content).toContain("R'");
    expect(content).toContain('automatically stops the timer');
    expect(content).toContain('Reset state');
    expect(content).toContain('Disconnect');
    expect(host.querySelector('button[aria-label="Close"]')).not.toBeNull();
  });
});
