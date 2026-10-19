import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ requestJson: vi.fn(), getStoredSession: vi.fn(), miniProgramLoginCode: vi.fn() }));
vi.mock('../src/lib/auth', () => auth);
vi.mock('../src/lib/appearance', () => ({ applyNativeAppearance: vi.fn() }));
vi.mock('../src/lib/required-session', () => ({ openRequiredSessionLogin: vi.fn() }));
vi.mock('../src/lib/i18n', () => ({ tr: (v: { zh: string }) => v.zh }));
interface MembershipPage {
  data: { agreed: boolean; canSign: boolean; message: string; error: string; busy: boolean };
  setData(data: Partial<MembershipPage['data']>): void;
  onLoad(options: Record<string, string>): void;
  onShow(): void;
  onUnload(): void;
  refresh(): Promise<void>;
  sign(): Promise<void>;
}
const context = { account: 'owner', name: 'Name', planSlug: 'personal-monthly', priceCents: 2999, period: 'month', termsVersion: '2026-10-14', available: true };
let subscriptions: unknown[] = [];
async function load(target = 'wechat') {
  let page!: MembershipPage;
  const navigate = vi.fn((o: { success(): void }) => o.success());
  vi.stubGlobal('__MINI_PROGRAM_TARGET__', target);
  vi.stubGlobal(target === 'wechat' ? 'wx' : 'tt', { setNavigationBarTitle: vi.fn(), navigateToMiniProgram: navigate });
  vi.stubGlobal('Page', (p: MembershipPage) => { page = p; });
  await import('../src/pages/membership/index');
  page.setData = function (data) { Object.assign(this.data, data); };
  page.onLoad({ ticket: 'ticket' });
  page.onShow();
  await page.refresh();
  return { page, navigate };
}
beforeEach(() => {
  subscriptions = [];
  auth.getStoredSession.mockReturnValue({ token: 'token' });
  auth.miniProgramLoginCode.mockResolvedValue('login-code');
  auth.requestJson.mockImplementation((path: string) => Promise.resolve(path.endsWith('mini-context') ? context : path.endsWith('mini-enroll') ? { miniProgram: { appId: 'wxbd687630cd02ce1d', path: 'pages/index/index', extraData: {} } } : { subscriptions }));
});
afterEach(() => { vi.clearAllMocks(); vi.resetModules(); vi.unstubAllGlobals(); });
it('requires consent and never treats navigation success as payment', async () => {
  const { page, navigate } = await load();
  await page.sign();
  expect(navigate).not.toHaveBeenCalled();
  page.data.agreed = true;
  await page.sign();
  expect(navigate).toHaveBeenCalledOnce();
  expect(page.data.message).not.toContain('付款已确认');
  subscriptions = [{ id: 'contract', state: 'active', billingStatus: 'paid', syncStatus: 'ok' }];
  await page.refresh();
  expect(page.data.message).toContain('付款已确认');
  expect(page.data.canSign).toBe(false);
});
it('does not enroll if account changes during login', async () => {
  const { page, navigate } = await load();
  page.data.agreed = true;
  auth.miniProgramLoginCode.mockImplementation(async () => { auth.getStoredSession.mockReturnValue({ token: 'other' }); return 'code'; });
  await page.sign();
  expect(auth.requestJson.mock.calls.some(([path]) => path.endsWith('mini-enroll'))).toBe(false);
  expect(navigate).not.toHaveBeenCalled();
});
it('does not update an unloaded page or enroll on Douyin', async () => {
  const { page } = await load();
  let reject!: (reason: unknown) => void;
  auth.requestJson.mockReturnValue(new Promise((_, r) => { reject = r; }));
  const pending = page.refresh();
  page.onUnload();
  const setData = vi.spyOn(page, 'setData');
  reject(new Error('late'));
  await pending;
  expect(setData).not.toHaveBeenCalled();
  vi.resetModules(); auth.requestJson.mockClear();
  const other = await load('douyin');
  other.page.data.agreed = true;
  await other.page.sign();
  expect(auth.requestJson).not.toHaveBeenCalled();
  expect(other.navigate).not.toHaveBeenCalled();
});
