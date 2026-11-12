// @vitest-environment jsdom
import { act, createElement, createRef, Profiler, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import ChatBubble from '@/components/ChatBubble';

afterEach(() => { vi.unstubAllGlobals(); });

it('updates its outline after resizing without a feedback loop, and disconnects on unmount', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const observers: { notify: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn();
    constructor(callback: () => void) { observers.push({ notify: callback, disconnect: this.disconnect }); }
    observe() {}
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const ref = createRef<HTMLDivElement>();
  let commits = 0;
  try {
    await act(async () => root.render(createElement(StrictMode, null,
      createElement(Profiler, { id: 'bubble', onRender: () => { commits++; } },
        createElement(ChatBubble, { ref, tail: 'top', style: { width: 200, height: 40 }, children: 'A message' })))));
    expect(ref.current).toBe(host.firstElementChild);
    expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 216 56');
    expect(host.querySelectorAll('svg path')).toHaveLength(1);
    const initialPath = host.querySelector('path')!.getAttribute('d');
    const observer = observers.at(-1)!;
    ref.current!.style.width = '120px';
    ref.current!.style.height = '80px';
    await act(async () => observer.notify());
    expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 136 96');
    expect(host.querySelector('path')!.getAttribute('d')).not.toBe(initialPath);
    const stableCommits = commits;
    for (let i = 0; i < 20; i++) await act(async () => observer.notify());
    expect(commits).toBe(stableCommits);
    expect(commits).toBeLessThan(6);
  } finally {
    await act(async () => root.unmount());
    expect(ref.current).toBeNull();
    expect(observers.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true);
    // A callback already queued at cleanup cannot write to the detached component.
    await act(async () => { for (const observer of observers) observer.notify(); });
    host.remove();
  }
});
