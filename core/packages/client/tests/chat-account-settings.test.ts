// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SettingsPanel from '@/components/account/SettingsPanel';
import ChatPage from '@/app/[lang]/chat/page';
import { setInstalledShellNavigation } from '@/lib/installed-shell-navigation';

const mocks = vi.hoisted(() => ({ mounted: vi.fn(), unmounted: vi.fn(), url: vi.fn() }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/components/StartupStatus', () => ({ ClientLoadStatus: () => null }));
vi.mock('@/components/AppearanceToggle', () => ({ default: ({ section }: { section: string }) => createElement('div', { 'data-general': true, 'data-section': section }, '外观') }));
vi.mock('next/dynamic', () => ({ default: () => AccountFixture }));
function AccountFixture({ embedded }: { embedded: boolean }) {
  useEffect(() => { mocks.mounted(); return () => { mocks.unmounted(); }; }, []);
  return createElement('input', { 'aria-label': '未保存的资料', 'data-embedded': String(embedded), defaultValue: '' });
}
let root: Root;
let host: HTMLDivElement;
const nav = (label: string) => [...host.querySelectorAll('nav button')].find(button => button.textContent === label)!;
const click = async (node: Element) => { await act(async () => (node as HTMLElement).click()); };
async function render(searchParams: string, chat = false) {
  await act(async () => root.render(createElement(NuqsTestingAdapter, {
    searchParams, hasMemory: true, onUrlUpdate: mocks.url,
    children: createElement(chat ? ChatPage : SettingsPanel),
  })));
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); setInstalledShellNavigation(null); host.remove(); });

it('preserves account drafts and auth continuation parameters when visiting General', async () => {
  await render('?view=signin&next=%2Fauth%2Fmobile&link_provider=apple&expected_uid=66');
  expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('账号与安全');
  const input = host.querySelector('input')!;
  input.value = '未保存';
  await click(nav('设置'));
  expect(host.querySelector('[data-general]')).not.toBeNull();
  expect(input.parentElement?.hidden).toBe(true);
  expect(mocks.unmounted).not.toHaveBeenCalled();
  await click(nav('账号与安全'));
  expect(host.querySelector('input')).toBe(input);
  expect(input.value).toBe('未保存');
  expect(input.parentElement?.hidden).toBe(false);
  const params = mocks.url.mock.lastCall![0].searchParams as URLSearchParams;
  expect(params.get('next')).toBe('/auth/mobile');
  expect(params.get('link_provider')).toBe('apple');
  expect(params.get('expected_uid')).toBe('66');
});

it('does not start an account continuation for a direct General link', async () => {
  await render('?settings=general&next=%2Fauth%2Fmobile');
  expect(mocks.mounted).not.toHaveBeenCalled();
  await click(nav('我的空间'));
  expect(mocks.mounted).toHaveBeenCalledTimes(1);
});

it.each(['general', 'appearance'])('combines General and Appearance for the %s entry', async section => {
  await render(`?settings=${section}`);
  expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('设置');
  expect(nav('外观')).toBeUndefined();
  expect(host.querySelectorAll('.settings-section')).toHaveLength(2);
  expect(host.querySelector('[data-section="general"]')).not.toBeNull();
  expect(host.querySelector('[data-section="appearance"]')).not.toBeNull();
  expect(mocks.mounted).not.toHaveBeenCalled();
});

it('opens chat settings as a modal and ignores nested cancellation and drag-out gestures', async () => {
  await render('?settings=account', true);
  const dialog = host.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  expect(host.querySelector('input')?.dataset.embedded).toBe('true');
  const nested = document.createElement('dialog'); dialog.append(nested);
  await act(async () => nested.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true })));
  expect(host.querySelector('dialog')).toBe(dialog);
  await act(async () => {
    host.querySelector('input')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
  });
  expect(host.querySelector('dialog')).toBe(dialog);
  await act(async () => {
    dialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
  });
  expect(host.querySelector('dialog')).toBeNull();
});

it('closes the chat settings on native Escape cancellation', async () => {
  await render('?settings=general', true);
  const cancel = new Event('cancel', { bubbles: true, cancelable: true });
  await act(async () => host.querySelector('dialog')!.dispatchEvent(cancel));
  expect(cancel.defaultPrevented).toBe(true);
  expect(host.querySelector('dialog')).toBeNull();
});

it('removes the duplicate Account settings header and global categories only for a capable account shell', async () => {
  await render('');
  expect(host.querySelector('h1')).not.toBeNull();
  expect(nav('设置')).toBeTruthy();
  await act(async () => setInstalledShellNavigation(vi.fn(), 'tools'));
  expect(host.querySelector('h1')).not.toBeNull();
  await act(async () => setInstalledShellNavigation(vi.fn(), 'account'));
  expect(host.querySelector('h1')).toBeNull();
  expect(nav('设置')).toBeUndefined();
  expect(nav('外观')).toBeUndefined();
  expect(nav('我的空间')).toBeTruthy();
  expect(nav('账号与安全')).toBeTruthy();
  await act(async () => setInstalledShellNavigation(null));
  expect(host.querySelector('h1')).not.toBeNull();
  expect(nav('设置')).toBeTruthy();
});

it.each(['general', 'appearance'])('delegates a direct %s query without showing local controls or starting auth', async section => {
  const open = vi.fn();
  setInstalledShellNavigation(open, 'account');
  await render(`?settings=${section}&next=%2Fauth%2Fmobile`);
  expect(open).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[data-general]')).toBeNull();
  expect(mocks.mounted).not.toHaveBeenCalled();
  expect(mocks.url).not.toHaveBeenCalled();
  await click(nav('我的空间'));
  expect(mocks.mounted).toHaveBeenCalledTimes(1);
});

it('keeps all three Account categories in one panel for the installed shell', async () => {
  const open = vi.fn();
  setInstalledShellNavigation(open, 'account', true);
  await render('?view=signin');
  const panel = host.querySelector('.settings-panel');
  const draft = host.querySelector('input')!;
  draft.value = '保留草稿';
  expect(Array.from(host.querySelectorAll('nav button'), button => button.textContent)).toEqual(['设置', '我的空间', '账号与安全']);

  await click(nav('设置'));
  expect(nav('设置').getAttribute('aria-current')).toBe('page');
  expect(host.querySelector('[data-general]')).not.toBeNull();
  expect(open).not.toHaveBeenCalled();

  await click(nav('我的空间'));
  expect(nav('我的空间').getAttribute('aria-current')).toBe('page');
  await click(nav('账号与安全'));
  expect(host.querySelector('.settings-panel')).toBe(panel);
  expect(host.querySelector('input')).toBe(draft);
  expect(draft.value).toBe('保留草稿');
});
