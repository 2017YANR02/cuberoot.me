// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerSettingsPanel } from '@cuberoot/timer-ui';

it.each([false, true])('restores settings trigger focus only for keyboard entry (%s)', async (keyboard) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const trigger = document.createElement('button');
  document.body.append(container, trigger);
  const root = createRoot(container);
  const matches = vi.spyOn(trigger, 'matches').mockImplementation(selector => selector === ':focus-visible' && keyboard);
  trigger.focus();
  try {
    await act(async () => root.render(<TimerSettingsPanel language="en" activeCategory="timer"
      onCategoryChange={() => undefined} onClose={() => undefined}>{null}</TimerSettingsPanel>));
    expect(document.activeElement?.getAttribute('role')).toBe('dialog');
    await act(async () => root.render(null));
    expect(document.activeElement).toBe(keyboard ? trigger : document.body);
    expect(document.body.style.overflow).not.toBe('hidden');
  } finally {
    await act(async () => root.unmount());
    matches.mockRestore();
    container.remove();
    trigger.remove();
  }
});
