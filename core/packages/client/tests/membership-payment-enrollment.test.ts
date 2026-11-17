// @vitest-environment jsdom
import { act, createElement, type AnchorHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ uid: 1, mobile: false, inWechat: false,
  availability: vi.fn(), checkout: vi.fn(), status: vi.fn(), ordinary: vi.fn() }));
vi.mock('@/lib/membership-api', () => ({ renewalAvailability: state.availability,
  createMembershipCheckout: state.checkout, getMembershipCheckoutStatus: state.status, createOrder: state.ordinary }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => ({ uid: state.uid }), getAuthUser: () => ({ uid: state.uid }) }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => state.mobile }));
vi.mock('@/lib/wechat-share', () => ({ isInWeChat: () => state.inWechat }));
vi.mock('@/lib/store-membership-bridge', () => ({ installedMembershipStore: () => null }));
vi.mock('@/lib/web-membership-bridge', () => ({ useWebMembershipAvailable: () => false }));
vi.mock('@/i18n/tr', () => ({ tr: (copy: { zh: string }) => copy.zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ prefetch: _p, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => createElement('a', props) }));
import AutoRenewModal from '@/app/[lang]/membership/AutoRenewModal';

const plan = { slug: 'monthly_auto_renew', nameZh: '连续包月', nameEn: 'Monthly auto-renewal', priceCents: 2999,
  currency: 'CNY', period: 'month' as const, periodCount: 1, perks: [] };
let host: HTMLDivElement, root: Root;
const onPaid = vi.fn();
async function render() {
  await act(async () => root.render(createElement(AutoRenewModal, { plan, isZh: true, planSlug: plan.slug,
    priceCents: 2999, price: '¥29.99', period: 'month', onClose: vi.fn(), onPaid })));
}
async function start() {
  await act(async () => host.querySelector<HTMLInputElement>('input')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('.mem-pay-ch-wechat')!.click());
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); state.uid = 1; state.mobile = false; state.inWechat = false;
  state.availability.mockResolvedValue({ available: true, channel: 'payment', termsVersion: '2026-10-14',
    paymentChannels: { wechatNative: true, wechatH5: true } });
  state.checkout.mockResolvedValue({ outTradeNo: 'Cfixture', qrcode: 'data:image/png;base64,fixture' });
  state.status.mockResolvedValue({ status: 'pending', paymentVerified: true, subscription: { state: 'pending', syncStatus: 'unavailable' } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('opens the preloaded checkout on its first render without the legacy form or another request', async () => {
  await act(async () => {
    flushSync(() => root.render(createElement(AutoRenewModal, { plan, planSlug: plan.slug, priceCents: 2999,
      price: '¥29.99', period: 'month', onClose: vi.fn(), initialAvailability: { available: true,
        channel: 'payment', termsVersion: '2026-10-14', paymentChannels: { wechatNative: true, wechatH5: true } } })));
    expect(host.querySelector('.mem-pay-ch-wechat')).not.toBeNull();
    expect(host.querySelector('.mem-autorenew-sign')).toBeNull();
    expect(host.querySelector('[aria-busy="true"]')).toBeNull();
  });
  expect(state.availability).not.toHaveBeenCalled();
  expect(state.checkout).not.toHaveBeenCalled();
});
it('does not flash the legacy form or unavailable message while the signing channel is unresolved', async () => {
  let resolve!: (value: unknown) => void;
  state.availability.mockReturnValue(new Promise(r => { resolve = r; }));
  await render();
  expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(host.querySelector('.mem-autorenew-sign')).toBeNull();
  expect(host.querySelector('input')).toBeNull();
  expect(host.textContent).not.toContain('暂不可用');
  await act(async () => resolve({ available: true, channel: 'payment', termsVersion: '2026-10-14',
    paymentChannels: { wechatNative: true, wechatH5: true } }));
  expect(host.querySelector('.mem-pay-ch-wechat')).not.toBeNull();
  expect(host.querySelector('[aria-busy="true"]')).toBeNull();
  expect(state.checkout).not.toHaveBeenCalled();
});
it('leaves the loading state when the configuration request fails', async () => {
  state.availability.mockRejectedValue(new Error('offline'));
  await render();
  expect(host.querySelector('[aria-busy="true"]')).toBeNull();
  expect(host.querySelector<HTMLButtonElement>('.mem-autorenew-sign')?.disabled).toBe(true);
});
it('reuses the normal payment modal, requires consent and creates only the combined checkout', async () => {
  await render();
  expect(host.querySelector<HTMLInputElement>('input')!.checked).toBe(false);
  expect(host.querySelector<HTMLButtonElement>('.mem-pay-ch-wechat')!.disabled).toBe(true);
  expect(host.querySelector('.mem-pay-ch-alipay')).toBeNull();
  expect(state.checkout).not.toHaveBeenCalled();
  await start();
  expect(state.checkout).toHaveBeenCalledWith(plan.slug, 2999, '2026-10-14', 'pc', 'zh');
  expect(state.ordinary).not.toHaveBeenCalled();
  expect(host.querySelector('.mem-pay-qr img')).not.toBeNull();
  expect(onPaid).not.toHaveBeenCalled();
});
it.each(['pending', 'active'] as const)('keeps payment and %s authorization separate', async contractState => {
  state.status.mockResolvedValue({ status: 'paid', paymentVerified: true,
    subscription: { state: contractState, syncStatus: contractState === 'active' ? 'verified' : 'unavailable', cancellationRequested: false } });
  await render(); await start();
  expect(onPaid).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('付款成功，会员已开通');
  expect(host.textContent).toContain(contractState === 'active' ? '自动续费已开通' : '自动续费尚未确认');
  if (contractState === 'pending') expect(host.textContent).not.toContain('自动续费已开通');
});
it('ignores a delayed checkout response after account switching', async () => {
  let resolve!: (value: unknown) => void;
  state.checkout.mockReturnValue(new Promise(r => { resolve = r; }));
  await render(); await start();
  state.uid = 2; await render();
  await act(async () => resolve({ outTradeNo: 'Cprevious', qrcode: 'data:image/png;base64,old' }));
  expect(host.querySelector('img')).toBeNull();
  expect(state.status).not.toHaveBeenCalled();
  expect(host.querySelector<HTMLInputElement>('input')!.checked).toBe(false);
});
it('does not create an unusable H5 order in the WeChat browser', async () => {
  state.mobile = true; state.inWechat = true;
  await render();
  expect(host.textContent).toContain('在浏览器中支付');
  expect(state.checkout).not.toHaveBeenCalled();
});
