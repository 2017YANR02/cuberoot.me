// @vitest-environment jsdom
import { act, createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimingSurface, SegmentTime } from '@cuberoot/timer-ui';

describe('shared timer complete-readout fitting', () => {
  let host: HTMLDivElement, root: Root;
  let notify: ResizeObserverCallback;
  let frames: FrameRequestCallback[];
  let available: number, natural: number;
  const disconnect = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    frames = []; available = 320; natural = 600;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { notify = callback; }
      observe() {}
      disconnect = disconnect;
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('timing-surface-core') ? available : 0; });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { width: natural * (Number(this.style.getPropertyValue('--timer-readout-fit')) || 1) } as DOMRect;
    });
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const render = (text: string) => act(async () => root.render(createElement(TimingSurface, {
    phase: 'stopped', colorClass: '', fontSize: '100px', surfaceRef: createRef<HTMLDivElement>(),
    digits: createElement(SegmentTime, { text }),
  })));
  const fit = () => Number(host.querySelector<HTMLElement>('.timer-display-value')!.style.getPropertyValue('--timer-readout-fit')) || 1;
  const resize = async () => act(async () => { notify([], {} as ResizeObserver); const pending = frames.splice(0); pending.forEach((callback) => callback(0)); });

  it.each(['48:13.98', '1:48:13.982', '1:48:13.982+'])('shrinks the complete %s while retaining every digit and punctuation node', async (text) => {
    await render(text);
    expect(fit()).toBe(0.53);
    expect(host.querySelector('.timer-display-value')!.textContent).toBe(text.replaceAll(':', ''));
    expect(host.querySelectorAll('.timer-colon')).toHaveLength(text.split(':').length - 1);
  });
  it('grows back to the requested size for a shorter time and refits on rotation/font-width changes', async () => {
    await render('48:13.98'); expect(fit()).toBe(0.53);
    natural = 150; await render('0.00'); await resize(); expect(fit()).toBe(1);
    natural = 400; available = 200; await resize(); expect(fit()).toBe(0.495);
    available = 800; await resize(); expect(fit()).toBe(1);
  });
  it('does no per-tick fitting and cancels a queued resize when unmounted', async () => {
    await render('12.34');
    const measurements = vi.mocked(HTMLElement.prototype.getBoundingClientRect).mock.calls.length;
    await render('12.35');
    expect(vi.mocked(HTMLElement.prototype.getBoundingClientRect).mock.calls.length).toBe(measurements);
    notify([], {} as ResizeObserver);
    await act(async () => root.render(null));
    expect(disconnect).toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it('does not chase fractional font-layout rounding on its own resize notification', async () => {
    await render('48:13.98');
    const initial = fit();
    // Real glyph and colon spans are rounded separately by browser layout.
    // The old ratio-only tolerance oscillated at 60fps for a 375px viewport.
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(() => ({ width: 317.984375 }) as DOMRect);
    await resize();
    expect(fit()).toBe(initial);
    await resize();
    expect(fit()).toBe(initial);
  });

  it('blocks native readout and scramble menus while preserving pointer input and text fields', async () => {
    const down = vi.fn();
    const up = vi.fn();
    await act(async () => root.render(createElement(TimingSurface, {
      phase: 'idle', colorClass: '', fontSize: '100px', surfaceRef: createRef<HTMLDivElement>(),
      digits: createElement(SegmentTime, { text: '1:23.45' }),
      onPointerDown: down, onPointerUp: up,
      scrambleSlot: createElement('span', { className: 'scramble-moves' }, 'R U'),
      children: createElement('textarea', { 'data-no-timer': true }),
    })));
    const colon = host.querySelector('.timer-colon')!;
    const moves = host.querySelector('.scramble-moves')!;
    const input = host.querySelector('textarea')!;
    for (const type of ['touchstart', 'selectstart', 'contextmenu']) {
      for (const target of [colon, moves]) {
        expect(target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))).toBe(false);
      }
      expect(input.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))).toBe(true);
    }
    colon.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    colon.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
    expect(down).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledTimes(1);
    const stripAction = vi.fn();
    const strip = moves.parentElement!;
    strip.setAttribute('data-interactive', 'true');
    strip.addEventListener('click', stripAction);
    expect(moves.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }))).toBe(true);
    moves.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(stripAction).toHaveBeenCalledTimes(1);
    expect(moves.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }))).toBe(false);
    await act(async () => root.render(null));
    expect(colon.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }))).toBe(true);
  });
});
