// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformEntity } from '@/lib/platform-types';
const mocks = vi.hoisted(() => ({ embedded: false, wechat: false, copy: vi.fn(), pay: vi.fn() }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'zh' }));
vi.mock('@/lib/miniprogram-bridge', () => ({ isMiniProgramCommerceRestricted: async () => mocks.embedded, openMiniProgramOrderPayment: vi.fn() }));
vi.mock('@/lib/wechat-share', () => ({ isInWeChat: () => mocks.wechat }));
vi.mock('@/lib/page-share', () => ({ copyPageLink: mocks.copy }));
import { PlatformOrderPayment } from '@/components/platform/PlatformOrderPayment';

describe('order checkout controls', () => {
  let host: HTMLDivElement, root: Root, entity: PlatformEntity;
  const attempt = { id: 'attempt', provider: 'wechat', status: 'pending', expiresAt: '2099-01-01T00:00:00Z', clientType: 'pc', qrCodeDataUrl: 'data:image/png;base64,fixture' };
  const render = async () => { await act(async () => root.render(createElement(PlatformOrderPayment, { entity, busy: null, runAction: mocks.pay }))); };
  const click = async () => { await act(async () => host.querySelector<HTMLButtonElement>('.platform-pay-submit')!.click()); };
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.embedded = false; mocks.wechat = false;
    mocks.pay.mockReset().mockResolvedValue(attempt); mocks.copy.mockReset().mockResolvedValue(true);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Desktop Browser');
    entity = { id: 'order', title: 'Order', status: 'pending_payment', data: { status: 'pending_payment', totalAmountMinor: 5800, currency: 'CNY',
      paymentChannels: { alipay: true, wechatNative: true, wechatH5: true, wechatMiniProgram: false } } };
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
  it('shows the exact amount on the primary button and prevents rapid duplicate submissions', async () => {
    await render(); expect(host.querySelector('.platform-pay-submit')?.textContent).toContain('58.00');
    await act(async () => { const button = host.querySelector<HTMLButtonElement>('.platform-pay-submit')!; button.click(); button.click(); });
    expect(mocks.pay).toHaveBeenCalledTimes(1);
    expect(mocks.pay).toHaveBeenCalledWith('start-payment', 'order', { provider: 'wechat', clientType: 'pc', lang: 'zh' });
    expect(host.querySelector('.platform-pay-qr img')?.getAttribute('src')).toBe(attempt.qrCodeDataUrl);
  });
  it('allows Alipay selection before starting a payment', async () => {
    await render(); await act(async () => host.querySelector<HTMLInputElement>('input[value=alipay]')!.click()); await click();
    expect(mocks.pay).toHaveBeenCalledWith('start-payment', 'order', { provider: 'alipay', clientType: 'pc', lang: 'zh' });
  });
  it('restores the original QR payment and locks a second provider', async () => {
    entity.data = { ...entity.data, activePayment: attempt }; await render();
    expect(host.querySelector('.platform-pay-qr img')).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>('input[value=alipay]')!.disabled).toBe(true);
    expect(host.querySelector('.platform-pay-submit')?.textContent).toContain('继续支付');
    await click(); expect(mocks.pay).toHaveBeenCalledWith('start-payment', 'order', { provider: 'wechat', clientType: 'pc', lang: 'zh' });
  });
  it('uses H5 on mobile browsers and copies the order link inside WeChat without creating a payment', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone'); await render(); await click();
    expect(mocks.pay).toHaveBeenCalledWith('start-payment', 'order', { provider: 'wechat', clientType: 'wap', lang: 'zh' });
  });
  it('guides embedded WeChat users to the external browser', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone MicroMessenger'); mocks.wechat = true;
    await render(); await click(); expect(mocks.pay).not.toHaveBeenCalled();
    expect(mocks.copy).toHaveBeenCalledWith(`${window.location.origin}/zh/platform/orders/order`);
    expect(host.textContent).toContain('链接已复制');
  });
  it('does not offer unconfigured channels or charge an already paid order', async () => {
    entity.data = { ...entity.data, paymentChannels: {} }; await render(); expect(host.querySelector('button')).toBeNull();
    entity.data = { ...entity.data, status: 'paid' }; await render(); expect(host.textContent).toBe('');
  });
});
