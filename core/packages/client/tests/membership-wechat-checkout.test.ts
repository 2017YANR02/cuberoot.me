// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MembershipPlan } from '@/lib/membership-api';

const mocks = vi.hoisted(() => ({ mobile: true, createOrder: vi.fn(), getOrderStatus: vi.fn(), copyPageLink: vi.fn() }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/apple-membership-bridge', () => ({ isIosMembershipSurface: () => false }));
vi.mock('@/lib/page-share', () => ({ copyPageLink: mocks.copyPageLink }));
vi.mock('@/lib/membership-api', () => ({ createOrder: mocks.createOrder, getOrderStatus: mocks.getOrderStatus }));
import PayModal from '@/app/[lang]/membership/PayModal';

const plan: MembershipPlan = { slug: 'monthly', nameZh: '月度会员', nameEn: 'Monthly', period: 'month', periodCount: 1, priceCents: 2999, currency: 'CNY', perks: [] };

describe('membership WeChat checkout environment', () => {
  let host: HTMLDivElement;
  let root: Root;
  const render = async () => {
    await act(async () => root.render(createElement(PayModal, {
      plan, channels: { alipay: true, wechat: true, wechatH5: true, wechatNative: true }, isZh: true, onClose: vi.fn(), onPaid: vi.fn(),
    })));
  };
  const clickWechat = async () => {
    await act(async () => host.querySelector<HTMLButtonElement>('.mem-pay-ch-wechat')!.click());
  };
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.mobile = true;
    mocks.createOrder.mockReset().mockResolvedValue({ outTradeNo: 'test-order', channel: 'wechat', qrcode: 'data:image/png;base64,test' });
    mocks.getOrderStatus.mockReset().mockResolvedValue({ status: 'pending' });
    mocks.copyPageLink.mockReset().mockResolvedValue(true);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) MicroMessenger/8.0');
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove(); vi.restoreAllMocks();
  });

  it('guides mobile WeChat users to an external browser without creating an unusable H5 order', async () => {
    await render();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('在浏览器打开');
    await clickWechat();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.getOrderStatus).not.toHaveBeenCalled();
    expect(mocks.copyPageLink).toHaveBeenCalledWith(`${window.location.origin}/zh/membership`);
    expect(host.querySelector('.mem-pay-ch-wechat')?.textContent).toContain('链接已复制');
    expect(host.querySelector('.mem-pay-ch-wechat')?.getAttribute('disabled')).toBeNull();
  });

  it('reports clipboard failure without pretending a link was copied or placing an order', async () => {
    mocks.copyPageLink.mockResolvedValue(false);
    await render(); await clickWechat();
    expect(host.querySelector('.mem-pay-err')?.textContent).toContain('复制失败');
    expect(host.textContent).not.toContain('链接已复制');
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it('keeps H5 checkout available in an external mobile browser', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/604.1');
    await render(); await clickWechat();
    expect(mocks.createOrder).toHaveBeenCalledWith('monthly', 'wechat', 'wap', 'zh');
    expect(mocks.copyPageLink).not.toHaveBeenCalled();
  });

  it('keeps Native QR checkout available in desktop WeChat', async () => {
    mocks.mobile = false;
    await render(); await clickWechat();
    expect(mocks.createOrder).toHaveBeenCalledWith('monthly', 'wechat', 'pc', 'zh');
    expect(mocks.copyPageLink).not.toHaveBeenCalled();
  });
});
