// @vitest-environment jsdom

import { act, createElement, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n/i18n-client';
import LangToggle from '@/components/LangToggle';
import I18nProvider from '@/i18n/I18nProvider';

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => '/zh/wca/comp/_',
}));

let root: Root;
let host: HTMLDivElement;
const query = 'view=podium&event=333&round=1&layout=calendar&schedEvent=skewb&psychEvent=skewb';

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  navigation.replace.mockClear();
  localStorage.clear();
  await i18n.changeLanguage('zh');
  window.history.replaceState({ __NA: true, tree: 'existing-router-state' }, '',
    `/zh/wca/comp/BeijingAutumnRivalry2026?${query}#podium`);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it('navigates the real competition address without waking the old locale/query state', async () => {
  await act(async () => root.render(createElement(LangToggle)));
  await act(async () => host.querySelector('a')!.click());
  expect(navigation.replace).toHaveBeenCalledExactlyOnceWith(
    `/wca/comp/BeijingAutumnRivalry2026?${query}#podium`);
  expect(localStorage.getItem('trainer-lang')).toBe('en');
  expect(document.cookie).toContain('lang=en');
  // Until Next delivers the English layout, the Chinese provider remains authoritative.
  expect(i18n.language).toBe('zh');
  expect(window.location.pathname).toBe('/zh/wca/comp/BeijingAutumnRivalry2026');
  expect(window.location.search).toBe(`?${query}`);
  expect(window.history.state).toEqual({ __NA: true, tree: 'existing-router-state' });
});

it('retains the explicit in-place language switch', async () => {
  await act(async () => root.render(createElement(LangToggle, { soft: true })));
  await act(async () => host.querySelector('a')!.click());
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(i18n.language).toBe('en');
  expect(new URLSearchParams(window.location.search).get('lang')).toBe('en');
  expect(window.location.hash).toBe('#podium');
});

it('changes the route locale after commit without updating mounted subscribers during render', async () => {
  function Subscriber() {
    const { i18n: language } = useTranslation();
    return createElement('span', null, language.language);
  }
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const render = (initialLang: 'en' | 'zh') => root.render(createElement(Fragment, null,
    createElement(Subscriber), createElement(I18nProvider, { initialLang, children: createElement(Subscriber) })));
  try {
    await act(async () => render('zh'));
    await act(async () => render('en'));
    expect(i18n.language).toBe('en');
    expect(host.textContent).toBe('enen');
    expect(errors.mock.calls.filter(args => String(args[0]).includes('Cannot update a component'))).toEqual([]);
  } finally {
    errors.mockRestore();
  }
});
