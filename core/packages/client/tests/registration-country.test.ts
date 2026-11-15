// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { Comp } from '@/lib/comp-search';

const state = vi.hoisted(() => ({ user: { uid: 1, wcaId: 'TEST', country: '' } as { uid: number; wcaId: string; country: string } | null, flag: '', resolve: (() => {}) }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => state.user, authActions: { login: vi.fn() } }));
vi.mock('@/hooks/useRetainedState', async () => {
  const { useState } = await import('react');
  return { useRetainedState: (_key: string, initial: unknown) => useState(initial) };
});
vi.mock('@/lib/country-flags', () => ({ loadFlagData: () => new Promise<number>(resolve => { state.resolve = () => { state.flag = 'us'; resolve(1); }; }), personFlagIso2: () => state.flag, countryToIso2: (s: string) => s.toLowerCase() }));
vi.mock('@/lib/country-name', () => ({ countryName: (s: string) => s }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: ({ value, onChange, items }: any) => createElement('select', { value, onChange: (e: any) => onChange(e.target.value) }, items.map((i: any) => createElement('option', { key: i.value, value: i.value }, i.value || 'all'))) }));
vi.mock('@/components/Flag', () => ({ Flag: () => null }));
vi.mock('@/components/CompCardWithRounds', () => ({ wcaRoundsSeed: () => undefined, CompCardWithRounds: ({ comp }: any) => createElement('span', { 'data-country': comp.country }, comp.id) }));
vi.mock('@/i18n/tr', () => ({ tr: (s: { en: string }) => s.en }));
import { RegistrationView } from '@/components/RegistrationComps';
let root: Root | undefined;
let host: HTMLDivElement;
const comps: Comp[] = ['us', 'jp'].map(country => ({ id: country, name: country, country, start_date: '2099-01-01', end_date: '2099-01-01', registration_open: '2020-01-01T00:00:00Z', registration_close: new Date(Date.now() + 86400_000).toISOString() }));
const render = () => root!.render(createElement(RegistrationView, { comps, isZh: false, lang: 'en', loggedIn: !!state.user, follows: new Set<string>(), toggle: () => {} }));
async function mount() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.user = { uid: 1, wcaId: 'TEST', country: '' }; state.flag = '';
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => render());
}
afterEach(async () => { await act(async () => root?.unmount()); host.remove(); });

it('defaults to asynchronously loaded account country and resets for a different account or guest', async () => {
  await mount();
  await act(async () => state.resolve());
  expect(host.querySelector('select')!.value).toBe('us');
  expect(host.querySelectorAll('[data-country]')).toHaveLength(1);
  state.user = { uid: 2, wcaId: '', country: 'JP' };
  await act(async () => render());
  expect(host.querySelector('select')!.value).toBe('jp');
  state.user = null;
  await act(async () => render());
  expect(host.querySelector('select')!.value).toBe('');
  expect(host.querySelectorAll('[data-country]')).toHaveLength(2);
});
it('keeps an explicit all-country selection when account country arrives later', async () => {
  await mount();
  await act(async () => {
    const select = host.querySelector('select')!;
    select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => state.resolve());
  expect(host.querySelector('select')!.value).toBe('');
  expect(host.querySelectorAll('[data-country]')).toHaveLength(2);
});
