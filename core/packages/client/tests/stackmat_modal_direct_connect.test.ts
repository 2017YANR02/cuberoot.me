// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StackmatModal from '@/app/[lang]/timer/_components/StackmatModal';
import type { StackmatHandle } from '@/app/[lang]/timer/_lib/stackmat';

const SOLO_VIEW = readFileSync(join(
  dirname(fileURLToPath(import.meta.url)),
  '..', 'app', '[lang]', 'timer', '_shell', 'SoloView.tsx',
), 'utf8');
const TIMER_CHROME = readFileSync(join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'timer-ui', 'src', 'TimerChrome.tsx',
), 'utf8');

function stackmatHandle(): StackmatHandle {
  return {
    status: {
      phase: 'unknown',
      ms: 0,
      listening: false,
      signalPresent: false,
      stateByte: '',
      unit: 0,
      deviceId: '',
    },
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    signalLevel: 0,
    noise: 0,
    listInputDevices: vi.fn(() => Promise.resolve([])),
  };
}

describe('StackmatModal direct connection attempt', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it('starts microphone capture from the bottom button click itself', () => {
    const handlerStart = SOLO_VIEW.indexOf('const connectStackmat = useCallback');
    const handlerEnd = SOLO_VIEW.indexOf('// ── Fullscreen', handlerStart);
    const handler = SOLO_VIEW.slice(handlerStart, handlerEnd);

    expect(handlerStart).toBeGreaterThan(-1);
    expect(handler).toContain('setStackmatOpen(true)');
    expect(handler).toContain('const attempt = stackmat.start()');
    expect(SOLO_VIEW).toContain('onMicrophone={connectStackmat}');
    expect(TIMER_CHROME).toContain('onClick={onMicrophone}');
    expect(SOLO_VIEW).toContain('connectAttempt={stackmatConnectAttempt}');
  });

  it('shows progress for the permission request started by the microphone click', async () => {
    let resolveAttempt!: () => void;
    const connectAttempt = new Promise<void>((resolve) => {
      resolveAttempt = resolve;
    });

    act(() => {
      root.render(createElement(StackmatModal, {
        stackmat: stackmatHandle(),
        onClose: vi.fn(),
        connectAttempt,
      }));
    });

    expect(host.textContent).toContain('Starting…');
    expect(host.textContent).not.toContain('Start listening');

    await act(async () => {
      resolveAttempt();
      await connectAttempt;
    });

    expect(host.textContent).toContain('Start listening');
  });

  it('owns a permission error from the direct attempt and offers retry', async () => {
    let rejectAttempt!: (reason: unknown) => void;
    const connectAttempt = new Promise<void>((_resolve, reject) => {
      rejectAttempt = reject;
    });

    act(() => {
      root.render(createElement(StackmatModal, {
        stackmat: stackmatHandle(),
        onClose: vi.fn(),
        connectAttempt,
      }));
    });

    const denial = new DOMException('Permission denied', 'NotAllowedError');
    await act(async () => {
      rejectAttempt(denial);
      await connectAttempt.catch(() => undefined);
    });

    expect(host.textContent).toContain('The browser denied microphone access');
    expect(host.textContent).toContain('Start listening');
  });
});
