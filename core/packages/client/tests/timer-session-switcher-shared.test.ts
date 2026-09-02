// @vitest-environment jsdom

import {
  TIMER_SESSION_UI_COPY,
  timerSessionClearConfirmation,
  timerSessionDeleteConfirmation,
  type TimerSessionMeta,
} from '@cuberoot/shared/timer';
import {
  TIMER_OVERLAY_IDS,
  TimerSessionSwitcher,
  type TimerSessionSwitcherHost,
  type TimerSessionSwitcherLabels,
} from '@cuberoot/timer-ui';
import { act, createElement, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const labels: TimerSessionSwitcherLabels = {
  ...Object.fromEntries(
    Object.entries(TIMER_SESSION_UI_COPY).map(([key, copy]) => [key, copy.en]),
  ) as unknown as Omit<TimerSessionSwitcherLabels, 'clearConfirmation' | 'deleteConfirmation'>,
  clearConfirmation: (name) => timerSessionClearConfirmation(name).en,
  deleteConfirmation: (name) => timerSessionDeleteConfirmation(name).en,
};

const sessions: TimerSessionMeta[] = [
  { id: 'a', name: 'A very long primary session name that must not widen the viewport', createdTs: 1 },
  { id: 'b', name: 'Pocket', createdTs: 2, event: '222' },
];

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('shared TimerSessionSwitcher interaction contract', () => {
  let container: HTMLDivElement;
  let root: Root;
  let host: TimerSessionSwitcherHost;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 320 });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 568 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('tsession-trigger')) {
        return {
          x: 12, y: 40, left: 12, top: 40, right: 308, bottom: 76,
          width: 296, height: 36, toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0,
        width: 0, height: 0, toJSON: () => ({}),
      } as DOMRect;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    host = {
      activate: vi.fn(),
      create: vi.fn(),
      rename: vi.fn(),
      clear: vi.fn(),
      delete: vi.fn(),
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.querySelectorAll('.tsession-panel').forEach((panel) => panel.remove());
    vi.restoreAllMocks();
  });

  async function render(overrides: Partial<Parameters<typeof TimerSessionSwitcher>[0]> = {}) {
    await act(async () => root.render(createElement(TimerSessionSwitcher, {
      activeSessionId: 'a',
      event: '333',
      host,
      labels,
      sessions,
      ...overrides,
    })));
  }

  async function openMenu() {
    const trigger = container.querySelector<HTMLButtonElement>('.tsession-trigger')!;
    await act(async () => trigger.click());
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    return { trigger, panel: document.querySelector<HTMLDivElement>('.tsession-panel')! };
  }

  it('portals and clamps the dropdown at 320px without document overflow', async () => {
    await render({ viewportBottomInset: 64 });
    const { panel } = await openMenu();
    expect(container.contains(panel)).toBe(false);
    expect(panel.parentElement).toBe(document.body);
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-label')).toBe('Sessions');
    expect(Number.parseFloat(panel.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(panel.style.left) + Number.parseFloat(panel.style.width)).toBeLessThanOrEqual(312);
    expect(Number.parseFloat(panel.style.top) + Number.parseFloat(panel.style.maxHeight)).toBeLessThanOrEqual(496);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    expect(document.activeElement?.getAttribute('data-session-active')).toBe('true');
  });

  it('closes only the top session overlay on the first mobile Escape', async () => {
    function NestedMobilePanels() {
      const [parentOpen, setParentOpen] = useState(true);
      const [sessionOpen, setSessionOpen] = useState(true);
      useEffect(() => {
        if (!parentOpen || sessionOpen) return;
        const closeParent = (event: KeyboardEvent) => {
          if (event.key === 'Escape') setParentOpen(false);
        };
        window.addEventListener('keydown', closeParent);
        return () => window.removeEventListener('keydown', closeParent);
      }, [parentOpen, sessionOpen]);
      return createElement('div', {
        'data-parent-open': String(parentOpen),
      }, createElement(TimerSessionSwitcher, {
        activeSessionId: 'a',
        event: '333',
        host,
        labels,
        onOpenChange: setSessionOpen,
        open: sessionOpen,
        sessions,
      }));
    }

    await act(async () => root.render(createElement(NestedMobilePanels)));
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
    })));
    expect(container.firstElementChild?.getAttribute('data-parent-open')).toBe('true');
    expect(document.querySelector('.tsession-panel')).toBeNull();

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
    })));
    expect(container.firstElementChild?.getAttribute('data-parent-open')).toBe('false');
  });

  it('waits for async activation, blocks duplicate submits, then closes and restores focus', async () => {
    const pending = deferred();
    host.activate = vi.fn(() => pending.promise);
    await render();
    const { trigger, panel } = await openMenu();
    const pocket = Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-session-id]'))
      .find((button) => button.dataset.sessionId === 'b')!;

    await act(async () => {
      pocket.click();
      pocket.click();
    });
    expect(host.activate).toHaveBeenCalledTimes(1);
    expect(panel.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(panel);
    await act(async () => panel.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'Tab',
    })));
    expect(document.activeElement).toBe(panel);
    expect(document.querySelector('.tsession-panel')).not.toBeNull();

    await act(async () => pending.resolve());
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(document.querySelector('.tsession-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps Tab focus inside the dialog', async () => {
    await render();
    const { panel } = await openMenu();
    const first = panel.querySelector<HTMLButtonElement>('[data-session-active="true"]')!;
    const last = panel.querySelector<HTMLButtonElement>('.tsession-add-btn')!;
    expect(document.activeElement).toBe(first);

    await act(async () => first.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'Tab', shiftKey: true,
    })));
    expect(document.activeElement).toBe(last);

    await act(async () => last.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'Tab',
    })));
    expect(document.activeElement).toBe(first);
  });

  it('keeps a failed rename open with its draft and a shared error message', async () => {
    host.rename = vi.fn(() => Promise.reject(new Error('write-failure')));
    await render();
    const { panel } = await openMenu();
    const rename = panel.querySelector<HTMLButtonElement>('button[aria-label^="Rename session:"]')!;
    expect(rename.getAttribute('aria-label')).toContain(sessions[0]!.name);
    await act(async () => rename.click());
    const input = panel.querySelector<HTMLInputElement>('input[aria-label="Session name"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '  Kept draft  ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => panel.querySelector<HTMLButtonElement>('button[aria-label="Confirm rename"]')!.click());

    expect(host.rename).toHaveBeenCalledWith('a', 'Kept draft');
    expect(document.querySelector('.tsession-panel')).not.toBeNull();
    expect(input.value).toBe('  Kept draft  ');
    expect(panel.querySelector('[role="alert"]')?.textContent).toBe(
      'Session change failed. Your existing data was kept.',
    );
  });

  it('returns focus to the renamed non-active session after success', async () => {
    await render();
    const { panel } = await openMenu();
    await act(async () => panel.querySelector<HTMLButtonElement>(
      'button[aria-label="Rename session: Pocket"]',
    )!.click());
    const input = panel.querySelector<HTMLInputElement>('input[aria-label="Session name"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Pocket 2');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => panel.querySelector<HTMLButtonElement>(
      'button[aria-label="Confirm rename"]',
    )!.click());
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });

    expect(host.rename).toHaveBeenCalledWith('b', 'Pocket 2');
    expect(document.activeElement?.getAttribute('data-session-id')).toBe('b');
  });

  it('uses the default create name, ClearButton, trim/empty behavior, and Enter', async () => {
    await render();
    const { panel } = await openMenu();
    await act(async () => panel.querySelector<HTMLButtonElement>('.tsession-add-btn')!.click());
    const input = panel.querySelector<HTMLInputElement>('input[aria-label="New session name"]')!;
    expect(input.value).toBe('New session');
    const clear = panel.querySelector<HTMLButtonElement>('button[aria-label="Clear"]')!;
    await act(async () => clear.click());
    expect(input.value).toBe('');
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, key: 'Enter',
    })));
    expect(host.create).not.toHaveBeenCalled();
    expect(panel.querySelector<HTMLInputElement>('input[aria-label="New session name"]')).toBeNull();

    await act(async () => panel.querySelector<HTMLButtonElement>('.tsession-add-btn')!.click());
    const secondInput = panel.querySelector<HTMLInputElement>('input[aria-label="New session name"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(secondInput, '  Speed  ');
      secondInput.dispatchEvent(new Event('input', { bubbles: true }));
      secondInput.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, key: 'Enter',
      }));
    });
    expect(host.create).toHaveBeenCalledWith('Speed', '333');
  });

  it('confirms clear/delete, refuses the last-session UI, and keeps cancelled actions open', async () => {
    const confirm = vi.fn(() => false);
    await render({ confirm });
    const { panel } = await openMenu();
    await act(async () => panel.querySelector<HTMLButtonElement>('button[aria-label^="Clear session solves:"]')!.click());
    expect(confirm).toHaveBeenCalledWith(
      'Clear all solves in "A very long primary session name that must not widen the viewport"? This cannot be undone.',
    );
    expect(host.clear).not.toHaveBeenCalled();
    expect(document.querySelector('.tsession-panel')).not.toBeNull();

    await act(async () => panel.querySelector<HTMLButtonElement>('button[aria-label^="Delete session:"]')!.click());
    expect(host.delete).not.toHaveBeenCalled();

    await act(async () => root.render(createElement(TimerSessionSwitcher, {
      activeSessionId: 'a', event: '333', host, labels, sessions: [sessions[0]!],
    })));
    const onlyPanel = document.querySelector<HTMLDivElement>('.tsession-panel');
    // Re-rendering controlled data does not invent a second session; if the
    // existing menu remains open, its destructive control is truly disabled.
    expect(onlyPanel?.querySelector<HTMLButtonElement>('button[aria-label^="Delete session:"]')?.disabled).toBe(true);
  });

  it('moves focus to the active session after a successful delete', async () => {
    const confirm = vi.fn(() => true);
    await render({ confirm });
    const { panel } = await openMenu();
    const pocketDelete = panel.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete session: Pocket"]',
    )!;
    await act(async () => pocketDelete.click());
    expect(host.delete).toHaveBeenCalledWith('b');

    await render({ confirm, sessions: [sessions[0]!] });
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(document.activeElement).toBe(
      document.querySelector<HTMLButtonElement>('[data-session-active="true"]'),
    );
  });

  it('closes on Escape/outside pointer and restores focus for Escape', async () => {
    await render();
    const first = await openMenu();
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, key: 'Escape',
    })));
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(document.querySelector('.tsession-panel')).toBeNull();
    expect(document.activeElement).toBe(first.trigger);

    await openMenu();
    await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(document.querySelector('.tsession-panel')).toBeNull();
  });

  it('obeys a host-controlled close for Android Back', async () => {
    const onOpenChange = vi.fn();
    await render({ onOpenChange, open: true });
    expect(document.querySelector('.tsession-panel')).not.toBeNull();

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
    })));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.sessionSwitcher,
      reason: 'escape',
    });
    expect(document.querySelector('.tsession-panel')).not.toBeNull();
    await render({ onOpenChange, open: true });

    await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      id: TIMER_OVERLAY_IDS.sessionSwitcher,
      reason: 'outside',
    });
    expect(document.querySelector('.tsession-panel')).not.toBeNull();

    await render({ onOpenChange, open: false });
    expect(document.querySelector('.tsession-panel')).toBeNull();
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(document.activeElement).toBe(container.querySelector('.tsession-trigger'));
  });
});
