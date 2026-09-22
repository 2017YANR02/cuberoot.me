// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
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
const sharedDeviceCss = readFileSync(
  new URL('./smart-cube-device-modal.css', new URL(import.meta.resolve('@cuberoot/timer-ui'))),
  'utf8',
);

const modal = () => document.body.querySelector<HTMLElement>('.timer-smart-cube-device__modal')!;

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

  it('resets software state and forwards the reset to a capable device', async () => {
    const resetDeviceState = vi.fn(async () => {});
    const resetState = vi.fn();
    const connected = { ...disconnectedCube, status: { ...disconnectedCube.status, connected: true, brand: 'gan-v4' }, resetDeviceState, resetState } as BluetoothCubeHandle;
    const props = { isZh: false, cube: connected, onClose: vi.fn(), onConnect: vi.fn(async () => {}) };
    await act(async () => root.render(createElement(BluetoothModal, props)));
    const find = (text: string) => Array.from(modal().querySelectorAll('button')).find(button => button.textContent?.includes(text))!;
    expect(find('Reset state').disabled).toBe(false);
    await act(async () => find('Reset state').click());
    expect(resetDeviceState).toHaveBeenCalledOnce();
    expect(resetState).not.toHaveBeenCalled();
    expect(modal().textContent).toContain('State reset');
    expect(modal().textContent).not.toContain('calibrate');
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
        isZh: false,
        cube: disconnectedCube,
        onClose: vi.fn(),
        onConnect: vi.fn(() => Promise.resolve()),
      }));
    });

    expect(modal().textContent).toContain('Connect');
    expect(modal().textContent).not.toContain('Bluefy');
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

    expect(modal().textContent).toContain('Detected: Android, Samsung Internet');
    expect(modal().textContent).toContain('This Android browser has no Web Bluetooth');
    expect(modal().querySelector('.bt-connect-btn')).toBeNull();
    expect(modal().textContent).not.toContain('Install Bluefy');
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

    expect(modal().textContent).toContain('Detected: HarmonyOS / OpenHarmony, ArkWeb');
    expect(modal().textContent).toContain('This HarmonyOS browser cannot connect to the cube');
    expect(modal().querySelector('.bt-connect-btn')).toBeNull();
  });

  it('shows progress and owns errors from a connection started by the icon click', async () => {
    let rejectAttempt!: (reason: unknown) => void;
    const connectAttempt = new Promise<void>((_resolve, reject) => {
      rejectAttempt = reject;
    });

    await act(async () => {
      root.render(createElement(BluetoothModal, {
        isZh: false,
        cube: disconnectedCube,
        onClose: vi.fn(),
        onConnect: vi.fn(() => Promise.resolve()),
        connectAttempt,
      }));
    });

    expect(modal().textContent).toContain('Connecting…');
    expect(modal().textContent).not.toContain('GAN356');
    expect(modal().querySelector('.bt-connected-summary')).not.toBeNull();
    const reset = Array.from(modal().querySelectorAll('button')).find(button => button.textContent?.includes('Reset state'))!;
    expect(reset.disabled).toBe(true);
    expect(modal().querySelector('.bt-connect-btn')).toBeNull();

    await act(async () => {
      rejectAttempt(new BluetoothConnectError('picker', '用户取消选择'));
      await connectAttempt.catch(() => {});
    });

    const failure = modal().querySelector('[role="alert"]')?.textContent ?? '';
    expect(failure).toContain('This device model is not currently supported');
    expect(failure).toContain('Only smart 3x3 cubes are supported');
    for (const model of ['GAN356 i Carry', 'GAN Mini ui FreePlay', 'GAN12 ui FreePlay', 'V10 AI / V11 AI', 'Super WeiLong V2', 'QYSC', 'Tornado V4', 'GoCube / GoCube Edge', 'Rubik’s Connected', 'GiiKER i3']) {
      expect(failure).toContain(model);
    }
    expect(modal().querySelectorAll('[role="alert"] ul')).toHaveLength(4);
    expect(modal().textContent).toContain('Retry connection');
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

    const content = modal().textContent ?? '';
    expect(content).toContain('Connected');
    expect(content).toContain('GAN16ui_ (C2:AF)');
    expect(content).toContain('gan-v4');
    expect(content).toContain('72%');
    expect(content).toContain('solved');
    expect(content).not.toContain('Last move');
    expect(content).not.toContain("R'");
    expect(content).not.toContain('Connection diagnostic');
    expect(content).not.toContain('Out of sync?');
    expect(content).toContain('Reset state');
    expect(content).toContain('Disconnect');
    const stateResetButton = Array.from(modal().querySelectorAll('button')).find(button => button.textContent?.includes('Reset state'))!;
    const gyroButton = Array.from(modal().querySelectorAll('button')).find(button => button.textContent?.includes('Reset gyroscope'))!;
    expect(stateResetButton.querySelector('svg')).toBeNull();
    expect(gyroButton.querySelector('svg')).toBeNull();
    await act(async () => gyroButton.click());
    expect(resetGyro).toHaveBeenCalledOnce();
    expect(connectedCube.resetState).not.toHaveBeenCalled();
    expect(modal().querySelector('button[aria-label="Close"]')).not.toBeNull();
  });

  it('keeps three mobile device actions on one wrapping row while their labels fit', async () => {
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 480px)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const connectedCube = {
      ...disconnectedCube,
      status: {
        connected: true,
        brand: 'gan-v4',
        battery: 72,
        deviceName: 'GAN16ui',
        hasGyro: true,
      },
      resetState: vi.fn(),
      disconnect: vi.fn(),
    } as BluetoothCubeHandle;

    await act(async () => root.render(createElement(BluetoothModal, {
      isZh: false,
      cube: connectedCube,
      onResetGyro: vi.fn(),
      onClose: vi.fn(),
      onConnect: vi.fn(async () => {}),
    })));

    const actions = modal().querySelector<HTMLElement>('.bt-connected-actions')!;
    const buttons = [...actions.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.map(button => button.textContent?.trim())).toEqual([
      'Reset state',
      'Reset gyroscope',
      'Disconnect',
    ]);
    expect(actions.style.flexDirection).toBe('');
    const mobileActionRule = sharedDeviceCss.match(
      /@media\s*\(max-width:\s*480px\)[\s\S]*?\.timer-smart-cube-device__action\s*\{([^}]*)\}/,
    )?.[1] ?? '';
    expect(mobileActionRule).toContain('flex: 1 1 auto;');
    expect(mobileActionRule).toContain('min-width: max-content;');
    expect(mobileActionRule).toContain('padding: 7px 8px;');
    expect(mobileActionRule).toContain('white-space: nowrap;');
  });

  it('keeps an idle status dialog compact and offers reconnection without a model list', async () => {
    const onConnect = vi.fn(async () => {});
    await act(async () => root.render(createElement(BluetoothModal, {
      isZh: false, cube: disconnectedCube, onClose: vi.fn(), onConnect,
    })));
    expect(modal().textContent).not.toContain('GAN356');
    expect(modal().querySelector('[role="status"]')?.textContent).toBe('Not connected');
    expect(onConnect).not.toHaveBeenCalled();
    await act(async () => modal().querySelector<HTMLButtonElement>('.bt-connect-btn')!.click());
    expect(onConnect).toHaveBeenCalledOnce();
  });

  it('switches to the MAC instructions and focuses the input when MY32 requests its address', async () => {
    const props = { isZh: false, cube: disconnectedCube, onClose: vi.fn(), onConnect: vi.fn(async () => {}) };
    await act(async () => root.render(createElement(BluetoothModal, props)));
    await act(async () => root.render(createElement(BluetoothModal, {
      ...props, macPrompt: { deviceName: 'WCU_MY32_A1B2' },
    })));
    expect(modal().textContent).toContain('WCU_MY32_A1B2');
    expect(modal().textContent).toContain('chrome://bluetooth-internals/#devices');
    expect(modal().textContent).toContain('edge://bluetooth-internals/#devices');
    expect(modal().textContent).toContain('Name column');
    expect(modal().textContent).toContain('Address');
    expect(modal().textContent).not.toContain('Cube Station');
    expect(modal().querySelector('.bt-connect-btn')).toBeNull();
    expect(document.activeElement).toBe(modal().querySelector('[data-mac-input]'));
  });
});
