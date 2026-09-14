// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { fetchAdminUsers } = vi.hoisted(() => ({ fetchAdminUsers: vi.fn() }));
vi.mock('@/lib/account-api', () => ({ fetchAdminUsers, updateAdminRole: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({ useAuthStore: () => ({ isAdmin: true }), hasAdminAccess: () => true }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh' }));
vi.mock('@/components/AppLink', () => ({ default: () => null }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: () => null }));
vi.mock('@/components/DateRangeInput', () => ({ DateRangeInput: () => null }));
vi.mock('@/components/DailyActivityChart', () => ({ DailyActivityChart: () => null }));
vi.mock('@/components/SearchInput', () => ({ SearchInput: () => null }));
vi.mock('@/components/Flag', () => ({ Flag: () => null }));
import AdminUsersPage from '@/app/[lang]/admin/users/page';

let host: HTMLDivElement;
let root: Root;
const onUrlUpdate = vi.fn();
beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  fetchAdminUsers.mockResolvedValue({
    users: [], daily: [], providerCounts: [], summary: {}, pagination: { total: 1425 },
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(NuqsTestingAdapter, {
    searchParams: '?page=2&q=test&provider=email&sort=name&direction=asc',
    hasMemory: true, onUrlUpdate, children: createElement(AdminUsersPage),
  })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

async function jump(value: string, key = 'Enter') {
  const input = host.querySelector<HTMLInputElement>('[aria-label="跳转页码"]')!;
  await act(async () => {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    if (key) input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    else input.blur();
  });
  return input;
}

it('jumps directly while retaining filters, and synchronizes with next/previous', async () => {
  await jump('37');
  expect(fetchAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 37, q: 'test', provider: 'email', sort: 'name', direction: 'asc' }));
  await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
  expect(onUrlUpdate.mock.lastCall![0].searchParams.get('page')).toBe('37');
  expect(onUrlUpdate.mock.lastCall![0].searchParams.get('q')).toBe('test');
  const next = [...host.querySelectorAll<HTMLButtonElement>('nav button')].find(b => b.textContent === '下一页')!;
  await act(async () => next.click());
  expect(host.querySelector<HTMLInputElement>('[aria-label="跳转页码"]')!.value).toBe('38');
});

it('clamps boundaries and restores empty input or Escape without jumping', async () => {
  expect((await jump('999', '')).value).toBe('57');
  expect(fetchAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 57 }));
  expect((await jump('0')).value).toBe('1');
  const calls = fetchAdminUsers.mock.calls.length;
  expect((await jump('')).value).toBe('1');
  expect((await jump('40', 'Escape')).value).toBe('1');
  expect(fetchAdminUsers).toHaveBeenCalledTimes(calls);
});
