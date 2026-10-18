// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SimAppearancePresets from '@/app/[lang]/sim/SimAppearancePresets';
import { APPEARANCE_PRESETS_KEY, pickAppearance, readAppearancePresets } from '@/app/[lang]/sim/appearance-presets';
import type { SimSettings } from '@/app/[lang]/sim/SettingDrawer';

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));

let host: HTMLDivElement;
let root: Root;
let current: SimSettings;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
const palette = { U: '#fff', D: '#ff0', L: '#f80', R: '#f00', F: '#0f0', B: '#00f' };

it('copies only appearance, preserving draft/media/interaction boundaries and validating stored values', () => {
  const source = { scale: 45, faceColors: palette, setup: 'R U', pictureFaces: { U: 'private image' }, bodyAvatar: 'private photo', speed: 30, playbackMode: 'algorithm', renderer: 'group' };
  const appearance = pickAppearance(source);
  expect(appearance).toEqual({ scale: 45, faceColors: palette });
  expect(appearance.faceColors).not.toBe(palette);
  expect(readAppearancePresets(JSON.stringify([
    { name: ' View ', appearance: { ...source, viewMode: 'invalid', coreOpacity: -10 } },
    { name: 'View', appearance: { scale: 80 } },
    { name: 'Empty', appearance: { scale: 101, coreColor: 'url(x)' } },
  ]))).toEqual([{ name: 'View', appearance }]);
  expect(readAppearancePresets('{')).toEqual([]);
});

function Harness() {
  const [settings, setSettings] = useState({ scale: 50, coreColor: '#fff', speed: 75, pictureFaces: { U: 'image' } } as SimSettings);
  current = settings;
  return createElement(SimAppearancePresets, { settings, onChange: setSettings });
}
async function click(text: string) {
  const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent === text)!;
  expect(button).toBeDefined();
  await act(async () => button.click());
}
async function selectPreset() {
  const select = host.querySelector('select')!;
  await act(async () => { select.value = 'View'; select.dispatchEvent(new Event('change', { bubbles: true })); });
}
const saved = [{ name: 'View', appearance: { scale: 30, ghostFaceColors: palette } }];

it('applies and undoes appearance without changing media or playback; delete can be undone', async () => {
  localStorage.setItem(APPEARANCE_PRESETS_KEY, JSON.stringify(saved));
  await act(async () => root.render(createElement(Harness)));
  await selectPreset();
  await click('Apply');
  expect(current.scale).toBe(30);
  expect(current.ghostFaceColors).toEqual(palette);
  expect(current.pictureFaces).toEqual({ U: 'image' });
  expect(current.speed).toBe(75);
  await click('Undo apply');
  expect(current.scale).toBe(50);
  expect(current.ghostFaceColors).toBeUndefined();
  await click('Delete');
  expect(readAppearancePresets(localStorage.getItem(APPEARANCE_PRESETS_KEY))).toEqual([]);
  await click('Undo delete');
  expect(readAppearancePresets(localStorage.getItem(APPEARANCE_PRESETS_KEY))).toEqual(saved);
});

it('keeps the existing preset when browser storage rejects a change', async () => {
  localStorage.setItem(APPEARANCE_PRESETS_KEY, JSON.stringify(saved));
  await act(async () => root.render(createElement(Harness)));
  await selectPreset();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  await click('Delete');
  expect(host.querySelector('[role="status"]')?.textContent).toContain('Could not save');
  expect(host.querySelectorAll('option').length).toBe(2);
  expect(readAppearancePresets(localStorage.getItem(APPEARANCE_PRESETS_KEY))).toEqual(saved);
});
