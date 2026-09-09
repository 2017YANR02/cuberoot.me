// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MembershipSubscription, MembershipSubscriptions } from '@/lib/membership-api';

const mocks = vi.hoisted(() => ({ owner: 'u1', list: vi.fn(), cancel: vi.fn(), deleteAccount: vi.fn(), logout: vi.fn(), fetchIdentities: vi.fn() }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('next/navigation', () => ({ usePathname: () => '/zh/membership/subscription' }));
vi.mock('@/lib/auth-store', () => ({
  useOwnerKey: () => mocks.owner, nextQuery: (path: string) => `?next=${encodeURIComponent(path)}`,
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { uid: 1 }, logout: mocks.logout }),
}));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh' }));
vi.mock('@/lib/account-api', () => ({ deleteAccount: mocks.deleteAccount, fetchIdentities: mocks.fetchIdentities }));
vi.mock('@/lib/membership-api', () => ({ listMySubscriptions: mocks.list, cancelMySubscription: mocks.cancel }));
vi.mock('@/components/AppLink', () => ({
  default: ({ prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => createElement('a', props),
}));
import SubscriptionPage from '@/app/[lang]/membership/subscription/page';
import { DeleteAccountPanel } from '@/components/AuthPanel';

const active: MembershipSubscription = {
  id: '804d3b26-9f6a-48b7-ae34-8047d9b71e8a', planSlug: 'monthly_auto_renew', priceCents: 2999,
  currency: 'CNY', period: 'month', periodCount: 1, state: 'active', cancellationRequested: false,
  verifiedAt: '2026-09-09T00:00:00.000Z', syncStatus: 'verified', createdAt: '2026-09-01T00:00:00.000Z',
};
const result = (subscriptions: MembershipSubscription[] = [active], managementAvailable = true): MembershipSubscriptions => ({ subscriptions, managementAvailable });

describe('membership subscription cancellation', () => {
  let host: HTMLDivElement;
  let root: Root;
  const render = async () => { await act(async () => root.render(createElement(SubscriptionPage))); };
  function button(label: string) {
    const element = [...host.querySelectorAll('button')].find((item) => item.textContent === label);
    expect(element, `button ${label}`).toBeDefined();
    return element!;
  }
  async function click(label: string) { await act(async () => button(label).click()); }
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.open = true; } });
    mocks.owner = 'u1';
    mocks.list.mockReset().mockResolvedValue(result());
    mocks.cancel.mockReset();
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  it('requires login without querying private data and provides a return link', async () => {
    mocks.owner = '';
    await render();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(host.textContent).toContain('登录后管理自动续费');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/account?next=%2Fzh%2Fmembership%2Fsubscription');
  });
  it('does not confuse empty site records with absence of WeChat authorization', async () => {
    mocks.list.mockResolvedValue(result([]));
    await render();
    expect(host.textContent).toContain('本站暂无与你当前账号关联的签约记录');
    expect(host.textContent).toContain('这不代表微信中不存在扣款授权');
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it('opens one confirmation and allows leaving without submitting', async () => {
    await render(); await click('取消自动续费');
    expect(host.querySelector('dialog[open]')).not.toBeNull();
    expect(host.textContent).toContain('本操作不会自动退款');
    expect(mocks.cancel).not.toHaveBeenCalled();
    await click('暂不取消');
    expect(host.querySelector('dialog')).toBeNull();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it('shows confirmed cancellation and keeps the paid-benefits explanation', async () => {
    const terminated = { ...active, state: 'terminated' as const, cancellationRequested: true };
    mocks.cancel.mockResolvedValue({ subscription: terminated });
    mocks.list.mockResolvedValueOnce(result()).mockResolvedValue(result([terminated]));
    await render(); await click('取消自动续费'); await click('确认取消自动续费');
    expect(mocks.cancel).toHaveBeenCalledWith(active.id, expect.any(AbortSignal));
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('自动续费已取消');
    expect(host.textContent).toContain('已购买权益可使用至已付服务期结束');
    expect([...host.querySelectorAll('button')].some((item) => item.textContent === '取消自动续费')).toBe(false);
  });
  it('does not report a 202 pending cancellation as success and allows retry', async () => {
    const pending = { ...active, cancellationRequested: true, syncStatus: 'unavailable' as const };
    mocks.cancel.mockResolvedValue({ subscription: pending });
    mocks.list.mockResolvedValueOnce(result()).mockResolvedValue(result([pending]));
    await render(); await click('取消自动续费'); await click('确认取消自动续费');
    expect(host.textContent).toContain('等待微信确认，尚未确认取消成功');
    expect(host.textContent).not.toContain('自动续费已取消');
    expect(button('重试取消自动续费').disabled).toBe(false);
  });
  it('refreshes after failed cancellation without falsely claiming success', async () => {
    mocks.cancel.mockRejectedValue(new Error('timeout'));
    await render(); await click('取消自动续费'); await click('确认取消自动续费');
    expect(host.textContent).toContain('取消请求未得到确认');
    expect(host.textContent).not.toContain('自动续费已取消');
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(button('取消自动续费').disabled).toBe(false);
  });
  it('offers refresh for lookup failure without rendering an empty result', async () => {
    mocks.list.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(result());
    await render();
    expect(host.textContent).toContain('暂时无法查询最新状态');
    expect(host.textContent).not.toContain('本站暂无');
    await click('刷新签约状态');
    expect(host.textContent).toContain('自动续费已签约');
  });
  it('disables cancellation when management is unavailable', async () => {
    mocks.list.mockResolvedValue(result([active], false));
    await render();
    expect(button('取消自动续费').disabled).toBe(true);
    expect(host.textContent).toContain('本站微信退订服务暂不可用');
  });
  it('also permits cancelling a pending authorization', async () => {
    mocks.list.mockResolvedValue(result([{ ...active, state: 'pending' }]));
    await render();
    expect(host.textContent).toContain('签约待确认');
    expect(button('取消自动续费').disabled).toBe(false);
  });
  it('clears private records and confirmations immediately on logout', async () => {
    await render(); await click('取消自动续费');
    mocks.owner = ''; await render();
    expect(host.querySelector('dialog')).toBeNull();
    expect(host.textContent).not.toContain('¥29.99');
    expect(host.textContent).toContain('登录后管理自动续费');
  });
  it('ignores delayed results for an old account', async () => {
    let resolveOld!: (data: MembershipSubscriptions) => void;
    mocks.list.mockReturnValueOnce(new Promise<MembershipSubscriptions>((resolve) => { resolveOld = resolve; })).mockResolvedValue(result([]));
    await render();
    const oldSignal = mocks.list.mock.calls[0][0] as AbortSignal;
    mocks.owner = 'u2'; await render();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld(result()));
    expect(host.textContent).not.toContain('¥29.99');
    expect(host.textContent).toContain('本站暂无与你当前账号关联的签约记录');
  });
  it('ignores cancellation results after logout and aborts the request', async () => {
    let finish!: (value: { subscription: MembershipSubscription }) => void;
    mocks.cancel.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await render(); await click('取消自动续费'); await click('确认取消自动续费');
    const signal = mocks.cancel.mock.calls[0][1] as AbortSignal;
    mocks.owner = ''; await render();
    expect(signal.aborted).toBe(true);
    await act(async () => finish({ subscription: { ...active, state: 'terminated' } }));
    expect(host.textContent).not.toContain('自动续费已取消');
    expect(host.textContent).toContain('登录后管理自动续费');
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
  it('links blocked account deletion directly to renewal management without logging out', async () => {
    mocks.logout.mockReset();
    mocks.fetchIdentities.mockResolvedValue({ identities: [{ provider: 'email', providerUid: 'fixture@example.test', createdAt: '' }], hasPassword: false });
    mocks.deleteAccount.mockRejectedValue(new Error('cancel automatic renewal before deleting account'));
    await act(async () => root.render(createElement(DeleteAccountPanel, { backHref: '/account' })));
    const input = host.querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'fixture@example.test');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click('永久注销账号');
    expect(mocks.deleteAccount).toHaveBeenCalledWith('fixture@example.test', undefined);
    expect(host.textContent).toContain('请先取消自动续费，确认退订成功后再注销账号');
    expect(host.querySelector('a[href="/membership/subscription"]')?.textContent).toBe('管理并取消自动续费');
    expect(mocks.logout).not.toHaveBeenCalled();
  });
});
