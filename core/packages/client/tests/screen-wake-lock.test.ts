// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScreenWakeLock from '@/components/ScreenWakeLock';

class FakeWakeLockSentinel extends EventTarget {
  released = false;
  readonly type = 'screen' as const;
  readonly release = vi.fn(async () => {
    if (this.released) return;
    this.released = true;
    this.dispatchEvent(new Event('release'));
  });
}

describe('ScreenWakeLock', () => {
  let host: HTMLDivElement;
  let root: Root;
  let mounted: boolean;
  let visibility: DocumentVisibilityState;

  const setWakeLock = (request: ReturnType<typeof vi.fn>) => {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });
  };

  const mount = async () => {
    mounted = true;
    await act(async () => root.render(createElement(ScreenWakeLock)));
  };

  const unmount = async () => {
    if (!mounted) return;
    mounted = false;
    await act(async () => root.unmount());
  };

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    mounted = false;
  });

  afterEach(async () => {
    await unmount();
    host.remove();
    Reflect.deleteProperty(navigator, 'wakeLock');
    vi.restoreAllMocks();
  });

  it('acquires once while visible and releases on unmount', async () => {
    const sentinel = new FakeWakeLockSentinel();
    const request = vi.fn().mockResolvedValue(sentinel);
    setWakeLock(request);

    await mount();
    document.dispatchEvent(new Event('pointerdown'));

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');

    await unmount();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('releases in the background and reacquires when visible again', async () => {
    const first = new FakeWakeLockSentinel();
    const second = new FakeWakeLockSentinel();
    const request = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    setWakeLock(request);
    await mount();

    await act(async () => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(first.release).toHaveBeenCalledTimes(1);

    await act(async () => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('retries from a user gesture after an initial policy rejection', async () => {
    const sentinel = new FakeWakeLockSentinel();
    const request = vi.fn()
      .mockRejectedValueOnce(new DOMException('activation required', 'NotAllowedError'))
      .mockResolvedValueOnce(sentinel);
    setWakeLock(request);
    await mount();

    await act(async () => document.dispatchEvent(new Event('touchend')));

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('silently does nothing when the API is unavailable', async () => {
    await mount();
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('pointerdown'));
    });
  });

  it('releases a request that resolves after the page becomes hidden', async () => {
    let resolveRequest!: (sentinel: FakeWakeLockSentinel) => void;
    const request = vi.fn().mockReturnValue(new Promise<FakeWakeLockSentinel>((resolve) => {
      resolveRequest = resolve;
    }));
    const sentinel = new FakeWakeLockSentinel();
    setWakeLock(request);
    await mount();

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => resolveRequest(sentinel));

    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });
});
