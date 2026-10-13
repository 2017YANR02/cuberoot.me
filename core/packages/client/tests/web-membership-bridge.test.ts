// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { decodeWebMembershipRequest, isWebMembershipCheckout } from '@cuberoot/shared/mobile-embed';
import { installedMembershipStore, setStoreMembershipBridge } from '../lib/store-membership-bridge';
import { receiveWebMembershipResult, requestWebMembership, setWebMembershipBridge } from '../lib/web-membership-bridge';
const originalParent = window.parent;
afterEach(() => {
  setWebMembershipBridge(false); setStoreMembershipBridge('google', false); setStoreMembershipBridge('apple', false);
  window.name = ''; Object.defineProperty(window, 'parent', { configurable: true, value: originalParent }); vi.restoreAllMocks();
});
it('requires explicit host capability to override the Android store fallback', () => {
  window.name = 'cuberoot-mobile-account'; Object.defineProperty(window, 'parent', { configurable: true, value: {} });
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android');
  expect(installedMembershipStore()).toBe('google');
  setWebMembershipBridge(true, vi.fn()); expect(installedMembershipStore()).toBeNull();
  setStoreMembershipBridge('google', true, vi.fn()); expect(installedMembershipStore()).toBe('google');
  setStoreMembershipBridge('google', false); setWebMembershipBridge(false); expect(installedMembershipStore()).toBe('google');
});
it('correlates native returns and never accepts a paid/success assertion from the bridge', async () => {
  window.name = 'cuberoot-mobile-account'; const send = vi.fn(); setWebMembershipBridge(true, send);
  const promise = requestWebMembership('https://openapi.alipay.com/gateway.do?sign=test', 7, 'zh');
  const message = send.mock.calls[0][0]; expect(decodeWebMembershipRequest(message)).toEqual(message);
  let resolved = false; void promise.then(() => { resolved = true; });
  receiveWebMembershipResult({ type: 'cuberoot:mobile:web-membership-result', requestId: message.requestId, status: 'paid' });
  await Promise.resolve(); expect(resolved).toBe(false);
  receiveWebMembershipResult({ type: 'cuberoot:mobile:web-membership-result', requestId: message.requestId, status: 'returned' });
  expect((await promise).status).toBe('returned');
});
it.each(['javascript:alert(1)', 'https://wx.tenpay.com.evil.test/cgi-bin/mmpayweb-bin/checkmweb', 'https://user@openapi.alipay.com/gateway.do', 'http://openapi.alipay.com/gateway.do', 'https://openapi.alipay.com/redirect'])('rejects unsafe cashier URL %s', href => {
  expect(isWebMembershipCheckout(href)).toBe(false);
});
