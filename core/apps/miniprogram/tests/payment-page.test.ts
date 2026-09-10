import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requestJson: vi.fn(), getStoredSession: vi.fn(), miniProgramLoginCode: vi.fn() }));
vi.mock('../src/lib/auth', () => ({ ...auth, ApiError: class extends Error { status = 0; code = null; } }));
const id = '11111111-1111-4111-8111-111111111111';
const order = { id, orderNumber: 'CR123', status: 'pending_payment', currency: 'CNY', totalAmountMinor: 1234, items: [{ sellableType: 'event_ticket' }] };
const params = { timeStamp: '1750000000', nonceStr: 'nonce', package: 'prepay_id=abc', signType: 'RSA', paySign: 'signed' };
interface PaymentPage {
  data: { message: string; error: string; busy: boolean; canPay: boolean; amount: string };
  setData(data: Partial<PaymentPage['data']>): void;
  onLoad(options: Record<string, string>): void;
  onShow(): void;
  onUnload(): void;
  refresh(): Promise<void>;
  pay(): Promise<void>;
}
async function loadPage(requestPayment = vi.fn(), target = 'wechat') {
  let page: PaymentPage | undefined;
  vi.stubGlobal('__MINI_PROGRAM_TARGET__', target);
  vi.stubGlobal(target === 'wechat' ? 'wx' : 'tt', { requestPayment });
  vi.stubGlobal('Page', (options: PaymentPage) => { page = options; });
  await import('../src/pages/payment/index');
  if (!page) throw new Error('Page not registered');
  page.setData = function (data) { Object.assign(this.data, data); };
  return page;
}
beforeEach(() => {
  vi.useFakeTimers();
  auth.getStoredSession.mockReturnValue({ token: 'session-token' });
  auth.miniProgramLoginCode.mockResolvedValue('one-use-code');
  auth.requestJson.mockImplementation((path: string) => Promise.resolve(path.endsWith('payment-attempts') ? { requestPayment: params } : order));
});
afterEach(() => { vi.clearAllMocks(); vi.resetModules(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('native competition payment', () => {
  it('confirms payment from server state, never from requestPayment success', async () => {
    const requestPayment = vi.fn((options: { success(): void }) => options.success());
    const page = await loadPage(requestPayment);
    page.onLoad({ orderId: id });
    await page.refresh();
    expect(page.data.amount).toBe('CNY 12.34');
    await page.pay();
    await Promise.resolve();
    expect(requestPayment).toHaveBeenCalledTimes(1);
    expect(page.data.message).not.toContain('支付已确认');
    expect(auth.requestJson).toHaveBeenCalledWith(`/platform/orders/${id}/payment-attempts`, expect.objectContaining({ token: 'session-token', body: { provider: 'wechat', clientType: 'miniprogram', code: 'one-use-code' } }));
    auth.requestJson.mockResolvedValue({ ...order, status: 'fulfilled' });
    await page.refresh();
    expect(page.data.message).toContain('支付已确认');
    expect(page.data.canPay).toBe(false);
    page.onUnload();
  });

  it('reuses checkout after cancellation and keeps the cancellation message visible', async () => {
    const requestPayment = vi.fn((options: { fail(error: object): void }) => options.fail({ errMsg: 'requestPayment:fail cancel' }));
    const page = await loadPage(requestPayment);
    page.onLoad({ orderId: id });
    await page.refresh();
    await page.pay();
    await Promise.resolve();
    expect(page.data.error).toContain('已取消支付');
    await page.pay();
    expect(requestPayment).toHaveBeenCalledTimes(2);
    expect(auth.miniProgramLoginCode).toHaveBeenCalledTimes(1);
    page.onUnload();
  });

  it('blocks virtual goods and invalid or unauthenticated order entry', async () => {
    const requestPayment = vi.fn();
    const page = await loadPage(requestPayment);
    page.onLoad({ orderId: 'https://example.com' });
    await page.refresh();
    expect(auth.requestJson).not.toHaveBeenCalled();
    page.onLoad({ orderId: id });
    auth.requestJson.mockResolvedValue({ ...order, items: [{ sellableType: 'course' }] });
    await page.refresh();
    await page.pay();
    expect(page.data.canPay).toBe(false);
    expect(requestPayment).not.toHaveBeenCalled();
    page.onUnload();
  });

  it('does not load orders or call WeChat payment on Douyin', async () => {
    const page = await loadPage(vi.fn(), 'douyin');
    page.onLoad({ orderId: id });
    await page.refresh();
    expect(auth.requestJson).not.toHaveBeenCalled();
    expect(page.data.message).toContain('抖音小程序暂不支持');
  });

  it('discards a late order response after leaving the page', async () => {
    let resolve!: (value: unknown) => void;
    auth.requestJson.mockReturnValue(new Promise((done) => { resolve = done; }));
    const page = await loadPage();
    page.onLoad({ orderId: id });
    const refresh = page.refresh();
    page.onUnload();
    resolve({ ...order, status: 'fulfilled' });
    await refresh;
    expect(page.data.canPay).toBe(false);
    expect(page.data.message).not.toContain('支付已确认');
  });
});
