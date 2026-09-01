// @vitest-environment jsdom

import { readFileSync } from 'node:fs';

import { RoomQrModal } from '@cuberoot/timer-ui/room-qr-modal';
import { browserClipboardTransport } from '@cuberoot/timer-ui';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const labels = {
  close: 'Close',
  copied: 'Copied',
  copyFailed: 'Copy failed. Try again.',
  copyInvite: 'Copy invite link',
  scanToJoin: 'Scan to join',
};
const roomQrSource = readFileSync(
  new URL(import.meta.resolve('@cuberoot/timer-ui/room-qr-modal')),
  'utf8',
);

describe('shared RoomQrModal accessibility', () => {
  let host: HTMLDivElement;
  let root: Root;
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    trigger = document.createElement('button');
    trigger.textContent = 'Open QR';
    document.body.appendChild(trigger);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    trigger.focus();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    trigger.remove();
    vi.restoreAllMocks();
  });

  it('labels the dialog, traps focus, closes with Escape, and restores prior focus', async () => {
    const onClose = vi.fn();
    const writeClipboardText = vi.fn(async () => undefined);
    await act(async () => root.render(createElement(RoomQrModal, {
      code: '1234',
      labels,
      onClose,
      url: 'https://cuberoot.me/timer?players=net&room=1234',
      writeClipboardText,
    })));

    const dialog = document.querySelector<HTMLElement>('.room-qr-modal')!;
    const close = document.querySelector<HTMLButtonElement>('.room-qr-close')!;
    const copy = document.querySelector<HTMLButtonElement>('.room-qr-link')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent)
      .toBe(labels.scanToJoin);
    expect(document.activeElement).toBe(close);

    copy.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
    expect(document.activeElement).toBe(close);
    window.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Tab',
      shiftKey: true,
    }));
    expect(document.activeElement).toBe(copy);
    await act(async () => copy.click());
    expect(writeClipboardText).toHaveBeenCalledWith(
      'https://cuberoot.me/timer?players=net&room=1234',
    );
    expect(copy.textContent).toContain(labels.copied);
    trigger.focus();
    expect(document.activeElement).toBe(close);

    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => root.render(null));
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps both QR actions at the shared 44 px touch-target minimum', () => {
    const css = readFileSync(
      new URL(import.meta.resolve('@cuberoot/timer-ui/room-qr-modal.css')),
      'utf8',
    );
    expect(css).toMatch(/\.room-qr-close \{[^}]*width: 44px;[^}]*height: 44px;/s);
    expect(css).toMatch(/\.room-qr-link \{[^}]*min-width: 44px;[^}]*min-height: 44px;/s);
  });

  it('delegates clipboard access instead of assuming a browser transport', () => {
    expect(roomQrSource).toContain('writeClipboardText(url)');
    expect(roomQrSource).not.toContain('navigator.clipboard');
  });

  it('shows a retryable failure when the injected clipboard transport rejects', async () => {
    await act(async () => root.render(createElement(RoomQrModal, {
      code: '1234',
      labels,
      onClose: vi.fn(),
      url: 'https://cuberoot.me/timer?players=net&room=1234',
      writeClipboardText: vi.fn(async () => Promise.reject(new Error('denied'))),
    })));
    await act(async () => document.querySelector<HTMLButtonElement>('.room-qr-link')!.click());
    expect(document.querySelector('.room-qr-link-text')?.textContent).toBe(labels.copyFailed);
  });

  it('rejects cleanly when the browser has no clipboard transport', async () => {
    await expect(browserClipboardTransport('1234')).rejects.toThrow('clipboard unavailable');
  });
});
