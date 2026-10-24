// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TimerPenaltyActions, shouldIgnoreTimerTarget } from '@cuberoot/timer-ui';
import type { NetPenalty } from '@cuberoot/shared/timer';

let host: HTMLDivElement;
let root: Root;
let style: HTMLStyleElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
  style = document.createElement('style');
  style.textContent = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/timer-penalty-actions.css')), 'utf8');
  document.head.append(style);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); style.remove(); vi.unstubAllGlobals();
});

it.each(['en', 'zh'] as const)('shares controlled penalty selection and input-safe touch targets in %s', async (language) => {
  const onChange = vi.fn();
  const draw = (value: NetPenalty, disabled = false) => act(async () => root.render(
    createElement(TimerPenaltyActions, { language, value, disabled, onChange }),
  ));
  await draw('ok');
  const buttons = [...host.querySelectorAll('button')];
  expect(buttons.map((button) => button.textContent)).toEqual(['OK', '+2', 'DNF']);
  expect(host.querySelector('[role="group"]')?.getAttribute('aria-label'))
    .toBe(language === 'zh' ? '罚时' : 'Penalty');
  for (const button of buttons) {
    expect(getComputedStyle(button).minHeight).toBe('44px');
    expect(shouldIgnoreTimerTarget(button)).toBe(true);
  }
  await act(async () => buttons[1].click());
  expect(onChange).toHaveBeenCalledWith('+2');
  expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
  await draw('+2');
  expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  await draw('dnf', true);
  await act(async () => buttons[0].click());
  expect(onChange).toHaveBeenCalledOnce();
  expect(buttons.every((button) => button.disabled)).toBe(true);
});

it('allows local penalties to switch exclusively and clear back to OK', async () => {
  const onChange = vi.fn();
  const draw = (value: NetPenalty) => act(async () => root.render(
    createElement(TimerPenaltyActions, { language: 'zh', value, toggleOnly: true, onChange }),
  ));
  await draw('ok');
  const buttons = [...host.querySelectorAll('button')];
  expect(buttons.map(button => button.textContent)).toEqual(['+2', 'DNF']);
  for (const value of ['+2', 'dnf'] as const) {
    await draw('ok');
    expect(buttons.map(button => button.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
    const index = value === '+2' ? 0 : 1;
    await act(async () => buttons[index].click());
    expect(onChange).toHaveBeenLastCalledWith(value);
    await draw(value);
    expect(buttons.map(button => button.getAttribute('aria-pressed')))
      .toEqual(buttons.map((_, i) => String(i === index)));
    await act(async () => buttons[1 - index].click());
    expect(onChange).toHaveBeenLastCalledWith(value === '+2' ? 'dnf' : '+2');
    await act(async () => buttons[index].click());
    expect(onChange).toHaveBeenLastCalledWith('ok');
  }
});
