// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePinnedCountries } from '@/hooks/usePinnedCountries';
import { CountryPinButton } from '@/components/CountryPinButton';
import { loadFlagData } from '@/lib/country-flags';
import { changeAppLanguage } from '@/i18n/i18n-client';

const state = vi.hoisted(() => ({
  user: null as { uid: number; wcaId: string } | null,
  countries: new Map<string, string>(),
}));
vi.mock('@/lib/auth-store', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/auth-store')>(),
  useAuthUser: () => state.user,
  useAuthStore: { getState: () => state },
}));
vi.mock('@/lib/country-flags', () => ({
  loadFlagData: vi.fn(async () => 1),
  personFlagIso2: (id: string) => state.countries.get(id) ?? '',
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ lang: 'zh' }) }));
vi.mock('next/link', () => ({
  default: ({ children, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode; prefetch?: boolean }) => createElement('a', props, children),
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let latest: ReturnType<typeof usePinnedCountries>;
function Probe() { latest = usePinnedCountries(); return JSON.stringify(latest[0]); }
async function render() {
  await act(async () => root.render(createElement(Probe)));
  return JSON.parse(host.textContent!);
}
beforeEach(() => {
  state.user = null;
  state.countries.clear();
  localStorage.clear();
  vi.mocked(loadFlagData).mockReset().mockResolvedValue(1);
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); });

it('limits writes to the current account, supports accounts without WCA, and remembers an unpinned default', async () => {
  localStorage.setItem('cuberoot-pinned-countries', '["us"]');
  expect(await render()).toEqual([]);
  await act(async () => latest[1]('cn'));
  expect(localStorage.length).toBe(1);

  state.user = { uid: 101, wcaId: '2017YANR02' };
  state.countries.set('2017YANR02', 'cn');
  expect(await render()).toEqual(['cn']);
  await act(async () => latest[1]('cn'));
  expect(await render()).toEqual([]);
  const staleToggle = latest[1];
  state.user = { uid: 102, wcaId: '' };
  await act(async () => staleToggle('us'));
  expect(await render()).toEqual([]);
  await act(async () => latest[1]('au'));
  expect(await render()).toEqual(['au']);
  state.user = null;
  expect(await render()).toEqual([]);
  state.user = { uid: 101, wcaId: '2017YANR02' };
  expect(await render()).toEqual([]);
  await act(async () => root.unmount());
  root = createRoot(host);
  expect(await render()).toEqual([]);
});

it('loads the WCA default asynchronously without overwriting a manual choice or leaking it after logout', async () => {
  let finish = () => {};
  vi.mocked(loadFlagData).mockImplementation(() => new Promise(resolve => { finish = () => resolve(1); }));
  state.user = { uid: 103, wcaId: '2017YANR02' };
  expect(await render()).toEqual([]);
  state.countries.set('2017YANR02', 'cn');
  await act(async () => finish());
  expect(JSON.parse(host.textContent!)).toEqual(['cn']);

  state.user = { uid: 104, wcaId: '2009ZEMD01' };
  expect(await render()).toEqual([]);
  await act(async () => latest[1]('us'));
  state.countries.set('2009ZEMD01', 'au');
  await act(async () => finish());
  expect(await render()).toEqual(['us']);
  state.user = { uid: 105, wcaId: '2010TEST01' };
  expect(await render()).toEqual([]);
  state.user = null;
  expect(await render()).toEqual([]);
  state.countries.set('2010TEST01', 'de');
  await act(async () => finish());
  expect(JSON.parse(host.textContent!)).toEqual([]);
});

it('shares account pins between mounted menus and responds to changes from another tab', async () => {
  state.user = { uid: 106, wcaId: '' };
  await act(async () => root.render(createElement('div', null, createElement(Probe), createElement(Probe))));
  await act(async () => latest[1]('cn'));
  expect(host.textContent).toBe('["cn"]["cn"]');
  await act(async () => {
    localStorage.setItem('cuberoot-pinned-countries:u106', '["au"]');
    window.dispatchEvent(new StorageEvent('storage', { key: 'cuberoot-pinned-countries:u106' }));
  });
  expect(host.textContent).toBe('["au"]["au"]');
});

it('uses a real localized login link preserving filters for guests, and a toggle button for signed-in users', async () => {
  changeAppLanguage('zh');
  const returnTo = '/zh/wca/results?country=China&q=test#results';
  // Test fixture: simulate the current URL, not application URL-state handling.
  window.history.replaceState({}, '', returnTo);
  const onToggle = vi.fn();
  const onSelect = vi.fn();
  const view = () => createElement('div', { onClick: onSelect }, createElement(CountryPinButton, { name: '中国', pinned: false, onToggle }));
  await act(async () => root.render(view()));
  const link = host.querySelector('a')!;
  expect(link.getAttribute('href')).toBe(`/zh/account?next=${encodeURIComponent(returnTo)}`);
  expect(link.getAttribute('aria-label')).toBe('登录后置顶 中国');
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  click.preventDefault(); // Keep jsdom from navigating; browser coverage verifies actual navigation.
  await act(async () => link.dispatchEvent(click));
  expect(onToggle).not.toHaveBeenCalled();
  expect(onSelect).not.toHaveBeenCalled();
  state.user = { uid: 107, wcaId: '' };
  await act(async () => root.render(view()));
  expect(host.querySelector('a')).toBeNull();
  await act(async () => host.querySelector('button')!.click());
  expect(onToggle).toHaveBeenCalledOnce();
  expect(onSelect).not.toHaveBeenCalled();
});
