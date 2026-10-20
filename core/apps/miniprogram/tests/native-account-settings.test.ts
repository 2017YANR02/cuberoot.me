import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createNativeAccountSettingsPageOptions } from '../src/lib/native-account-settings';
import { fetchNativeAccountIdentities, getStoredSession, requestJson } from '../src/lib/auth';
vi.mock('../src/lib/auth', async original => ({ ...await original<typeof import('../src/lib/auth')>(),
  fetchNativeAccountIdentities: vi.fn(), getStoredSession: vi.fn(), requestJson: vi.fn() }));
vi.mock('../src/lib/appearance', () => ({ applyNativeAppearance: vi.fn() }));
const session = { token: 'original-session-token', user: { uid: 12, name: 'Member', wcaId: null } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStoredSession).mockReturnValue(session);
  vi.mocked(fetchNativeAccountIdentities).mockResolvedValue({ identities: [], hasPassword: false });
  vi.stubGlobal('wx', { getStorageSync: () => 'en' });
});
afterEach(() => vi.unstubAllGlobals());
async function fixture(bound = false) {
  if (bound) vi.mocked(fetchNativeAccountIdentities).mockResolvedValue({
    identities: [{ provider: 'email', providerUid: 'old@example.com' }], hasPassword: true,
  });
  const options = createNativeAccountSettingsPageOptions();
  const page = { ...options, data: { ...options.data }, setData(value: object) { Object.assign(this.data, value); } };
  await page.loadAccount();
  return page;
}
it.each([false, true])('uses the canonical verification or replacement endpoint: bound=%s', async bound => {
  const page = await fixture(bound);
  Object.assign(page.data, { destination: ' New@Example.com ', code: '123456', consent: true });
  vi.mocked(requestJson).mockResolvedValue({ ok: true });
  await page.bindCredential();
  expect(requestJson).toHaveBeenCalledWith(bound ? '/auth/email/replace' : '/auth/link/email/verify',
    { method: 'POST', token: session.token, body: { email: 'new@example.com', code: '123456' } });
  expect(requestJson).toHaveBeenCalledOnce();
  expect(page.data.code).toBe('');
  expect(page.data.destination).toBe('');
});
it('requires consent for code sending and bounds repeated sends', async () => {
  const page = await fixture();
  page.data.destination = 'member@example.com';
  await page.sendCode();
  expect(requestJson).not.toHaveBeenCalled();
  page.data.consent = true;
  vi.mocked(requestJson).mockResolvedValue({ ok: true });
  await page.sendCode(); await page.sendCode();
  expect(requestJson).toHaveBeenCalledOnce();
});
it('does not submit an account change with an outdated session', async () => {
  const page = await fixture();
  Object.assign(page.data, { destination: 'member@example.com', code: '123456', consent: true });
  vi.mocked(getStoredSession).mockReturnValue({ ...session, token: 'another-token' });
  await page.bindCredential();
  expect(requestJson).not.toHaveBeenCalled();
});
it('validates current and repeated passwords and never persists secrets', async () => {
  const page = await fixture(true);
  Object.assign(page.data, { newPassword: 'new-password', repeatPassword: 'different' });
  await page.savePassword();
  expect(requestJson).not.toHaveBeenCalled();
  Object.assign(page.data, { repeatPassword: 'new-password', currentPassword: 'old-password' });
  vi.mocked(requestJson).mockResolvedValue({ ok: true });
  await page.savePassword();
  expect(requestJson).toHaveBeenCalledWith('/auth/password/set', { method: 'POST', token: session.token,
    body: { password: 'new-password', currentPassword: 'old-password' } });
  expect(page.data.currentPassword).toBe('');
  expect(page.data.newPassword).toBe('');
});
it('clears sensitive inputs on hide and rejects late responses', async () => {
  const page = await fixture();
  Object.assign(page.data, { destination: 'member@example.com', code: '123456', consent: true });
  let resolve!: (value: unknown) => void;
  vi.mocked(requestJson).mockReturnValue(new Promise(r => { resolve = r; }));
  const saving = page.bindCredential();
  page.onHide();
  resolve({ ok: true }); await saving;
  expect(page.data).toMatchObject({ ready: false, busy: false, code: '', destination: '', message: '' });
  expect(fetchNativeAccountIdentities).toHaveBeenCalledOnce();
});
