// @vitest-environment jsdom
import { act, createElement, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCalendarSwipe } from '@/app/[lang]/calendar/_lib/useCalendarSwipe';

let host: HTMLDivElement;
let root: Root;
let controls: ReturnType<typeof useCalendarSwipe>;
const previous = vi.fn();
const next = vi.fn();
let frames: Map<number, FrameRequestCallback>;
let sequence: number;
let motions: { element: HTMLElement; frames: Keyframe[]; animation: Animation; finish: () => void }[];

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  controls = useCalendarSwipe(ref, previous, next);
  return createElement('div', { ref, className: 'cal-grid' },
    createElement('div', { className: 'cal-swipe-content' },
      createElement('div', { className: 'fc-scroller', id: 'original-timegrid' }, 'old date')));
}
function touch(type: string, x: number) {
  const point = { identifier: 1, clientX: x, clientY: 200 };
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' || type === 'touchcancel' ? [] : [point] },
    changedTouches: { value: [point] },
  });
  host.querySelector('.cal-swipe-content')!.dispatchEvent(event);
}
function paint() {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(callback => callback(performance.now()));
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  Object.defineProperty(document, 'timeline', { configurable: true, value: { currentTime: 1250 } });
  frames = new Map(); sequence = 0; motions = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++sequence, cb); return sequence; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(390);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
  vi.stubGlobal('Animation', class {});
  HTMLElement.prototype.animate = vi.fn(function (this: HTMLElement, keyframes: Keyframe[]) {
    let finish!: () => void;
    const animation = { finished: new Promise<void>(resolve => { finish = resolve; }), cancel: vi.fn(), startTime: null } as unknown as Animation;
    motions.push({ element: this, frames: keyframes, animation, finish });
    return animation;
  });
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(Harness)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  Reflect.deleteProperty(document, 'timeline');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks();
});

it('keeps the scrolled old page until the new DOM is ready, then moves both pages together', async () => {
  const scroller = host.querySelector<HTMLElement>('.fc-scroller')!;
  scroller.scrollTop = 420;
  touch('touchstart', 300);
  touch('touchmove', 100);
  paint();
  expect(host.querySelector<HTMLElement>('[data-swipe-snapshot] .fc-scroller')!.scrollTop).toBe(420);
  expect(host.querySelectorAll('#original-timegrid')).toHaveLength(1);
  await act(async () => touch('touchend', 100));
  expect(next).toHaveBeenCalledTimes(1);
  expect(motions).toHaveLength(0); // 日期尚未提交，不能先滑空旧页。
  expect(host.querySelectorAll('[data-swipe-snapshot]')).toHaveLength(2);
  const incoming = host.querySelector<HTMLElement>('.cal-swipe-content:not([data-swipe-snapshot])')!;
  expect(incoming.style.opacity).toBe('0');
  incoming.textContent = 'new date';
  controls.onPageReady(); paint();
  expect(motions).toHaveLength(2);
  expect(motions[0].element.textContent).toBe('old date');
  expect(motions[1].element.textContent).toBe('new date');
  expect(motions[0].animation.startTime).toBe(motions[1].animation.startTime);
  expect(motions[0].animation.startTime).toBe(1250);
  expect(motions[0].frames[0].transform).toBe('translate3d(-200px,0,0)');
  expect(motions[1].frames[0].transform).toBe('translate3d(190px,0,0)');
  await act(async () => motions[1].finish());
  expect(host.querySelectorAll('[data-swipe-snapshot]')).toHaveLength(0);
  expect(incoming.style.opacity).toBe('');
  expect(incoming.style.transform).toBe('');
});

it('snaps a short swipe back without navigating and removes its snapshot', async () => {
  touch('touchstart', 300); touch('touchmove', 270); paint(); touch('touchend', 270);
  expect(next).not.toHaveBeenCalled(); expect(previous).not.toHaveBeenCalled();
  expect(motions).toHaveLength(1);
  await act(async () => motions[0].finish());
  expect(host.querySelectorAll('[data-swipe-snapshot]')).toHaveLength(0);
});

it('cleans pending page snapshots on unmount and does not animate a late ready notification', async () => {
  touch('touchstart', 300); touch('touchmove', 100); paint();
  await act(async () => touch('touchend', 100));
  const container = host.firstElementChild!;
  await act(async () => root.render(null));
  controls.onPageReady(); paint();
  expect(container.querySelectorAll('[data-swipe-snapshot]')).toHaveLength(0);
  expect(motions).toHaveLength(0);
});

it('respects reduced motion without cloning or waiting for an animation', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  touch('touchstart', 100); touch('touchmove', 300); paint();
  await act(async () => touch('touchend', 300));
  expect(previous).toHaveBeenCalledTimes(1);
  expect(motions).toHaveLength(0);
  expect(host.querySelectorAll('[data-swipe-snapshot]')).toHaveLength(0);
  expect(Number.isFinite(controls.ignoreTapUntil.current)).toBe(true);
});
