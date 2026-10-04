// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { installedMembershipStore, requestStoreMembership, receiveStoreMembershipResult, setStoreMembershipBridge } from '../lib/store-membership-bridge';
const originalParent = window.parent;
afterEach(() => { setStoreMembershipBridge('google', false); setStoreMembershipBridge('apple', false); window.name = ''; Object.defineProperty(window, 'parent', { configurable: true, value: originalParent }); vi.restoreAllMocks(); });
it('fails closed for an old Android app before a bridge is available, but not ordinary Android Chrome', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android');
  expect(installedMembershipStore()).toBeNull();
  window.name = 'cuberoot-mobile-account';
  Object.defineProperty(window, 'parent', { configurable: true, value: {} });
  expect(installedMembershipStore()).toBe('google');
});
it('correlates results by store and request ID without forwarding receipts', async () => {
  window.name = 'cuberoot-mobile-tools';
  const post = vi.fn();
  setStoreMembershipBridge('google', true, post);
  const result = requestStoreMembership('google', 'purchase', 7, 'me.cuberoot.app.membership.monthly');
  const sent = post.mock.calls[0][0];
  expect(sent.expectedUid).toBe(7); expect(sent.surface).toBe('tools');
  let completed = false; void result.then(() => { completed = true; });
  receiveStoreMembershipResult({ type: 'cuberoot:mobile:apple-membership-result', requestId: sent.requestId, status: 'success' });
  await Promise.resolve(); expect(completed).toBe(false);
  receiveStoreMembershipResult({ type: 'cuberoot:mobile:google-membership-result', requestId: sent.requestId, status: 'pending' });
  expect((await result).status).toBe('pending');
});
