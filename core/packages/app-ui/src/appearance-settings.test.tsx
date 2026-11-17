// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE_PREFERENCES, PALETTES, type AppearancePreferences } from '@cuberoot/shared/appearance';
import { AppAppearanceSettings } from './AppAppearanceSettings';
import { AppearanceSettings } from './AppearanceSettings';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const click = async (element: Element) => { await act(async () => (element as HTMLElement).click()); };
const option = (label: string) => [...document.querySelectorAll('.compact-select-option')].find(el => el.textContent === label)!;

it('switches palette to explicit system/light/dark through the same controlled UI', async () => {
  const change = vi.fn();
  await act(async () => root.render(<AppearanceSettings value={{ ...DEFAULT_APPEARANCE_PREFERENCES, palette: PALETTES[0].id }}
    effectiveTheme="light" onChange={change} />));
  for (const [label, theme] of [['System', 'system'], ['Light', 'light'], ['Dark', 'dark']] as const) {
    await click(host.querySelector('[aria-label="Appearance"]')!);
    await click(option(label));
    expect(change).toHaveBeenLastCalledWith({ theme, palette: null });
  }
});

it('edits only the current scheme background and keeps the selected thumbnail accessible', async () => {
  const change = vi.fn();
  await act(async () => root.render(<AppearanceSettings value={{ ...DEFAULT_APPEARANCE_PREFERENCES, darkBackground: '03' }}
    effectiveTheme="dark" onChange={change} backgroundAssetRoot="https://cuberoot.me/assets/home-backgrounds/v1" />));
  const buttons = host.querySelectorAll('.site-background-option');
  expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
  expect(buttons[0].querySelector('img')?.src).toBe('https://cuberoot.me/assets/home-backgrounds/v1/01-thumb.webp');
  await click(buttons[0]);
  expect(change).toHaveBeenLastCalledWith({ darkBackground: '01' });
  const select = host.querySelector('select')!;
  await act(async () => { select.value = 'solid'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(change).toHaveBeenLastCalledWith({ darkBackground: 'none' });
});

it('exposes custom HEX editing and keeps incomplete drafts without persisting them', async () => {
  const change = vi.fn();
  function Harness() {
    const [value, setValue] = useState<AppearancePreferences>({ ...DEFAULT_APPEARANCE_PREFERENCES, accent: '#123456' });
    return <AppearanceSettings value={value} effectiveTheme="light" onChange={patch => { change(patch); setValue({ ...value, ...patch }); }} />;
  }
  await act(async () => root.render(<Harness />));
  const input = host.querySelector<HTMLInputElement>('[aria-label="HEX color"]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { setter.call(input, '#ab'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(input.value).toBe('#ab'); expect(change).not.toHaveBeenCalled();
  await act(async () => { setter.call(input, '#abcdef'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(change).toHaveBeenLastCalledWith({ accent: '#ABCDEF' });
});

it('focuses the page heading while nested Escape dismisses only its own menu', async () => {
  const close = vi.fn();
  await act(async () => root.render(<AppAppearanceSettings value={DEFAULT_APPEARANCE_PREFERENCES} effectiveTheme="light"
    onChange={() => {}} onClose={close} />));
  expect(document.activeElement).toBe(host.querySelector('h1'));
  await click(host.querySelector('[aria-label="Appearance"].compact-select-trigger')!);
  expect(document.querySelector('.accent-color-menu')).not.toBeNull();
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  expect(document.querySelector('.accent-color-menu')).toBeNull(); expect(close).not.toHaveBeenCalled();
  await click(host.querySelector('[aria-label="Back"]')!); expect(close).toHaveBeenCalledOnce();
});

it('changes App language through the shared menu without a second stored language model', async () => {
  const change = vi.fn();
  await act(async () => root.render(<AppAppearanceSettings value={DEFAULT_APPEARANCE_PREFERENCES} effectiveTheme="light"
    onChange={change} onClose={() => {}} />));
  await click(host.querySelector('[aria-label="Language"]')!);
  await click(option('简体中文'));
  expect(change).toHaveBeenLastCalledWith({ locale: 'zh' });
});
