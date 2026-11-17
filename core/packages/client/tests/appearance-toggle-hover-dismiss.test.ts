// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/en',
}));
vi.mock('@/lib/safe-storage', () => ({ persistItem: vi.fn() }));
vi.mock('@/lib/theme', () => ({
  THEME_KEY: 'theme',
  applyTheme: vi.fn(),
  applyPalette: vi.fn(),
  applyContrast: vi.fn(),
  applyAccent: vi.fn(),
  beginAppearancePreview: vi.fn(),
  endAppearancePreview: vi.fn(),
  previewTheme: vi.fn(),
  previewPalette: vi.fn(),
  restorePersistedAppearance: vi.fn(),
  readTheme: () => 'system',
  readContrast: () => 'normal',
  readAccent: () => null,
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
vi.mock('@/i18n/tr', () => ({ useLang: () => 'en', tr: (value: { en: string }) => value.en }));

import AppearanceToggle from '@/components/AppearanceToggle';
import { setInstalledShellNavigation } from '@/lib/installed-shell-navigation';
import { beginAppearancePreview, endAppearancePreview } from '@/lib/theme';

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
  setInstalledShellNavigation(null);
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(AppearanceToggle, { showLabel: true })));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  setInstalledShellNavigation(null);
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

it('delegates the appearance trigger and keeps outer settings open for nested Escape', async () => {
  const trigger = await openMenu();
  expect(trigger.getAttribute('data-mobile-open-settings')).toBe('appearance');
  await act(async () => host.querySelector<HTMLButtonElement>('.accent-color-select [aria-label="Appearance"]')!.click());
  expect(document.querySelector('.accent-color-menu')).not.toBeNull();
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  expect(document.querySelector('.accent-color-menu')).toBeNull();
  expect(menu()).not.toBeNull();
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  expect(menu()).toBeNull();
});

it('never opens or previews a local hover menu with trusted shell navigation', async () => {
  const delegate = vi.fn();
  await act(async () => setInstalledShellNavigation(delegate, 'tools'));
  vi.mocked(beginAppearancePreview).mockClear();
  const trigger = host.querySelector<HTMLButtonElement>('[data-mobile-open-settings="appearance"]')!;
  await pointer(trigger, 'pointerover');
  expect(menu()).toBeNull();
  expect(beginAppearancePreview).not.toHaveBeenCalled();
  await act(async () => trigger.click());
  expect(delegate).toHaveBeenCalledOnce();
  expect(menu()).toBeNull();
});

it('cleans an already open menu and nested portal when trusted capability arrives', async () => {
  const trigger = await openMenu();
  await act(async () => host.querySelector<HTMLButtonElement>('.accent-color-select [aria-label="Appearance"]')!.click());
  expect(document.querySelector('.accent-color-menu')).not.toBeNull();
  await pointer(trigger, 'pointerout');
  const delegate = vi.fn();
  await act(async () => setInstalledShellNavigation(delegate, 'tools'));
  expect(menu()).toBeNull();
  expect(document.querySelector('.accent-color-menu')).toBeNull();
  expect(endAppearancePreview).toHaveBeenCalledWith(true);
  await act(async () => vi.advanceTimersByTime(200));
  expect(delegate).not.toHaveBeenCalled();
  await act(async () => setInstalledShellNavigation(null));
  expect(menu()).toBeNull();
  await pointer(trigger, 'pointerover');
  expect(menu()).not.toBeNull();
});

it('shows only the delegated trigger instead of embedded settings in a trusted shell', async () => {
  const delegate = vi.fn();
  await act(async () => {
    setInstalledShellNavigation(delegate, 'account');
    root.render(createElement(AppearanceToggle, { embedded: true, section: 'appearance', triggerLabel: 'Appearance' }));
  });
  expect(host.querySelector('.appearance-menu')).toBeNull();
  const trigger = host.querySelector<HTMLButtonElement>('[data-mobile-open-settings="appearance"]')!;
  expect(trigger.getAttribute('aria-label')).toBe('Appearance');
  await act(async () => trigger.click());
  expect(delegate).toHaveBeenCalledOnce();
});
