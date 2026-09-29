// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimerStoreData, normalizeTimerKeymap, resolveKeymap, type TimerKeymapOverrides, type TimerStoreData } from '@cuberoot/shared/timer';
import { TimerKeymapSettings, TimerSettingsPanel } from '@cuberoot/timer-ui';
import { TimerRepository, type TimerStoreDriver } from './data/timer-repository';

describe('shared shortcut settings', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it('captures, rejects reserved keys, cancels without closing, unbinds and restores defaults', async () => {
    const onClose = vi.fn();
    let overrides: TimerKeymapOverrides = {};
    function Harness() {
      const [value, setValue] = useState(overrides);
      return <TimerSettingsPanel language="en" activeCategory="advanced" onCategoryChange={() => undefined} onClose={onClose}>
        <TimerKeymapSettings value={value} localize={copy => copy.en} onChange={update => {
          overrides = update(overrides); setValue(overrides);
        }} />
      </TimerSettingsPanel>;
    }
    await act(async () => root.render(<Harness />));
    const firstBinding = () => document.querySelector<HTMLButtonElement>('.keymap-bind-btn')!;
    await act(async () => firstBinding().click());
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })));
    expect(document.querySelector('.keymap-reject')?.textContent).toContain("can't be rebound");
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })));
    expect(onClose).not.toHaveBeenCalled();
    expect(overrides).toEqual({});
    await act(async () => firstBinding().click());
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', code: 'KeyN', shiftKey: true, bubbles: true })));
    expect(resolveKeymap(overrides)['Shift+KeyN']).toBe('delete-last');
    expect(resolveKeymap(overrides).KeyZ).toBeUndefined();
    await act(async () => document.querySelector<HTMLButtonElement>('.timer-keymap-settings .settings-row .hint-btn')!.click());
    expect(Object.values(resolveKeymap(overrides))).not.toContain('delete-last');
    await act(async () => document.querySelector<HTMLButtonElement>('[data-setting-id="settings.advanced.reset-keymap"]')!.click());
    expect(overrides).toEqual({});
    expect(resolveKeymap(overrides).KeyZ).toBe('delete-last');
  });

  it('persists explicit unbindings through restart and drops malformed imported keys', async () => {
    let data: unknown = createTimerStoreData(100, 'session');
    const driver: TimerStoreDriver = {
      read: async () => structuredClone(data), readRecovery: async () => undefined,
      write: async (next: TimerStoreData) => { data = structuredClone(next); },
      writeWithRecovery: async (next: TimerStoreData) => { data = structuredClone(next); },
    };
    const env = { now: () => 100, createId: () => 'session', language: () => 'en' as const };
    const repo = new TimerRepository(driver, env);
    await repo.updateSettings({ keymap: { KeyZ: null, 'Shift+KeyN': 'delete-last' } });
    const reloaded = await new TimerRepository(driver, env).load();
    expect(reloaded.settings.keymap).toEqual({ KeyZ: null, 'Shift+KeyN': 'delete-last' });
    expect(normalizeTimerKeymap(JSON.parse('{"__proto__":"toggle-dnf","Space":"delete-last","KeyQ":"unknown","KeyZ":null}'))).toEqual({ KeyZ: null });
  });
});
