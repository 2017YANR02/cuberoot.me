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
  advertisementDiagnostic: null,
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

  it('requires physical-solved confirmation and an idle timer for device calibration', async () => {
    const resetDeviceState = vi.fn(async () => {});
    const resetState = vi.fn();
    const connected = { ...disconnectedCube, status: { ...disconnectedCube.status, connected: true, brand: 'gan-v4' }, resetDeviceState, resetState } as BluetoothCubeHandle;
    const props = { isZh: false, cube: connected, onClose: vi.fn(), onConnect: vi.fn(async () => {}) };
    await act(async () => root.render(createElement(BluetoothModal, props)));
    const find = (text: string) => Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes(text))!;
    expect(find('Reset state').disabled).toBe(false);
    await act(async () => root.render(createElement(BluetoothModal, { ...props, allowDeviceCalibration: true })));
    await act(async () => find('Reset state').click());
    expect(resetDeviceState).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Solve the physical cube');
    await act(async () => find('Cube solved, calibrate').click());
    expect(resetDeviceState).toHaveBeenCalledOnce();
    expect(resetState).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Device state calibrated');
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

    expect(host.textContent).toContain('Connect');
    expect(host.textContent).not.toContain('Bluefy');
  });

  it('shows the detected Android browser and a useful fallback when it lacks Bluetooth', async () => {
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/121.0 Mobile Safari/537.36 SamsungBrowser/25.0',
    });

    await act(async () => {
      root.render(createElement(BluetoothModal, {
        isZh: false,
        cube: disconnectedCube,
        onClose: vi.fn(),
        onConnect: vi.fn(() => Promise.resolve()),
      }));
    });

    expect(host.textContent).toContain('Detected: Android, Samsung Internet');
    expect(host.textContent).toContain('This Android browser has no Web Bluetooth');
    expect(host.querySelector('.bt-connect-btn')).toBeNull();
    expect(host.textContent).not.toContain('Install Bluefy');
  });

  it('shows an OpenHarmony-specific fallback for ArkWeb without the API', async () => {
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Phone;OpenHarmony 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 ArkWeb/6.0.0.42 Mobile',
    });

    await act(async () => {
      root.render(createElement(BluetoothModal, {
        isZh: false,
        cube: disconnectedCube,
        onClose: vi.fn(),
        onConnect: vi.fn(() => Promise.resolve()),
      }));
    });

    expect(host.textContent).toContain('Detected: HarmonyOS / OpenHarmony, ArkWeb');
    expect(host.textContent).toContain('This HarmonyOS browser cannot connect to the cube');
    expect(host.querySelector('.bt-connect-btn')).toBeNull();
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
    expect(host.textContent).not.toContain('GAN356');
    expect(host.querySelector('.bt-connected-summary')).not.toBeNull();
    const reset = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Reset state'))!;
    expect(reset.disabled).toBe(true);
    expect(host.querySelector('.bt-connect-btn')).toBeNull();

    await act(async () => {
      rejectAttempt(new BluetoothConnectError('picker', '用户取消选择'));
      await connectAttempt.catch(() => {});
    });

    const failure = host.querySelector('[role="alert"]')?.textContent ?? '';
    expect(failure).toContain('This device model is not currently supported');
    expect(failure).toContain('Only smart 3x3 cubes are supported');
    for (const model of ['GAN356 i Carry', 'GAN Mini ui FreePlay', 'GAN12 ui FreePlay', 'V10 AI / V11 AI', 'Super WeiLong V2', 'QYSC', 'Tornado V4', 'GoCube / GoCube Edge', 'Rubik’s Connected', 'GiiKER i3']) {
      expect(failure).toContain(model);
    }
    expect(host.querySelectorAll('[role="alert"] ul')).toHaveLength(4);
    expect(host.textContent).toContain('Retry connection');
  });

  it('keeps the essential connected-cube facts and recovery actions', async () => {
    const resetGyro = vi.fn();
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
      advertisementDiagnostic: {
        phase: 'connected',
        eventNumber: 3,
        elapsedMs: 1260,
        complete: true,
        totalElapsedMs: 4320,
        advertisementMs: 1260,
        gattMs: 2480,
        discoveryMs: 380,
        handshakeMs: 200,
      },
      resetState: vi.fn(),
      disconnect: vi.fn(),
    } as BluetoothCubeHandle;

    await act(async () => {
      root.render(createElement(BluetoothModal, {
        isZh: false,
        cube: connectedCube,
        onResetGyro: resetGyro,
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
    expect(content).not.toContain('Connection diagnostic');
    expect(content).not.toContain('Out of sync?');
    expect(content).toContain('Reset state');
    expect(content).toContain('Disconnect');
    const gyroButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Reset gyroscope'))!;
    await act(async () => gyroButton.click());
    expect(resetGyro).toHaveBeenCalledOnce();
    expect(connectedCube.resetState).not.toHaveBeenCalled();
    expect(host.querySelector('button[aria-label="Close"]')).not.toBeNull();
  });

  it('keeps an idle status dialog compact and offers reconnection without a model list', async () => {
    const onConnect = vi.fn(async () => {});
    await act(async () => root.render(createElement(BluetoothModal, {
      isZh: false, cube: disconnectedCube, onClose: vi.fn(), onConnect,
    })));
    expect(host.textContent).not.toContain('GAN356');
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Not connected');
    expect(onConnect).not.toHaveBeenCalled();
    await act(async () => host.querySelector<HTMLButtonElement>('.bt-connect-btn')!.click());
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('switches to the MAC instructions and focuses the input when MY32 requests its address', async () => {
    const props = { isZh: false, cube: disconnectedCube, onClose: vi.fn(), onConnect: vi.fn(async () => {}) };
    await act(async () => root.render(createElement(BluetoothModal, props)));
    await act(async () => root.render(createElement(BluetoothModal, {
      ...props, macPrompt: { deviceName: 'WCU_MY32_A1B2' },
    })));
    expect(host.textContent).toContain('WCU_MY32_A1B2');
    expect(host.textContent).toContain('chrome://bluetooth-internals/#devices');
    expect(host.textContent).toContain('edge://bluetooth-internals/#devices');
    expect(host.textContent).toContain('Name column');
    expect(host.textContent).toContain('Address');
    expect(host.textContent).not.toContain('Cube Station');
    expect(host.querySelector('.bt-connect-btn')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('[data-mac-input]'));
  });
});
