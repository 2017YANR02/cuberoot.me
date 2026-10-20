// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TimerBackupSettings, TimerMetronomeSettings, TimerSyncSeedSettings } from '@cuberoot/timer-ui';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function input(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('does not restart the active seed sequence on a repeated Apply or Enter', async () => {
  const reset = vi.fn();
  await act(async () => root.render(createElement(TimerSyncSeedSettings, {
    language: 'en', value: { syncSeed: 'practice', syncSeedCounter: 12, syncSeedRevision: 0 }, onReset: reset,
  })));
  const field = host.querySelector('input')!;
  const apply = [...host.querySelectorAll('button')].find(button => button.textContent === 'Apply')!;
  expect(apply.disabled).toBe(true);
  await act(async () => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(reset).not.toHaveBeenCalled();
  await input(field, 'new-practice');
  await act(async () => apply.click());
  expect(reset).toHaveBeenCalledExactlyOnceWith('new-practice');
});

it('can edit and clear inspection alerts while the metronome is off', async () => {
  const change = vi.fn();
  await act(async () => root.render(createElement(TimerMetronomeSettings, {
    value: { metronomeOn: false, inspectionBeepAt: [5, 10] }, bpm: 120,
    onChange: change, onBpmChange: vi.fn(), onTap: () => null,
    onWarmup: vi.fn(), onPreviewBeep: vi.fn(), localize: copy => copy.en,
  })));
  const field = host.querySelector<HTMLInputElement>('input[type="text"]')!;
  expect(field.disabled).toBe(false);
  expect(host.querySelector<HTMLInputElement>('input[type="range"]')!.disabled).toBe(true);
  await input(field, '');
  await act(async () => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
  expect(change).toHaveBeenCalledExactlyOnceWith({ inspectionBeepAt: [] });
});

it('does not disable backups while replacing a number, and preserves it on empty blur', async () => {
  const change = vi.fn();
  await act(async () => root.render(createElement(TimerBackupSettings, {
    language: 'en', every: 10, onEveryChange: change, owner: null, login: vi.fn(),
    local: { create: vi.fn(), list: async () => [], restore: vi.fn() },
    cloud: { meta: async () => ({ exists: false }), upload: vi.fn(), restore: async () => false },
  })));
  const field = host.querySelector('input')!;
  await input(field, '');
  expect(field.value).toBe('');
  expect(change).not.toHaveBeenCalled();
  await act(async () => field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
  expect(field.value).toBe('10');
  expect(change).not.toHaveBeenCalled();
  await input(field, '25');
  await act(async () => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(change).toHaveBeenCalledExactlyOnceWith(25);
});
