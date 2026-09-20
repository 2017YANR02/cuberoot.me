// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/safe-storage', () => ({ persistItem: vi.fn() }));
vi.mock('@/lib/theme', () => ({
  THEME_KEY: 'theme',
  applyTheme: vi.fn(),
  applyPalette: vi.fn(),
  applyContrast: vi.fn(),
  beginAppearancePreview: vi.fn(),
  endAppearancePreview: vi.fn(),
  previewTheme: vi.fn(),
  previewPalette: vi.fn(),
  restorePersistedAppearance: vi.fn(),
  readContrast: () => 'normal',
  readPalette: () => null,
  useEffectiveTheme: () => 'dark',
}));
vi.mock('@/lib/palettes', () => ({
  PALETTES: [{ id: 'test', en: 'Test', zh: '测试', swatch: ['#000', '#111'] }],
}));
vi.mock('@/components/SiteBackground', () => ({ SiteBackgroundControl: () => null }));
vi.mock('@/components/AppLink', () => ({
  default: ({ children, ...props }: { children: ReactNode }) => createElement('a', props, children),
}));
vi.mock('@/components/BoolToggle', () => ({
  default: ({ label }: { label: string }) => createElement('button', { type: 'button' }, label),
}));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));

import AppearanceToggle from '@/components/AppearanceToggle';

let host: HTMLDivElement;
let root: Root;

const menu = () => host.querySelector<HTMLElement>('[role="menu"]');

async function pointer(target: Element, type: 'pointerover' | 'pointerout', pointerType = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, relatedTarget: type === 'pointerout' ? document.body : null });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  await act(async () => target.dispatchEvent(event));
}

async function openMenu() {
  const trigger = host.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
  await act(async () => trigger.click());
  return trigger;
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(AppearanceToggle, { showLabel: true })));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

it('closes shortly after the pointer leaves the appearance trigger', async () => {
  const trigger = await openMenu();
  expect(menu()).not.toBeNull();

  await pointer(trigger, 'pointerout');
  await act(async () => vi.advanceTimersByTime(119));
  expect(menu()).not.toBeNull();
  await act(async () => vi.advanceTimersByTime(1));
  expect(menu()).toBeNull();
});

it('keeps the menu open while crossing into it, then closes after leaving it', async () => {
  const trigger = await openMenu();
  await pointer(trigger, 'pointerout');
  await pointer(menu()!, 'pointerover');
  await act(async () => vi.advanceTimersByTime(200));
  expect(menu()).not.toBeNull();

  await pointer(menu()!, 'pointerout');
  await act(async () => vi.advanceTimersByTime(120));
  expect(menu()).toBeNull();
});

it('does not apply hover dismissal to touch pointers', async () => {
  const trigger = await openMenu();
  await pointer(trigger, 'pointerout', 'touch');
  await act(async () => vi.advanceTimersByTime(200));
  expect(menu()).not.toBeNull();
});
