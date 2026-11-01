import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getStoredSession: vi.fn(), miniProgramLoginCode: vi.fn() }));
vi.mock('../src/lib/auth', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/auth')>(),
  ...auth,
}));
vi.mock('../src/lib/appearance', () => ({ applyNativeAppearance: vi.fn(), nativeAppearanceStyle: () => '' }));

const origin = 'https://api.cuberoot.me/v1/platform/instructor';
const payout = { id: 'payout-1', amountMinor: '100', currency: 'CNY', status: 'processing', transferState: 'WAIT_USER_CONFIRM' };
type Request = { url: string; method: string; data: unknown; header: Record<string, string>;
  success(response: { statusCode: number; data: unknown }): void; fail(error: { errMsg: string }): void };
interface PayoutPage {
  data: { name: string; agreed: boolean; busy: boolean; configured: boolean; error: string; loadError: string;
    availableMinor: number; available: string; payouts: typeof payout[] };
  setData(data: Partial<PayoutPage['data']>): void;
  load(): Promise<void>;
  bindWechat(): Promise<void>;
  requestPayout(): Promise<void>;
  confirmReceipt(event: { currentTarget: { dataset: { id: string } } }): Promise<void>;
}

let configured = false;
let writeFailure: { statusCode: number; message: string } | null = null;
const request = vi.fn((options: Request) => {
  const respond = (data: unknown, statusCode = 200) => options.success({ statusCode, data });
  if (options.method === 'POST' && writeFailure) {
    respond({ error: { message: writeFailure.message } }, writeFailure.statusCode);
  } else if (options.url === `${origin}/payout-profile`) {
    respond({ configured, method: configured ? 'wechat' : null });
  } else if (options.url === `${origin}/payout-profile/wechat`) {
    configured = true;
    respond({ configured: true, method: 'wechat' });
  } else if (options.url === `${origin}/payouts`) {
    respond(options.method === 'POST' ? { id: payout.id } : { payouts: [payout], availableMinor: 100 });
  } else if (options.url === `${origin}/payouts/${payout.id}/receipt`) {
    respond({ state: 'WAIT_USER_CONFIRM', appId: 'test-app', mchId: 'test-merchant', package: 'test-package' });
  } else respond({ error: 'Not found' }, 404);
});
const showModal = vi.fn();
const showToast = vi.fn();
const requestMerchantTransfer = vi.fn((options: { complete(): void }) => options.complete());

async function loadPage() {
  let page: PayoutPage | undefined;
  vi.stubGlobal('wx', { request, showModal, showToast, requestMerchantTransfer,
    canIUse: () => true, getAccountInfoSync: () => ({ miniProgram: { appId: 'test-app' } }) });
  vi.stubGlobal('Page', (options: PayoutPage) => { page = options; });
  await import('../src/pages/payouts/index');
  if (!page) throw new Error('Page not registered');
  page.setData = function (data) { Object.assign(this.data, data); };
  page.setData({ name: ' 测试姓名 ', agreed: true });
  return page;
}

