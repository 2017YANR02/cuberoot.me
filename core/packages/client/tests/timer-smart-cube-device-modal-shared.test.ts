// @vitest-environment jsdom

import { TimerSmartCubeDeviceModal } from '@cuberoot/timer-ui';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const connectedSnapshot = {
  battery: 72,
  deviceName: 'GAN16ui',
  hasGyro: true,
  lastMove: "R'",
  phase: 'connected' as const,
  protocol: 'gan-v4',
  solved: false,
};

describe('shared smart-cube device modal', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('shares live facts and routes reset, calibration, and disconnect actions', async () => {
    const onClose = vi.fn();
    const onDisconnect = vi.fn(async () => {});
    const onResetGyro = vi.fn();
    const onResetState = vi.fn(async () => {});

    await act(async () => root.render(createElement(TimerSmartCubeDeviceModal, {
      language: 'en',
      onClose,
      onDisconnect,
      onResetGyro,
      onResetState,
      snapshot: connectedSnapshot,
    })));

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain('GAN16ui');
    expect(dialog.textContent).toContain('Connected, unsolved');
    expect(dialog.textContent).toContain('72%');
    expect(dialog.textContent).not.toContain('Last move');
    expect(dialog.textContent).not.toContain("R'");
    expect(dialog.textContent).toContain('gan-v4');

    const button = (label: string) => [...dialog.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.textContent?.includes(label))!;
    await act(async () => button('Reset state').click());
    expect(onResetState).toHaveBeenCalledOnce();
    expect(dialog.textContent).toContain('State reset');
    expect(button('Reset state').querySelector('svg')).toBeNull();
    expect(button('Reset gyroscope').querySelector('svg')).toBeNull();

    await act(async () => button('Reset gyroscope').click());
    expect(onResetGyro).toHaveBeenCalledOnce();

    await act(async () => button('Disconnect').click());
    expect(onDisconnect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps rejected actions contained and protects busy or drag-out dismissal', async () => {
    let finishReset!: () => void;
    const onClose = vi.fn();
    const onResetState = vi.fn(() => new Promise<void>((resolve) => { finishReset = resolve; }));
    const onDisconnect = vi.fn(async () => { throw new Error('native disconnect failed'); });

    await act(async () => root.render(createElement(TimerSmartCubeDeviceModal, {
      language: 'en',
      onClose,
      onDisconnect,
      onResetState,
      snapshot: connectedSnapshot,
    })));

    const overlay = document.body.querySelector<HTMLElement>('.timer-smart-cube-device__overlay')!;
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    const button = (label: string) => [...dialog.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.textContent?.includes(label))!;

    await act(async () => button('Reset state').click());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();

    dialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => finishReset());
    await act(async () => button('Disconnect').click());
    expect(onDisconnect).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    overlay.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the Web adapter on the shared status and recovery surface', () => {
    const source = readFileSync('app/[lang]/timer/_components/BluetoothModal.tsx', 'utf8');
    expect(source).toContain("import { TimerSmartCubeDeviceModal } from '@cuberoot/timer-ui';");
    expect(source).toContain('<TimerSmartCubeDeviceModal');
    expect(source).toContain('overrideBody={macBody}');
    expect(source).not.toContain('useModalBackdrop');
    expect(source).not.toContain('<div className="modal-section bt-connected-summary">');
  });
});
