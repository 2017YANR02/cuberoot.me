// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerBattleSettings } from '@cuberoot/timer-ui';

it('records keys before timer bindings, cancels on Escape, and delegates supported settings', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); const root = createRoot(host);
  const assign = vi.fn(); const close = vi.fn(); const change = vi.fn(); const timerKey = vi.fn();
  window.addEventListener('keydown', timerKey);
  try {
    await act(async () => root.render(createElement(TimerBattleSettings, {
      language: 'en', keys: ['a', ' '], onKeyChange: assign, onClose: close,
      precision: { value: 3, options: [2, 3], onChange: change },
    })));
    const buttons = document.querySelectorAll<HTMLButtonElement>('.timer-battle-key-bindings button');
    await act(async () => buttons[0].click());
    await act(async () => buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(close).not.toHaveBeenCalled(); expect(assign).not.toHaveBeenCalled();
    await act(async () => buttons[1].click());
    await act(async () => buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true })));
    expect(assign).toHaveBeenCalledExactlyOnceWith(1, 'q'); expect(timerKey).not.toHaveBeenCalled();
    const select = document.querySelector('select')!;
    expect([...select.options].map((option) => option.value)).toEqual(['2', '3']);
    await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(change).toHaveBeenCalledWith(2);
  } finally {
    window.removeEventListener('keydown', timerKey); await act(async () => root.unmount()); vi.unstubAllGlobals();
  }
});
