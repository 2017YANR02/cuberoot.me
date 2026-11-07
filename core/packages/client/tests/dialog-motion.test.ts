// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDialogMotion } from '@cuberoot/timer-ui/dialog-motion';
let host: HTMLDivElement, root: Root;
let reduced: boolean, finishes: (() => void)[], frames: Keyframe[][];
function Dialog({ onClose }: { onClose(): void }) {
  const { motionRef, close } = useDialogMotion(onClose);
  return createElement('div', { ref: motionRef }, createElement('section', null,
    createElement('button', { onClick: close }, 'close')));
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  reduced = false; finishes = []; frames = [];
  vi.stubGlobal('matchMedia', () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }));
  Element.prototype.animate = vi.fn((keyframes) => {
    frames.push(keyframes as Keyframe[]);
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    finishes.push(finish);
    return { finished, cancel: finish } as unknown as Animation;
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
it('cancels a pending exit on unmount without invoking stale callbacks', async () => {
  const close = vi.fn();
  await act(async () => root.render(createElement(Dialog, { onClose: close })));
  await act(async () => host.querySelector('button')!.click());
  await act(async () => root.render(null));
  await act(async () => finishes.forEach(finish => finish()));
  expect(close).not.toHaveBeenCalled();
});
