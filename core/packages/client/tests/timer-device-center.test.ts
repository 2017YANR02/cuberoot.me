// @vitest-environment jsdom

import { TimerDeviceCenter } from '@cuberoot/timer-ui';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('TimerDeviceCenter', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('only renders registered items and invokes the selected host action', async () => {
    const onSmartCube = vi.fn();
    const onStackmat = vi.fn();
    await act(async () => root.render(createElement(TimerDeviceCenter, {
      ariaLabel: 'Timer devices',
      items: [
        { id: 'smart-cube', kind: 'smart-cube', label: 'Smart cube', onSelect: onSmartCube },
        { id: 'stackmat', kind: 'stackmat', label: 'Stackmat', onSelect: onStackmat },
      ],
      menuLabel: 'Available timer devices',
      triggerLabel: 'Devices',
    })));

    const trigger = document.body.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    expect(document.body.textContent).not.toContain('Smart cube');
    await act(async () => trigger.click());
    expect(document.body.textContent).toContain('Smart cube');
    expect(document.body.textContent).toContain('Stackmat');

    const item = [...document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((button) => button.textContent?.includes('Smart cube'))!;
    await act(async () => item.click());
    expect(onSmartCube).toHaveBeenCalledOnce();
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(onStackmat).not.toHaveBeenCalled();
  });

  it('closes on Escape and outside pointer-down, returning focus to the trigger', async () => {
    await act(async () => root.render(createElement(TimerDeviceCenter, {
      ariaLabel: 'Timer devices',
      items: [{ id: 'smart-cube', kind: 'smart-cube', label: 'Smart cube', onSelect: vi.fn() }],
      menuLabel: 'Available timer devices',
      triggerLabel: 'Devices',
    })));

    const trigger = document.body.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    await act(async () => trigger.click());
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => trigger.click());
    await act(async () => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });
});
