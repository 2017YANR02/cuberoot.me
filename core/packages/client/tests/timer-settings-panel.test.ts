// @vitest-environment jsdom
import { act, createElement, Fragment, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerSettingsPanel } from '@cuberoot/timer-ui';
import type { TimerSettingCategoryId } from '@cuberoot/shared/timer';

it.each(['en', 'zh'] as const)('shares rail/dropdown selection, dismissal and focus restoration (%s)', async language => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const close = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState<TimerSettingCategoryId>('timer');
    return createElement(Fragment, null,
      createElement('button', { onClick: () => setOpen(true) }, 'Open'),
      open && createElement(TimerSettingsPanel, {
        language, activeCategory: category, onCategoryChange: setCategory,
        categories: ['timer', 'appearance', 'data'], onClose: () => { close(); setOpen(false); },
        children: createElement('input', { 'aria-label': 'Value', key: category, defaultValue: category }),
      }),
    );
  }
  try {
    await act(async () => root.render(createElement(Harness)));
    const trigger = host.querySelector('button')!;
    trigger.focus();
    await act(async () => trigger.click());
    const dialog = document.querySelector<HTMLElement>('.settings-modal')!;
    expect(document.activeElement).toBe(dialog);
    expect(document.body.style.overflow).toBe('hidden');
    const select = dialog.querySelector<HTMLSelectElement>('select')!;
    expect([...select.options].map(option => option.value)).toEqual(['timer', 'appearance', 'data']);
    const nav = dialog.querySelectorAll<HTMLButtonElement>('.settings-category-button');
    await act(async () => nav[1].click());
    expect(select.value).toBe('appearance');
    expect(dialog.querySelector('input')!.value).toBe('appearance');
    const main = dialog.querySelector('.settings-main')!;
    main.scrollTop = 200;
    await act(async () => { select.value = 'data'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(nav[2].getAttribute('aria-current')).toBe('page');
    expect(main.scrollTop).toBe(0);
    expect(dialog.querySelector('input')!.value).toBe('data');
    const overlay = document.querySelector('.timer-settings-overlay')!;
    // A drag that starts in the dialog must not dismiss on release outside.
    await act(async () => {
      dialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(close).not.toHaveBeenCalled();
    await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(close).toHaveBeenCalledOnce();
    expect(document.querySelector('.settings-modal')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe('hidden');
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
