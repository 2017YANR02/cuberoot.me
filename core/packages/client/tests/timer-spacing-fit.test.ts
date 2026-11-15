// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { TimerWorkspace } from '@cuberoot/timer-ui';
import { DEFAULT_SOLO_LAYOUT } from '@cuberoot/shared/timer';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('fits saved whitespace across rotation/resizing, restores it when room returns and ignores its own observer feedback', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let height = 900, content = 500;
  const callbacks: ResizeObserverCallback[] = [], frames: FrameRequestCallback[] = [];
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
    observe() {}
    disconnect = disconnect;
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const properties = ['scramble', 'source', 'timer', 'cube'].map(key => `--solo-${key}-gap`);
  const whitespace = (element: HTMLElement) => properties.reduce((sum, key) => sum + (parseFloat(element.style.getPropertyValue(key)) || 0), 0);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) { return Math.max(height, content + whitespace(this)); });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width: 440, height }) as DOMRect);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const layout = Object.freeze({ ...DEFAULT_SOLO_LAYOUT, scrambleGap: 150, sourceGap: 16, timerGap: 119, cubeGap: 175 });
  const draw = (active: boolean) => act(async () => root.render(h(TimerWorkspace, { soloLayout: layout, active }, h('div', { className: 'timer-solo-main' }))));
  const resize = () => act(async () => {
    callbacks.forEach(callback => callback([], {} as ResizeObserver));
    const batch = frames.splice(0); batch.forEach(callback => callback(0));
  });
  try {
    await draw(true);
    const stage = host.querySelector<HTMLElement>('.timer-solo-main')!;
    expect(stage.scrollHeight).toBe(height);
    expect(whitespace(stage)).toBeLessThan(460);
    height = 640; await resize();
    expect(stage.scrollHeight).toBe(640);
    height = 1100; await resize();
    expect(whitespace(stage)).toBe(460);
    const writes = vi.spyOn(stage.style, 'setProperty');
    for (let i = 0; i < 5; i++) await resize();
    expect(writes).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);
    content = 1200; await resize();
    expect(whitespace(stage)).toBe(0);
    expect(stage.scrollHeight).toBe(1200); // Full content stays scrollable.
    await draw(false);
    expect(properties.every(key => stage.style.getPropertyValue(key) === '')).toBe(true);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(layout.scrambleGap).toBe(150);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
