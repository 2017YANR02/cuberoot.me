// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MembershipPlan } from '@/lib/membership-api';
const mocks = vi.hoisted(() => ({ uid: 7, createOrder: vi.fn(), getOrderStatus: vi.fn(), open: vi.fn() }));
vi.mock('@/lib/web-membership-bridge', () => ({ useWebMembershipAvailable: () => true, requestWebMembership: mocks.open }));
vi.mock('@/lib/store-membership-bridge', () => ({ installedMembershipStore: () => null }));
vi.mock('@/lib/auth-store', () => ({ useAuthStore: Object.assign((select: (s: unknown) => unknown) => select({ user: { uid: mocks.uid } }), { getState: () => ({ user: { uid: mocks.uid } }) }) }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/membership-api', () => ({ createOrder: mocks.createOrder, getOrderStatus: mocks.getOrderStatus }));
import PayModal from '@/app/[lang]/membership/PayModal';
const plan = { slug: 'monthly', nameZh: '月度', nameEn: 'Monthly', period: 'month', periodCount: 1, priceCents: 2999, currency: 'CNY', perks: [] } as MembershipPlan;
let root: Root; let host: HTMLDivElement; const paid = vi.fn();
let returned: () => void;
const render = () => act(async () => root.render(createElement(PayModal, { plan, isZh: true, onClose: vi.fn(), onPaid: paid,
  channels: { alipay: true, wechat: true, cardCn: true, cardGlobal: true } })));
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); vi.clearAllMocks(); mocks.uid = 7;
  mocks.createOrder.mockResolvedValue({ outTradeNo: 'order-1', url: 'https://openapi.alipay.com/gateway.do?sign=test' });
  mocks.getOrderStatus.mockResolvedValue({ status: 'pending' });
  mocks.open.mockImplementation(() => new Promise(resolve => { returned = () => resolve({ status: 'returned' }); }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
it('uses mobile web checkout even on a large Android screen and waits for server confirmation', async () => {
  await render(); expect(host.querySelector('.mem-pay-ch-card')).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('.mem-pay-ch-alipay')!.click());
  expect(mocks.createOrder).toHaveBeenCalledWith('monthly', 'alipay', 'wap', 'zh', 'android-direct');
  expect(mocks.open).toHaveBeenCalledWith(expect.stringContaining('openapi.alipay.com'), 7, 'zh');
  expect(paid).not.toHaveBeenCalled();
  await act(async () => returned()); expect(paid).not.toHaveBeenCalled();
  mocks.getOrderStatus.mockResolvedValue({ status: 'paid' });
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
  expect(paid).toHaveBeenCalledTimes(1);
});
it('ignores a return and in-flight order status after the account changes', async () => {
  await render(); await act(async () => host.querySelector<HTMLButtonElement>('.mem-pay-ch-alipay')!.click());
  mocks.uid = 8; mocks.getOrderStatus.mockResolvedValue({ status: 'paid' });
  await render(); await act(async () => returned());
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(paid).not.toHaveBeenCalled();
});
