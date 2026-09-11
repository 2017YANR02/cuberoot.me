// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useModalDismiss } from '@/hooks/useModalDismiss';

let host: HTMLDivElement;
let root: Root;
function Modal({ close, disabled = false }: { close: () => void; disabled?: boolean }) {
  const props = useModalDismiss(close, disabled);
  return createElement('div', { ...props, className: 'backdrop' },
    createElement('section', { role: 'dialog' }, createElement('input')));
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function pointer(target: Element, type: string, pointerType = 'mouse', button = 0) {
  const event = new MouseEvent(type, { bubbles: true, button });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  await act(async () => target.dispatchEvent(event));
}
it.each(['mouse', 'touch', 'pen'])('closes on an outside %s click but not an inside click or drag-out', async pointerType => {
  const close = vi.fn();
  await act(async () => root.render(createElement(Modal, { close })));
  const backdrop = host.firstElementChild!;
  const input = host.querySelector('input')!;
  await pointer(input, 'pointerdown', pointerType);
  await pointer(input, 'click', pointerType);
  expect(close).toHaveBeenCalledTimes(0);
  await pointer(input, 'pointerdown', pointerType);
  await pointer(backdrop, 'click', pointerType);
  expect(close).toHaveBeenCalledTimes(0);
  await pointer(backdrop, 'pointerdown', pointerType);
  await pointer(backdrop, 'click', pointerType);
  expect(close).toHaveBeenCalledTimes(1);
});
it('ignores cancelled gestures, right clicks, and gestures ending inside', async () => {
  const close = vi.fn();
  await act(async () => root.render(createElement(Modal, { close })));
  const backdrop = host.firstElementChild!;
  await pointer(backdrop, 'pointerdown');
  await pointer(backdrop, 'pointercancel');
  await pointer(backdrop, 'click');
  await pointer(backdrop, 'pointerdown', 'mouse', 2);
  await pointer(backdrop, 'click', 'mouse', 2);
  await pointer(backdrop, 'pointerdown');
  await pointer(host.querySelector('input')!, 'click');
  expect(close).toHaveBeenCalledTimes(0);
});
it('blocks outside dismissal and Escape during submission and resumes afterward', async () => {
  const close = vi.fn();
  await act(async () => root.render(createElement(Modal, { close, disabled: true })));
  const backdrop = host.firstElementChild!;
  await pointer(backdrop, 'pointerdown');
  await pointer(backdrop, 'click');
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(close).toHaveBeenCalledTimes(0);
  await act(async () => root.render(createElement(Modal, { close })));
  await pointer(backdrop, 'pointerdown');
  await pointer(backdrop, 'click');
  expect(close).toHaveBeenCalledTimes(1);
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(close).toHaveBeenCalledTimes(2);
});
