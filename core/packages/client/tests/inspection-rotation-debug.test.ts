// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { InspectionRotationDebug } from '@/app/[lang]/timer/_components/InspectionRotationDebug';
vi.mock('@/i18n/tr', () => ({ tr: (copy: { en: string }) => copy.en }));

describe('inspection rotation debug', () => {
  it('collects only while enabled before timing, freezes at start, and clears on close', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    const host = document.createElement('div');
    const root = createRoot(host);
    const quatRef = { current: { w: 1, x: 0, y: 0, z: 0 } };
    const onToggle = vi.fn();
    const render = (enabled: boolean, phase = 'inspecting') => act(async () => root.render(createElement(InspectionRotationDebug, {
      enabled, phase, quatRef, onToggle, resetKey: 'same-scramble',
    })));
    try {
      await render(false);
      expect(vi.getTimerCount()).toBe(0);
      await act(async () => host.querySelector('button')!.click());
      expect(onToggle).toHaveBeenCalledTimes(1);
      await render(true);
      quatRef.current = { w: Math.SQRT1_2, x: 0, y: -Math.SQRT1_2, z: 0 };
      await act(async () => vi.advanceTimersByTime(300));
      expect(host.querySelector('.inspection-rotation-debug-moves')!.textContent).toBe("y'");
      await render(true, 'running');
      expect(vi.getTimerCount()).toBe(0);
      quatRef.current = { w: 1, x: 0, y: 0, z: 0 };
      await act(async () => vi.advanceTimersByTime(1000));
      expect(host.querySelector('.inspection-rotation-debug-moves')!.textContent).toBe("y'");
      await render(false, 'running');
      expect(host.querySelector('.inspection-rotation-debug-moves')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      vi.useRealTimers();
    }
  });
});
