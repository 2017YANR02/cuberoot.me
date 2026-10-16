// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { UURemotePanel } from './UURemotePanel';
import { UURemoteClient } from './uu-remote';
import type { InstalledAppHost } from './platform';

it('shows a cold-return binding result, enables control, and permits closing the panel', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const storage = new Map<string, string>();
  let opened = '';
  const client = new UURemoteClient({
    storage: { getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => { storage.set(key, value); } },
    canOpen: async () => true, open: async url => { opened = url; return true; },
    appId: async () => 'me.cuberoot.app', nonce: () => 'test-nonce', now: () => 1,
  });
  await client.start('bind');
  const request = new URL(opened);
  const callback = new URL(request.searchParams.get('callback')!);
  callback.searchParams.set('nonce', 'test-nonce'); callback.searchParams.set('anonymous_device_id', 'secret-device');
  await client.handleUrl(callback.href);
  const element = document.createElement('div'); document.body.append(element);
  const root = createRoot(element);
  try {
    await act(async () => root.render(createElement(UURemotePanel, { host: { uuRemote: client } as InstalledAppHost, language: 'zh' })));
    expect(element.querySelector('details')!.open).toBe(true);
    expect(element.textContent).toContain('电脑已绑定');
    expect(element.textContent).not.toContain('secret-device');
    const full = [...element.querySelectorAll('button')].find(button => button.textContent === '全屏远控')!;
    expect(full.disabled).toBe(false);
    await act(async () => full.click());
    expect(new URL(opened).searchParams.get('window_type')).toBe('0');
    expect(element.textContent).toContain('请在 UU 中查看连接结果');
    element.querySelector('details')!.open = false;
    await act(async () => client.initialize());
    expect(element.querySelector('details')!.open).toBe(false);
  } finally { await act(async () => root.unmount()); element.remove(); }
});