beforeEach(() => {
  vi.useFakeTimers();
  configured = false;
  writeFailure = null;
  auth.getStoredSession.mockReturnValue({ token: 'session-token', user: { uid: 42 } });
  auth.miniProgramLoginCode.mockResolvedValue('one-use-code');
});
afterEach(() => { vi.clearAllMocks(); vi.resetModules(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('commission payout page', () => {
  it('uses the real request helper with exactly one /v1 prefix for reads and binding', async () => {
    const page = await loadPage();
    await page.load();
    expect(page.data.available).toBe('1.00');
    expect(page.data.loadError).toBe('');
    await page.bindWechat();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: `${origin}/payout-profile/wechat`, method: 'POST',
      data: { code: 'one-use-code', accountName: '测试姓名', agreed: true },
      header: expect.objectContaining({ Authorization: 'Bearer session-token' }),
    }));
    expect(request.mock.calls.map(([options]) => options.url)).toEqual([
      `${origin}/payout-profile`, `${origin}/payouts`, `${origin}/payout-profile/wechat`,
      `${origin}/payout-profile`, `${origin}/payouts`,
    ]);
    expect(page.data).toMatchObject({ configured: true, name: '', agreed: false, busy: false, error: '' });
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '微信收款设置成功' }));
  });

  it('uses the correct request and receipt URLs and reads payment status from the server', async () => {
    configured = true;
    const page = await loadPage();
    await page.load();
    await page.requestPayout();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: `${origin}/payouts`, method: 'POST',
      data: { amountMinor: 100, method: 'wechat', agreed: true } }));
    await page.confirmReceipt({ currentTarget: { dataset: { id: payout.id } } });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: `${origin}/payouts/${payout.id}/receipt`, method: 'POST' }));
    expect(requestMerchantTransfer).toHaveBeenCalledWith(expect.objectContaining({ appId: 'test-app', mchId: 'test-merchant', package: 'test-package' }));
    expect(page.data.payouts[0].status).toBe('processing');
    expect(page.data.busy).toBe(false);
  });

  it('gives visible feedback without requests when the session is missing', async () => {
    auth.getStoredSession.mockReturnValue(null);
    const page = await loadPage();
    await page.bindWechat();
    expect(showModal).toHaveBeenCalledWith(expect.objectContaining({ content: '请在“我的”登录本人讲师账号后重试' }));
    expect(auth.miniProgramLoginCode).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([{ name: ' ', agreed: true }, { name: '测试姓名', agreed: false }])('explains incomplete consent or name: %j', async form => {
    const page = await loadPage();
    page.setData(form);
    await page.bindWechat();
    expect(showModal).toHaveBeenCalledWith(expect.objectContaining({ content: '请填写微信实名姓名并确认本人收款' }));
    expect(request).not.toHaveBeenCalled();
  });

  it('preserves the business rejection and form through a background refresh', async () => {
    writeFailure = { statusCode: 403, message: '当前微信与登录账号不一致' };
    const page = await loadPage();
    await page.bindWechat();
    await page.load();
    expect(page.data).toMatchObject({ name: ' 测试姓名 ', agreed: true, error: writeFailure.message, busy: false, configured: false });
    expect(showModal).toHaveBeenCalledWith(expect.objectContaining({ content: writeFailure.message }));
    expect(showToast).not.toHaveBeenCalled();
  });

  it('explains missing instructor access without relaxing server authorization', async () => {
    writeFailure = { statusCode: 403, message: 'Active instructor access required' };
    const page = await loadPage();
    await page.bindWechat();
    expect(page.data.configured).toBe(false);
    expect(showModal).toHaveBeenCalledWith(expect.objectContaining({ content: '当前账号没有已启用的讲师身份，请使用本人讲师账号' }));
    expect(showToast).not.toHaveBeenCalled();
  });

  it('shows progress, prevents duplicate taps, and recovers from a network failure', async () => {
    let fail!: Request['fail'];
    request.mockImplementationOnce(options => { fail = options.fail; });
    const page = await loadPage();
    const pending = page.bindWechat();
    await Promise.resolve();
    expect(page.data.busy).toBe(true);
    await page.bindWechat();
    expect(auth.miniProgramLoginCode).toHaveBeenCalledTimes(1);
    fail({ errMsg: 'request:fail timeout' });
    await pending;
    expect(page.data).toMatchObject({ busy: false, configured: false, name: ' 测试姓名 ', agreed: true });
    expect(showModal).toHaveBeenCalledWith(expect.objectContaining({ content: '绑定结果待核对，请下拉刷新后重试' }));
    expect(showToast).not.toHaveBeenCalled();
  });

  it('retains the payout idempotency key when retrying an unconfirmed write', async () => {
    configured = true;
    const page = await loadPage();
    await page.load();
    writeFailure = { statusCode: 503, message: 'unavailable' };
    await page.requestPayout();
    writeFailure = null;
    await page.requestPayout();
    const writes = request.mock.calls.map(([options]) => options).filter(options => options.method === 'POST');
    expect(writes).toHaveLength(2);
    expect(writes[1].header['Idempotency-Key']).toBe(writes[0].header['Idempotency-Key']);
    expect(writes[1].data).toEqual(writes[0].data);
  });
});
