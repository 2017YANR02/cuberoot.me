import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createNativeAccountLinkPageOptions } from '../src/lib/native-account-link';
import { requestJson } from '../src/lib/auth';

vi.mock('../src/lib/auth', async original => ({ ...await original<typeof import('../src/lib/auth')>(), requestJson: vi.fn() }));
vi.mock('../src/lib/appearance', () => ({ applyNativeAppearance: vi.fn() }));
const session = { token: 'temporary-session-token-only', user: { uid: 42, name: 'Existing account', wcaId: null, avatar: '' }, isNew: false };
const clipboard = vi.fn(), storage = vi.fn();
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  vi.stubGlobal('wx', { getStorageSync: () => 'en', getAppBaseInfo: () => ({ language: 'en' }), setNavigationBarTitle: vi.fn(), setClipboardData: clipboard, setStorageSync: storage });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function fixture() {
  const options = createNativeAccountLinkPageOptions();
  const page = { ...options, data: { ...options.data, email: ' Existing@Example.com ', code: '123456', agreement: true },
    setData(value: object) { Object.assign(this.data, value); } };
  page.onShow();
  return page;
}
it.each([1, 2])('verifies existing accounts with native password or SMS method %s without installing tokens', async method => {
  const page = fixture();
  page.data.method = method;
  page.data.email = method === 1 ? 'member@example.com' : '13800138000';
  page.data.password = 'local-fixture-password';
  vi.mocked(requestJson).mockResolvedValueOnce(session).mockResolvedValueOnce({ linkCode: '654321', expiresInSeconds: 60 });
  await page.generateCode();
  expect(requestJson).toHaveBeenNthCalledWith(1, method === 1 ? '/auth/email/password' : '/auth/phone/verify', {
    method: 'POST', body: method === 1 ? { email: 'member@example.com', password: 'local-fixture-password' }
      : { phone: '+8613800138000', code: '123456', purpose: 'login', existingOnly: true },
  });
  expect(page.data.linkCode).toBe('654321');
  expect(page.data.password).toBe('');
  expect(storage).not.toHaveBeenCalled();
});
it('verifies only an existing account and issues a uid-bound code without installing its session', async () => {
  vi.mocked(requestJson).mockResolvedValueOnce(session).mockResolvedValueOnce({ linkCode: '654321', expiresInSeconds: 60 });
  const page = fixture();
  await page.generateCode();
  expect(requestJson).toHaveBeenNthCalledWith(1, '/auth/email/verify', { method: 'POST', body: { email: 'existing@example.com', code: '123456', existingOnly: true } });
  expect(requestJson).toHaveBeenNthCalledWith(2, '/auth/identity/link-code', { method: 'POST', token: session.token, body: { expectedUid: 42 } });
  expect(page.data.linkCode).toBe('654321');
  expect(page.data.code).toBe('');
  expect(JSON.stringify(page.data)).not.toContain(session.token);
  expect(storage).not.toHaveBeenCalled();
  page.copyCode();
  expect(clipboard).toHaveBeenCalledWith(expect.objectContaining({ data: '654321' }));
  vi.advanceTimersByTime(60_000);
  expect(page.data.linkCode).toBe('');
  page.copyCode();
  expect(clipboard).toHaveBeenCalledTimes(1);
});
it.each(['verify', 'issue'])('discards a late %s response after leaving the page', async step => {
  let resolve!: (value: unknown) => void;
  const deferred = new Promise(r => { resolve = r; });
  if (step === 'issue') vi.mocked(requestJson).mockResolvedValueOnce(session);
  vi.mocked(requestJson).mockReturnValueOnce(deferred);
  const page = fixture();
  const pending = page.generateCode();
  await Promise.resolve();
  page.onHide();
  page.onShow();
  resolve(step === 'verify' ? session : { linkCode: '654321', expiresInSeconds: 60 });
  await pending;
  expect(page.data).toMatchObject({ linkCode: '', code: '', busy: false });
  expect(requestJson).toHaveBeenCalledTimes(step === 'verify' ? 1 : 2);
  expect(storage).not.toHaveBeenCalled();
});
it('requires consent, prevents duplicate requests and never accepts a newly created account', async () => {
  const page = fixture();
  page.data.agreement = false;
  await page.generateCode(); await page.sendCode();
  expect(requestJson).not.toHaveBeenCalled();
  page.data.agreement = true;
  vi.mocked(requestJson).mockResolvedValueOnce({ ...session, isNew: true });
  const pending = page.generateCode();
  await page.generateCode();
  await pending;
  expect(requestJson).toHaveBeenCalledTimes(1);
  expect(page.data.linkCode).toBe('');
  expect(page.data.error).not.toBe('');
});
it('bounds email sends and clears visible credentials on hide', async () => {
  const page = fixture();
  vi.mocked(requestJson).mockResolvedValue({ ok: true });
  await page.sendCode(); await page.sendCode();
  expect(requestJson).toHaveBeenCalledTimes(1);
  page.onHide();
  expect(page.data.code).toBe('');
});
