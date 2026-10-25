// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AndroidUpdateNotice } from './AndroidUpdateNotice';
import type { InstalledAppHost } from './platform';
const fetchRelease = vi.hoisted(() => vi.fn());
vi.mock('@cuberoot/shared/android-release', () => ({ fetchAndroidRelease: fetchRelease, GOOGLE_PLAY_APP_URL: 'https://play.google.com/store/apps/details?id=me.cuberoot.app' }));
let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  element = document.createElement('div'); document.body.append(element); root = createRoot(element);
  fetchRelease.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.useRealTimers(); });
const host = (channel: 'play' | 'direct') => ({ getAndroidUpdateInfo: vi.fn().mockResolvedValue({ versionName: '0.1.0', versionCode: 1005, channel }), openExternal: vi.fn().mockResolvedValue(undefined) }) as unknown as InstalledAppHost;
it('direct channel checks versions, exposes download and retains local-data installation guidance', async () => {
  const adapter = host('direct');
  fetchRelease.mockResolvedValue({ channel: 'direct', versionName: '0.1.0', versionCode: 1006, url: 'https://static.cuberoot.me/downloads/android/CubeRoot-0.1.0-1006.apk' });
  await act(async () => root.render(createElement(AndroidUpdateNotice, { host: adapter, language: 'zh' })));
  expect(element.textContent).toContain('发现新版本: 0.1.0 (1006)');
  expect(element.textContent).toContain('请勿卸载旧版');
  await act(async () => element.querySelector<HTMLButtonElement>('.primary-action')!.click());
  expect(adapter.openExternal).toHaveBeenCalledWith('https://static.cuberoot.me/downloads/android/CubeRoot-0.1.0-1006.apk');
});
it('Play channel never fetches or offers a direct APK', async () => {
  const adapter = host('play');
  await act(async () => root.render(createElement(AndroidUpdateNotice, { host: adapter, language: 'en' })));
  expect(fetchRelease).not.toHaveBeenCalled();
  expect(element.textContent).toContain('Update on Google Play');
  await act(async () => element.querySelector('button')!.click());
  expect(adapter.openExternal).toHaveBeenCalledWith('https://play.google.com/store/apps/details?id=me.cuberoot.app');
});
it('same or older releases do not offer an installation', async () => {
  fetchRelease.mockResolvedValue({ versionCode: 1004 });
  await act(async () => root.render(createElement(AndroidUpdateNotice, { host: host('direct'), language: 'en' })));
  expect(element.textContent).toContain('You are up to date');
  expect(element.querySelector('.primary-action')).toBeNull();
});
it('native bridge timeout permits retry and does not leave checking disabled', async () => {
  vi.useFakeTimers();
  const adapter = host('direct'); adapter.getAndroidUpdateInfo = () => new Promise(() => {});
  await act(async () => root.render(createElement(AndroidUpdateNotice, { host: adapter, language: 'en' })));
  await act(async () => vi.advanceTimersByTimeAsync(12_000));
  expect(element.textContent).toContain('Unable to check for updates');
  expect(element.querySelector('button')!.disabled).toBe(false);
});
it('other hosts have no Android update entry', async () => {
  await act(async () => root.render(createElement(AndroidUpdateNotice, { host: {} as InstalledAppHost, language: 'en' })));
  expect(element.textContent).toBe(''); expect(fetchRelease).not.toHaveBeenCalled();
});
