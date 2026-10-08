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

  it.each([false, true])('opens connected cube controls directly unless disabled=%s', async (disabled) => {
    const onSelect = vi.fn();
    await act(async () => root.render(createElement(TimerDeviceCenter, {
      ariaLabel: 'Timer devices',
      items: [{ id: 'smart-cube', kind: 'smart-cube', label: 'Smart cube', active: true, disabled, onSelect }],
      menuLabel: 'Available timer devices', triggerLabel: 'Devices',
    })));
    const trigger = host.querySelector<HTMLButtonElement>('.shell-device-center-trigger')!;
    expect(trigger.getAttribute('aria-haspopup')).toBe(disabled ? 'menu' : 'dialog');
    await act(async () => trigger.click());
    expect(onSelect).toHaveBeenCalledTimes(disabled ? 0 : 1);
    expect(host.querySelector('[role="menu"]') !== null).toBe(disabled);
    expect(trigger.getAttribute('aria-expanded')).toBe(disabled ? 'true' : null);
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

  it('keeps the fake-cube utility below Stackmat and reachable while a cube is connected', async () => {
    const onFakeCube = vi.fn();
    const onCube = vi.fn();
    await act(async () => root.render(createElement(TimerDeviceCenter, {
      ariaLabel: 'Timer devices', menuLabel: 'Available timer devices', triggerLabel: 'Devices',
      items: [
        { id: 'cube', kind: 'smart-cube', label: 'Smart cube', active: true, onSelect: onCube },
        { id: 'stackmat', kind: 'stackmat', label: 'Stackmat', onSelect: vi.fn() },
        { id: 'fake', label: 'Fake cube', onSelect: onFakeCube },
      ],
    })));
    await act(async () => host.querySelector<HTMLButtonElement>('.shell-device-center-trigger')!.click());
    const items = [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    expect(items.map(item => item.textContent)).toEqual(['Smart cube', 'Stackmat', 'Fake cube']);
    await act(async () => items[2].click());
    expect(onFakeCube).toHaveBeenCalledOnce();
    expect(onCube).not.toHaveBeenCalled();
    expect(host.querySelector('[role="menu"]')).toBeNull();
  });
});
