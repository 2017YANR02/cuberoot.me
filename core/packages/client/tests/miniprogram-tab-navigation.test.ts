// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import WeChatShareSync from '@/components/WeChatShareSync';
import { openMiniProgramTab } from '@/lib/miniprogram-bridge';
vi.mock('next/navigation', () => ({ usePathname: () => '/zh/timer' }));
vi.mock('@/lib/miniprogram-bridge', () => ({ miniProgramTab: () => 'timer', mayUseMiniProgramBridge: () => true, openMiniProgramTab: vi.fn(async () => true) }));
vi.mock('@/lib/wechat-share', () => ({ isInWeChat: () => false, configureWeChatShare: vi.fn() }));
vi.mock('@/lib/page-share', () => ({ syncMiniProgramPageShare: vi.fn() }));
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, '', '/zh/timer');
  vi.mocked(openMiniProgramTab).mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(WeChatShareSync)));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
it('moves a pet/tool link to Tools before the timer document navigates', () => {
  const link = document.createElement('a');
  link.href = '/zh/pets?view=adopt';
  host.appendChild(link);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(openMiniProgramTab).toHaveBeenCalledWith('tools', '/zh/pets?view=adopt');
  expect(location.pathname).toBe('/zh/timer');
});
it('respects the account return target instead of classifying its home href as Tools', () => {
  const link = document.createElement('a');
  link.href = '/zh';
  link.dataset.miniProgramTarget = 'account';
  host.appendChild(link);
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(openMiniProgramTab).toHaveBeenCalledWith('account', undefined);
});
it('leaves timer query changes to the current document', () => {
  const link = document.createElement('a');
  link.href = '/zh/timer?event=222';
  host.appendChild(link);
  link.addEventListener('click', event => event.preventDefault());
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(openMiniProgramTab).not.toHaveBeenCalled();
});
