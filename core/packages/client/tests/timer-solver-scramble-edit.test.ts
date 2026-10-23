// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import TimerSolverBody from '@cuberoot/timer-ui/TimerSolverBody';

vi.mock('@cuberoot/timer-ui/StageSolver', () => ({ default: ({ scramble }: { scramble: string }) =>
  createElement('div', { 'data-solver-scramble': scramble }) }));

let host: HTMLDivElement;
let root: Root;
let dismiss: (() => boolean) | null;
const applied = vi.fn();
const blocking = vi.fn();
const registerDismiss = (callback: (() => boolean) | null) => { dismiss = callback; };
function Harness() {
  const [scramble, setScramble] = useState('R U F');
  return createElement(TimerSolverBody, { scramble, language: 'en', compact: true,
    onScrambleChange: value => { applied(value); setScramble(value); },
    onDismissChange: registerDismiss, onBlockingChange: blocking });
}
const click = async (label: string) => {
  await act(async () => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
};
const input = async (value: string) => {
  const textarea = host.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  applied.mockClear(); blocking.mockClear(); dismiss = null;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(Harness)));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('edits in place and applies to the solver only after confirmation', async () => {
  await click('Edit scramble');
  expect(document.activeElement).toBe(host.querySelector('textarea'));
  expect(host.querySelector('textarea')!.value).toBe('R U F');
  expect(blocking).toHaveBeenLastCalledWith(true);
  await input("  F2 R' U  ");
  expect(applied).not.toHaveBeenCalled();
  expect(host.querySelector('[data-solver-scramble]')!.getAttribute('data-solver-scramble')).toBe('R U F');
  await click('Apply scramble');
  expect(applied).toHaveBeenCalledExactlyOnceWith("F2 R' U");
  expect(host.querySelector('[data-solver-scramble]')!.getAttribute('data-solver-scramble')).toBe("F2 R' U");
  expect(host.querySelector('textarea')).toBeNull();
  expect(blocking).toHaveBeenLastCalledWith(false);
});

it('cancels drafts with the button or parent dismissal without changing the scramble', async () => {
  await click('Edit scramble'); await input('L2 D'); await click('Cancel');
  expect(applied).not.toHaveBeenCalled();
  await click('Edit scramble');
  expect(host.querySelector('textarea')!.value).toBe('R U F');
  await input('B2');
  await act(async () => { expect(dismiss?.()).toBe(true); });
  expect(host.querySelector('textarea')).toBeNull();
  expect(applied).not.toHaveBeenCalled();
});

it('rejects blank input and supports Enter without letting it reach the timer', async () => {
  await click('Edit scramble'); await input('   ');
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Apply scramble"]')!.disabled).toBe(true);
  const enter = async () => act(async () => {
    host.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  });
  await enter(); expect(applied).not.toHaveBeenCalled();
  await input('L U2'); await enter();
  expect(applied).toHaveBeenCalledExactlyOnceWith('L U2');
});
