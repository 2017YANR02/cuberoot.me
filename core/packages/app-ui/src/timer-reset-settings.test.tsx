// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { TimerResetSettings } from '@cuberoot/timer-ui';

describe('shared reset settings confirmation', () => {
  it('requires confirmation and disables reset during an attempt', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onReset = vi.fn();
    const confirmReset = vi.fn(() => false);
    try {
      await act(async () => root.render(<TimerResetSettings localize={copy => copy.en} onReset={onReset} confirmReset={confirmReset} />));
      await act(async () => container.querySelector('button')!.click());
      expect(confirmReset).toHaveBeenCalledWith('Reset all settings to defaults?');
      expect(onReset).not.toHaveBeenCalled();
      confirmReset.mockReturnValue(true);
      await act(async () => container.querySelector('button')!.click());
      expect(onReset).toHaveBeenCalledOnce();
      await act(async () => root.render(<TimerResetSettings disabled localize={copy => copy.zh} onReset={onReset} confirmReset={confirmReset} />));
      expect(container.textContent).toBe('恢复默认');
      await act(async () => container.querySelector('button')!.click());
      expect(onReset).toHaveBeenCalledOnce();
    } finally { await act(async () => root.unmount()); }
  });
});
