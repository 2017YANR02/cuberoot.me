/* @vitest-environment jsdom */

import { act, createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  browserPrintTransport,
  TimerPrintController,
  type TimerPrintControllerHandle,
  type TimerPrintControllerProps,
} from '@cuberoot/timer-ui';

let container: HTMLDivElement;
let root: Root;

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (check()) return;
    await act(async () => { await delay(5); });
  }
  throw new Error('Timed out waiting for print lifecycle state');
}

function props(
  transport: TimerPrintControllerProps['transport'],
  onError?: () => void,
): TimerPrintControllerProps {
  return {
    currentResult: '12.34',
    currentScramble: "R U R' U'",
    currentScrambleSource: 'WCA real · Example Open 2026 · Fi,A,1',
    event: '333',
    language: 'en',
    onError,
    sessionName: 'Practice',
    solves: [{
      id: 'solve-1',
      timeMs: 12_345,
      penalty: 'ok',
      scramble: "R U R' U'",
      event: '333',
      ts: Date.UTC(2026, 7, 30, 17, 0, 0),
    }],
    transport,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => (
    window.setTimeout(() => callback(performance.now()), 0)
  ));
});

afterEach(async () => {
  vi.useRealTimers();
  await act(async () => { root.unmount(); });
  document.body.className = '';
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('browser print transport', () => {
  it('settles when the browser emits afterprint', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const pending = browserPrintTransport();

    expect(print).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('afterprint'));
    await expect(pending).resolves.toBeUndefined();
  });

  it('rejects a synchronous print failure', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new Error('print unavailable');
    });

    await expect(browserPrintTransport()).rejects.toThrow('print unavailable');
  });

  it('uses the timeout only when afterprint is omitted', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const pending = browserPrintTransport();

    await vi.advanceTimersByTimeAsync(29_999);
    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeUndefined();
  });
});

describe('TimerPrintController lifecycle', () => {
  it('mounts one frozen portal only on request and keeps it until transport settles', async () => {
    let finishTransport: (() => void) | undefined;
    const transport = vi.fn(() => new Promise<void>((resolve) => { finishTransport = resolve; }));
    const ref = createRef<TimerPrintControllerHandle>();
    await act(async () => { root.render(createElement(TimerPrintController, { ...props(transport), ref })); });

    expect(document.querySelector('.timer-print-portal')).toBeNull();
    act(() => {
      ref.current?.print();
      ref.current?.print();
    });

    await waitFor(() => transport.mock.calls.length === 1);
    expect(document.body.classList.contains('timer-printing')).toBe(true);
    expect(document.querySelectorAll('.timer-print-portal')).toHaveLength(1);
    expect(document.querySelector('.timer-print-document')?.textContent).toContain('Practice');

    await act(async () => {
      finishTransport?.();
      await delay(10);
    });
    expect(document.body.classList.contains('timer-printing')).toBe(false);
    expect(document.querySelector('.timer-print-portal')).toBeNull();
  });

  it('reports transport failure and always restores the page', async () => {
    const onError = vi.fn();
    const ref = createRef<TimerPrintControllerHandle>();
    await act(async () => {
      root.render(createElement(TimerPrintController, {
        ...props(() => Promise.reject(new Error('print failed')), onError),
        ref,
      }));
    });

    act(() => { ref.current?.print(); });
    await waitFor(() => onError.mock.calls.length === 1);
    await waitFor(() => document.querySelector('.timer-print-portal') === null);
    expect(document.body.classList.contains('timer-printing')).toBe(false);
  });
});
