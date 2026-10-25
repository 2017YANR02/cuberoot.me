// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InstalledUpdateNotice } from './AndroidUpdateNotice';
import type { InstalledAppHost } from './platform';
const fetchRelease = vi.hoisted(() => vi.fn());
vi.mock('@cuberoot/shared/android-release', async importOriginal => ({ ...await importOriginal<object>(), fetchWindowsRelease: fetchRelease }));
let element: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  element = document.createElement('div'); document.body.append(element); root = createRoot(element); fetchRelease.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); element.remove(); });
const host = () => ({ getWindowsUpdateInfo: async () => ({ versionName: '1.0.9' }), openExternal: vi.fn().mockResolvedValue(undefined) }) as unknown as InstalledAppHost;
it('compares numeric versions and offers both Windows artifacts from the official manifest', async () => {
  const adapter = host();
  fetchRelease.mockResolvedValue({ versionName: '1.0.10', files: { installer: { url: 'https://static.cuberoot.me/downloads/windows/installer.exe' }, portable: { url: 'https://static.cuberoot.me/downloads/windows/portable.exe' } } });
  await act(async () => root.render(createElement(InstalledUpdateNotice, { host: adapter, language: 'en' })));
  expect(element.textContent).toContain('Update available: 1.0.10');
  await act(async () => [...element.querySelectorAll('button')].find(b => b.textContent === 'Download standalone EXE')!.click());
  expect(adapter.openExternal).toHaveBeenCalledWith('https://static.cuberoot.me/downloads/windows/portable.exe');
  expect(element.textContent).toContain('preserve local solves');
});
it('does not offer a downgrade and reports unavailable manifests', async () => {
  const adapter = host();
  fetchRelease.mockResolvedValue({ versionName: '1.0.8' });
  await act(async () => root.render(createElement(InstalledUpdateNotice, { host: adapter, language: 'en' })));
  expect(element.textContent).toContain('You are up to date');
  fetchRelease.mockRejectedValue(new Error('offline'));
  await act(async () => element.querySelector('button')!.click());
  expect(element.textContent).toContain('Unable to check for updates');
  expect(element.querySelector('button')!.disabled).toBe(false);
});
