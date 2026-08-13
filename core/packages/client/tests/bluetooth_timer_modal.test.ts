// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BluetoothTimerModal from '@/app/[lang]/timer/_components/BluetoothTimerModal';
import type { BluetoothTimerHandle } from '@/app/[lang]/timer/_lib/bluetooth/timer';

function timerHandle(overrides: Partial<BluetoothTimerHandle> = {}): BluetoothTimerHandle {
  return {
    status: {
      connected: false,
      kind: 'unknown',
      deviceName: '',
      state: 'DISCONNECT',
      lastTimeMs: 0,
    },
    lastEvent: null,
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(),
    source: {} as BluetoothTimerHandle['source'],
    ...overrides,
  };
}

describe('BluetoothTimerModal', () => {
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

  it('owns a separate QiYi/GAN timer picker and connects from its button', async () => {
    const timer = timerHandle();

    await act(async () => {
      root.render(createElement(BluetoothTimerModal, {
        timer,
        macPrompt: null,
        onSubmitMac: vi.fn(),
        onCancelMac: vi.fn(),
        onClose: vi.fn(),
      }));
    });

    expect(host.textContent).toContain('QY-Timer');
    expect(host.textContent).toContain('QY-Adapter');
    expect(host.textContent).toContain('GAN Timer');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('.bt-connect-btn')?.click();
    });
    expect(timer.connect).toHaveBeenCalledOnce();
  });

  it('shows the connected timer state and disconnects it', async () => {
    const disconnect = vi.fn();
    const timer = timerHandle({
      status: {
        connected: true,
        kind: 'qiyi-timer',
        deviceName: 'QY-Timer-V003',
        state: 'STOPPED',
        lastTimeMs: 12_345,
      },
      disconnect,
    });

    await act(async () => {
      root.render(createElement(BluetoothTimerModal, {
        timer,
        macPrompt: null,
        onSubmitMac: vi.fn(),
        onCancelMac: vi.fn(),
        onClose: vi.fn(),
      }));
    });

    expect(host.textContent).toContain('QY-Timer-V003');
    expect(host.textContent).toContain('Connected');
    expect(host.textContent).toContain('Stopped');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('button.danger')?.click();
    });
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('prefills the name-derived QiYi MAC for confirmation', async () => {
    await act(async () => {
      root.render(createElement(BluetoothTimerModal, {
        timer: timerHandle(),
        macPrompt: {
          deviceName: 'QY-Timer-x-8F2A',
          suggestedMac: 'CC:A1:00:00:8F:2A',
        },
        onSubmitMac: vi.fn(),
        onCancelMac: vi.fn(),
        onClose: vi.fn(),
      }));
    });

    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('CC:A1:00:00:8F:2A');
  });
});
