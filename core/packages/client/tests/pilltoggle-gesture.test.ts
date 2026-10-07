// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PillToggle from '@/components/PillToggle/PillToggle';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function pointer(button: HTMLButtonElement, type: string, clientX = 0) {
  await act(async () => { button.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX })); });
}
async function click(button: HTMLButtonElement, detail = 1) {
  await act(async () => { button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail })); });
}

it('keeps a dismissing switch mounted until the compatibility click is consumed', async () => {
  function Overlay() {
    const [visible, setVisible] = useState(true);
    return visible ? createElement(PillToggle, { value: visible, onChange: setVisible }) : null;
  }
  await act(async () => root.render(createElement(Overlay)));
  const button = host.querySelector('button')!;
  await pointer(button, 'pointerdown');
  await pointer(button, 'pointerup');
  expect(button.isConnected).toBe(true);
  await click(button);
  expect(host.childElementCount).toBe(0);
});

it('commits the drag destination only on click and does not toggle it again', async () => {
  const onChange = vi.fn();
  await act(async () => root.render(createElement(PillToggle, { value: true, onChange })));
  const button = host.querySelector('button')!;
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 50 } as DOMRect);
  await pointer(button, 'pointerdown', 40);
  await pointer(button, 'pointermove', 5);
  await pointer(button, 'pointerup', 5);
  expect(onChange).not.toHaveBeenCalled();
  await click(button);
  expect(onChange.mock.calls).toEqual([[false]]);
});

it('ignores cancelled gestures and supports keyboard activation', async () => {
  const onChange = vi.fn();
  await act(async () => root.render(createElement(PillToggle, { value: true, onChange })));
  const button = host.querySelector('button')!;
  await pointer(button, 'pointerdown');
  await pointer(button, 'pointercancel');
  await click(button);
  expect(onChange).not.toHaveBeenCalled();
  await click(button, 0);
  expect(onChange.mock.calls).toEqual([[false]]);
});
