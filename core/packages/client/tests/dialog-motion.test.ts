// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDialogMotion } from '@cuberoot/timer-ui/dialog-motion';
let host: HTMLDivElement, root: Root;
let reduced: boolean, finishes: (() => void)[], frames: Keyframe[][], cancels: ReturnType<typeof vi.fn>[];
function Dialog({ onClose, drawer = false, curtain = false, duration, onCloseStart }: { onClose(): void; drawer?: boolean; curtain?: boolean; duration?: number; onCloseStart?: () => void }) {
  const { motionRef, close, isClosing } = useDialogMotion(onClose, { drawer, curtain, duration, onCloseStart });
  return createElement('div', { ref: motionRef }, createElement('section', null,
    createElement('button', { onClick: close, 'data-closing': isClosing }, 'close')));
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  reduced = false; finishes = []; frames = []; cancels = [];
  vi.stubGlobal('matchMedia', () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }));
  Element.prototype.animate = vi.fn((keyframes) => {
    frames.push(keyframes as Keyframe[]);
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    finishes.push(finish);
    const cancel = vi.fn(finish);
    cancels.push(cancel);
    return { finished, cancel } as unknown as Animation;
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  delete (Element.prototype as Partial<Element>).animate; vi.unstubAllGlobals();
});
it('waits for exit, coalesces close requests, and never fades or filters glass ancestors', async () => {
  const close = vi.fn();
  await act(async () => root.render(createElement(Dialog, { onClose: close })));
  await act(async () => { host.querySelector('button')!.click(); host.querySelector('button')!.click(); });
  expect(close).not.toHaveBeenCalled();
  expect(host.querySelector('section')).not.toBeNull();
  expect(frames.flat().every(frame => !('opacity' in frame) && !('filter' in frame))).toBe(true);
  await act(async () => finishes.forEach(finish => finish()));
  expect(close).toHaveBeenCalledTimes(1);
});
it('dismisses immediately for reduced motion', async () => {
  reduced = true; const close = vi.fn();
  await act(async () => root.render(createElement(Dialog, { onClose: close })));
  await act(async () => host.querySelector('button')!.click());
  expect(close).toHaveBeenCalledTimes(1); expect(frames).toHaveLength(0);
});
it('slides drawers horizontally and keeps them mounted through the longer exit', async () => {
  vi.useFakeTimers();
  try {
    const close = vi.fn();
    await act(async () => root.render(createElement(Dialog, { onClose: close, drawer: true })));
    expect(frames[0]).toEqual([{ translate: '-100% 0', scale: '1' }, { translate: '0 0', scale: '1' }]);
    await act(async () => host.querySelector('button')!.click());
    expect(frames[2]).toEqual([...frames[0]].reverse());
    await act(async () => vi.advanceTimersByTime(240));
    expect(close).not.toHaveBeenCalled();
    await act(async () => finishes.forEach(finish => finish()));
    expect(close).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});
it('holds the final exit frame until the owner removes the dialog', async () => {
  const close = vi.fn();
  await act(async () => root.render(createElement(Dialog, { onClose: close })));
  await act(async () => host.querySelector('button')!.click());
  const exitCancels = cancels.slice(-2);
  await act(async () => finishes.forEach(finish => finish()));
  expect(close).toHaveBeenCalledTimes(1);
  expect(exitCancels.every(cancel => cancel.mock.calls.length === 0)).toBe(true);
  await act(async () => host.querySelector('button')!.click());
  expect(close).toHaveBeenCalledTimes(1);
  await act(async () => root.render(null));
  expect(exitCancels.every(cancel => cancel.mock.calls.length === 1)).toBe(true);
});
it('cancels a pending exit on unmount without invoking stale callbacks', async () => {
  const close = vi.fn();
  await act(async () => root.render(createElement(Dialog, { onClose: close })));
  await act(async () => host.querySelector('button')!.click());
  await act(async () => root.render(null));
  await act(async () => finishes.forEach(finish => finish()));
  expect(close).not.toHaveBeenCalled();
});

it('reveals a curtain downwards and preserves its full custom exit for the icon morph', async () => {
  vi.useFakeTimers();
  try {
    const close = vi.fn();
    await act(async () => root.render(createElement(Dialog, { onClose: close, curtain: true, duration: 420 })));
    expect(frames[0]).toEqual([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }]);
    await act(async () => host.querySelector('button')!.click());
    expect(host.querySelector('button')!.dataset.closing).toBe('true');
    expect(frames[2]).toEqual([...frames[0]].reverse());
    await act(async () => vi.advanceTimersByTime(420));
    expect(close).not.toHaveBeenCalled();
    await act(async () => finishes.forEach(finish => finish()));
    expect(close).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});

it('notifies the owner once at exit start so toolbar restoration does not restart at unmount', async () => {
  const close = vi.fn(), start = vi.fn();
  await act(async () => root.render(createElement(Dialog, { onClose: close, onCloseStart: start, curtain: true, duration: 650 })));
  expect(start).not.toHaveBeenCalled();
  await act(async () => { host.querySelector('button')!.click(); host.querySelector('button')!.click(); });
  expect(start).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  await act(async () => finishes.forEach(finish => finish()));
  expect(close).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
});
