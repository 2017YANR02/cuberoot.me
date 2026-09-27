// @vitest-environment jsdom
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerDeviceCenter, TimerStageLayout, TimerStatRail, TimingSurface } from '@cuberoot/timer-ui';

it('shares source/content/footer order, real actions and fullscreen behavior across host wrappers', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const stats = vi.fn();
  const connect = vi.fn();
  const surfaceRef = createRef<HTMLDivElement>();
  const draw = (className: string, fullscreen = false) => act(async () => root.render(
    createElement(TimerStageLayout, {
      className, fullscreen,
      source: createElement('select', { 'aria-label': 'Source' }, createElement('option', null, 'Random')),
      statistics: createElement(TimerStatRail, { emptyLabel: 'Times', items: [], onClick: stats }),
      devices: createElement(TimerDeviceCenter, {
        ariaLabel: 'Devices', menuLabel: 'Available devices', triggerLabel: 'Connect',
        items: [{ id: 'cube', kind: 'smart-cube', label: 'Smart cube', onSelect: connect }],
      }),
      children: createElement(TimingSurface, {
        layout: 'solo', surfaceRef, phase: 'idle', colorClass: '', digits: '0.00',
      }),
    }),
  ));
  try {
    for (const className of ['shell-main', 'mobile-timer-stage']) {
      await draw(className);
      const stage = host.firstElementChild!;
      expect([...stage.children].map((node) => node.classList[0]))
        .toEqual(['timer-stage-source', 'timing-surface', 'timer-stage-footer']);
      const readout = host.querySelector('.timer-display');
      const footer = host.querySelector<HTMLElement>('.timer-stage-footer')!;
      expect(footer.hasAttribute('data-no-timer')).toBe(true);
      await act(async () => host.querySelector<HTMLButtonElement>('.shell-stat-rail')!.click());
      await act(async () => host.querySelector<HTMLButtonElement>('.shell-device-center-trigger')!.click());
      await act(async () => host.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click());
      await draw(className, true);
      expect(host.querySelector<HTMLElement>('.timer-stage-source')!.hidden).toBe(true);
      expect(footer.hidden).toBe(true);
      expect(host.querySelector('.timer-display')).toBe(readout);
      await draw(className);
      expect(footer.hidden).toBe(false);
    }
    expect(stats).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
