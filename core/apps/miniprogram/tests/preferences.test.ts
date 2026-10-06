import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NATIVE_APPEARANCE_TOKENS, type MiniProgramPreferences } from '@cuberoot/shared/appearance';
import { publicPageSharePath } from '@cuberoot/shared/page-share';
import { receiveNativePreferences, readNativePreferences, withNativePreferences } from '../src/lib/preferences';
import { createWebViewPageOptions } from '../src/lib/web-view-page';

const preferences: MiniProgramPreferences = { locale: 'en', theme: 'dark', palette: 'hantan', contrast: 'soft', lightBackground: '07', darkBackground: '08' };
const appearance = { type: 'cuberoot:appearance', scheme: 'dark', followSystem: false,
  colors: Object.fromEntries(Object.keys(NATIVE_APPEARANCE_TOKENS).map(key => [key, '#142b32'])) };
let stored: Map<string, unknown>;
beforeEach(() => {
  stored = new Map();
  vi.stubGlobal('wx', { getStorageSync: (key: string) => stored.get(key),
    setStorageSync: (key: string, value: unknown) => stored.set(key, value),
    getAppBaseInfo: () => ({ theme: 'light', language: 'zh_CN' }),
    setNavigationBarTitle: vi.fn(), setNavigationBarColor: vi.fn(), setTabBarStyle: vi.fn(),
    setBackgroundColor: vi.fn(), setTabBarItem: vi.fn(), showShareMenu: vi.fn() });
  vi.stubGlobal('getCurrentPages', () => []);
});
afterEach(() => vi.unstubAllGlobals());
it('persists a validated snapshot atomically and sends it to a newly opened WebView without altering its anchor', () => {
  expect(receiveNativePreferences({ preferences, appearance })).toBe(true);
  expect(readNativePreferences()).toEqual(preferences);
  expect(stored.get('cuberoot.locale.v1')).toBe('en');
  expect(stored.get('cuberoot.appearance.v1')).toEqual(appearance);
  const url = new URL(withNativePreferences('https://cuberoot.me/timer?players=2#section'));
  expect(url.hash).toBe('#section');
  expect(url.searchParams.get('players')).toBe('2');
  expect(JSON.parse(url.searchParams.get('mpPreferences')!).preferences).toEqual(preferences);
  expect(url.searchParams.get('lang')).toBe('en');
  expect(publicPageSharePath(url.href)).toBe('/timer?players=2&lang=en#section');
  expect(new URL(withNativePreferences('https://cuberoot.me/zh/timer?lang=zh&players=2')).searchParams.get('lang')).toBe('en');
  expect(receiveNativePreferences({ preferences: { ...preferences, palette: '../invalid' }, appearance })).toBe(false);
  expect(receiveNativePreferences({ preferences, appearance: {} })).toBe(false);
  expect(readNativePreferences()).toEqual(preferences);
});
it('refreshes a cached tab omitted from getCurrentPages and retains the source WebView', async () => {
  const options = createWebViewPageOptions('timer') as any;
  const page = { ...options, data: { ...options.data }, setData(next: object) { Object.assign(this.data, next); } };
  page.onLoad({});
  page.onShow();
  const attempt = page.data.viewAttempt;
  expect(receiveNativePreferences({ preferences, appearance })).toBe(true);
  page.onShow();
  expect(page.data.viewAttempt).toBe(attempt + 1);
  expect(new URL(page.data.src).pathname).toBe('/timer');
  expect(JSON.parse(new URL(page.data.src).searchParams.get('mpPreferences')!).preferences).toEqual(preferences);
  const next = { ...preferences, locale: 'zh', theme: 'light', palette: null };
  receiveNativePreferences({ preferences: next, appearance }, page);
  page.onShow();
  expect(page.data.viewAttempt).toBe(attempt + 1);
});
it('applies settings before returning from the native bridge page', async () => {
  let page: any;
  const source = { setData: vi.fn(), acceptPreferences: vi.fn() };
  vi.stubGlobal('getCurrentPages', () => [source, page]);
  const navigateBack = vi.fn();
  Object.assign(wx, { navigateBack });
  vi.stubGlobal('Page', (options: object) => { page = { ...options, setData: vi.fn() }; });
  await import('../src/pages/preferences/index');
  page.onLoad({ value: encodeURIComponent(JSON.stringify({ preferences, appearance })) });
  expect(readNativePreferences()).toEqual(preferences);
  expect(source.acceptPreferences).toHaveBeenCalledOnce();
  expect(navigateBack).not.toHaveBeenCalled();
  page.onReady();
  expect(navigateBack).toHaveBeenCalledWith({ delta: 1 });
});
