import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createNativeAccountDeletePageOptions } from '../src/lib/native-account-delete';
import { clearStoredSession, fetchNativeAccountIdentities, getStoredSession, requestJson } from '../src/lib/auth';
vi.mock('../src/lib/auth', async original => ({ ...await original<typeof import('../src/lib/auth')>(),
  clearStoredSession: vi.fn(), fetchNativeAccountIdentities: vi.fn(), getStoredSession: vi.fn(), requestJson: vi.fn() }));
vi.mock('../src/lib/appearance', () => ({ applyNativeAppearance: vi.fn() }));
const session = { token: 'original-session-token', user: { uid: 12, name: 'Member', wcaId: null } };
let modal: { success(value: { confirm: boolean }): Promise<void> };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStoredSession).mockReturnValue(session);
  vi.mocked(clearStoredSession).mockReturnValue(true);
  vi.mocked(fetchNativeAccountIdentities).mockResolvedValue({ identities: [{ provider: 'email', providerUid: 'member@example.com' }], hasPassword: true });
  vi.stubGlobal('wx', { getStorageSync: () => 'en', showModal: (options: typeof modal) => { modal = options; } });
});
afterEach(() => vi.unstubAllGlobals());
async function fixture() {
  const options = createNativeAccountDeletePageOptions();
  const page = { ...options, data: { ...options.data }, setData(value: object) { Object.assign(this.data, value); } };
  await page.loadAccount();
  page.data.confirm = 'member@example.com'; page.data.password = 'local-fixture-password';
  return page;
}
it('requires a matching handle, password and a separate explicit confirmation', async () => {
  const page = await fixture();
  page.data.confirm = 'wrong'; page.deleteAccount();
  expect(requestJson).not.toHaveBeenCalled();
  page.data.confirm = 'member@example.com'; page.deleteAccount();
  await modal.success({ confirm: false });
  expect(requestJson).not.toHaveBeenCalled();
  page.deleteAccount();
  vi.mocked(requestJson).mockResolvedValue({ ok: true });
  await modal.success({ confirm: true });
  await modal.success({ confirm: true });
  expect(requestJson).toHaveBeenCalledTimes(1);
  expect(requestJson).toHaveBeenCalledWith('/auth/account/delete', {
    method: 'POST', token: session.token, body: { confirm: 'member@example.com', password: 'local-fixture-password' },
  });
  expect(page.data).toMatchObject({ done: true, password: '', confirm: '' });
  expect(clearStoredSession).toHaveBeenCalledOnce();
});
it.each(['switch', 'hide'])('does not submit after %s before confirmation', async scenario => {
  const page = await fixture(); page.deleteAccount();
  if (scenario === 'switch') vi.mocked(getStoredSession).mockReturnValue({ ...session, token: 'new-session-token' });
  else page.onHide();
  await modal.success({ confirm: true });
  expect(requestJson).not.toHaveBeenCalled();
  expect(clearStoredSession).not.toHaveBeenCalled();
});
it('does not clear a new session when a confirmed deletion finishes late', async () => {
  const page = await fixture(); page.deleteAccount();
  let resolve!: (value: unknown) => void;
  vi.mocked(requestJson).mockReturnValue(new Promise(r => { resolve = r; }));
  const deleting = modal.success({ confirm: true });
  page.onHide();
  vi.mocked(getStoredSession).mockReturnValue({ ...session, token: 'new-session-token' });
  resolve({ ok: true }); await deleting;
  expect(clearStoredSession).not.toHaveBeenCalled();
  expect(page.data.password).toBe('');
});
it('keeps storage failures distinct from successful deletion and never retries writes', async () => {
  const page = await fixture(); page.deleteAccount();
  vi.mocked(requestJson).mockResolvedValue({ ok: true });
  vi.mocked(clearStoredSession).mockReturnValue(false);
  await modal.success({ confirm: true });
  expect(page.data.done).toBe(true);
  expect(page.data.error).toContain('cleanup failed');
  page.deleteAccount();
  expect(requestJson).toHaveBeenCalledOnce();
});
