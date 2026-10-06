// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { TimerBackupSettings } from '@cuberoot/timer-ui';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
it('invalidates an in-flight cloud restore when the settings panel closes', async () => {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container); vi.spyOn(window,'confirm').mockReturnValue(true);
  let finish!: () => void; let committed = false;
  const cloud = { meta: async () => ({exists:true}), upload: vi.fn(), restore: async (canCommit: () => boolean) => {
    await new Promise<void>(resolve => { finish = resolve; });
    if (canCommit()) committed = true;
    return true;
  } };
  await act(async () => root.render(createElement(TimerBackupSettings, {language:'en',every:10,onEveryChange:vi.fn(),owner:'account-a',login:vi.fn(),cloud,local:{create:vi.fn(),list:async()=>[],restore:vi.fn()}})));
  await act(async () => container.querySelector<HTMLButtonElement>('[data-setting-id="settings.data.cloud-restore"]')!.click());
  await act(async () => root.unmount());
  await act(async () => finish());
  expect(committed).toBe(false);
});
