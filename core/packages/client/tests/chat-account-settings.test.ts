// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SettingsPanel from '@/components/account/SettingsPanel';
import ChatPage from '@/app/[lang]/chat/page';

const mocks = vi.hoisted(() => ({ mounted: vi.fn(), unmounted: vi.fn(), url: vi.fn() }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/components/StartupStatus', () => ({ ClientLoadStatus: () => null }));
vi.mock('@/components/AppearanceToggle', () => ({ default: () => createElement('div', { 'data-general': true }, '外观') }));
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
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('preserves account drafts and auth continuation parameters when visiting General', async () => {
  await render('?view=signin&next=%2Fauth%2Fmobile&link_provider=apple&expected_uid=66');
  expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('账号与安全');
  const input = host.querySelector('input')!;
  input.value = '未保存';
  await click(nav('通用'));
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
