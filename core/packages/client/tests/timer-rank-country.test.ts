// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useRankCountry } from '@/app/[lang]/timer/_shared/use-rank-country';
import { loadFlagData } from '@/lib/country-flags';

const state = vi.hoisted(() => ({
  user: null as { wcaId: string; country: string } | null,
  rankCountry: 'US',
  countries: new Map<string, string>(),
}));
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (select: (value: typeof state) => unknown) => select(state),
}));
vi.mock('@/app/[lang]/timer/_lib/settings', () => ({ useSettings: () => state }));
vi.mock('@/lib/country-flags', () => ({
  loadFlagData: vi.fn(),
  personFlagIso2: (id: string) => state.countries.get(id) ?? '',
}));

it('uses the account page WCA country and falls back without leaking another account country', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  let finish = () => {};
  let version = 0;
  vi.mocked(loadFlagData).mockImplementation(() => new Promise((resolve) => {
    finish = () => resolve(++version);
  }));
  function Probe() { return JSON.stringify(useRankCountry()); }
  async function render() {
    await act(async () => root.render(createElement(Probe)));
    return JSON.parse(host.textContent!);
  }
  try {
    expect(await render()).toEqual({ country: 'US', accountCountry: '' });
    expect(loadFlagData).not.toHaveBeenCalled();
    state.user = { wcaId: '2017YANR02', country: '' };
    expect(await render()).toEqual({ country: 'US', accountCountry: '' });
    state.countries.set('2017YANR02', 'cn');
    await act(async () => finish());
    expect(JSON.parse(host.textContent!)).toEqual({ country: 'CN', accountCountry: 'CN' });

    state.user = { wcaId: '2009ZEMD01', country: '' };
    expect(await render()).toEqual({ country: 'US', accountCountry: '' });
    state.user = null;
    expect(await render()).toEqual({ country: 'US', accountCountry: '' });
    state.countries.set('2009ZEMD01', 'au');
    await act(async () => finish());
    expect(JSON.parse(host.textContent!)).toEqual({ country: 'US', accountCountry: '' });

    state.user = { wcaId: '', country: 'invalid' };
    state.rankCountry = '';
    expect(await render()).toEqual({ country: '', accountCountry: '' });
  } finally {
    await act(async () => root.unmount());
  }
});
