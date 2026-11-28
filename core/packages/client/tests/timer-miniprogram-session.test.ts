// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { listenForMiniProgramTabSession } from '@/lib/miniprogram-tab-session';

const { apply, exchange } = vi.hoisted(() => ({ apply: vi.fn(), exchange: vi.fn() }));
vi.mock('@/lib/miniprogram-bridge', () => ({
  miniProgramTab: () => location.pathname.includes('timer') ? 'timer' : 'tools', isConfirmedMiniProgramWebView: async () => true,
}));
vi.mock('@/lib/auth-store', () => ({ applySession: apply, subscribeExplicitAuthLogout: () => () => {} }));
vi.mock('@/lib/miniprogram-auth-handoff', () => ({ exchangeMiniProgramWebSession: exchange }));

let stop: () => void;
afterEach(() => { stop?.(); vi.resetAllMocks(); });

it('receives a late ticket on the current timer document and preserves the scramble and anchor', async () => {
  const path = '/zh/timer?event=222#round';
  history.replaceState(null, '', path);
  stop = listenForMiniProgramTabSession('timer');
  exchange.mockResolvedValue({ token: 'session', user: {} });
  location.hash += '&ticket=' + 'A'.repeat(43);
  await vi.waitFor(() => expect(apply).toHaveBeenCalledOnce());
  expect(location.pathname + location.search + location.hash).toBe(path);
});

it('stays on the tools page when an initial ticket cannot be exchanged', async () => {
  history.replaceState(null, '', '/en#wechat_redirect&ticket=' + 'A'.repeat(43));
  exchange.mockRejectedValue(new Error('offline'));
  stop = listenForMiniProgramTabSession('tools');
  await vi.waitFor(() => expect(exchange).toHaveBeenCalledOnce());
  expect(location.pathname + location.hash).toBe('/en#wechat_redirect');
  expect(apply).not.toHaveBeenCalled();
});
