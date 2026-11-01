// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ uid: 1, token: 'one', listeners: new Set<() => void>() }));
const api = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({
  getSessionToken: () => auth.token,
  useAuthStore: { getState: () => ({ user: auth.uid ? { uid: auth.uid } : null }), subscribe: (fn: () => void) => { auth.listeners.add(fn); return () => auth.listeners.delete(fn); } },
}));
vi.mock('@/lib/account-api', () => ({ fetchAccountDeskPetSelection: api.fetch, updateAccountDeskPetSelection: api.save }));
import { getDeskPetSelection, setDeskPetSelection, subscribeDeskPetSelection, syncDeskPetSelection } from '@/lib/deskpet-selection';
let stop: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear(); auth.uid = 1; auth.token = 'one';
  api.fetch.mockReset().mockResolvedValue(null); api.save.mockReset().mockResolvedValue({ok:true});
});
afterEach(async () => { stop?.(); stop = undefined; await syncDeskPetSelection(); });
const switchAccount = (uid: number) => { auth.uid = uid; auth.token = String(uid); for (const fn of auth.listeners) fn(); };
it('downloads cloud choice on a new device, preferring it over the legacy browser choice', async () => {
  localStorage.setItem('clawd-deskpet-char', 'rootbeast');
  api.fetch.mockResolvedValue('clawd');
  await syncDeskPetSelection();
  expect(getDeskPetSelection()).toBe('clawd'); expect(api.save).not.toHaveBeenCalled();
  expect(localStorage.getItem('clawd-deskpet-char')).toBeNull();
});
it('migrates legacy choice once for an empty account, without leaking it to another account', async () => {
  localStorage.setItem('clawd-deskpet-char', 'clawd');
  await syncDeskPetSelection();
  expect(api.save).toHaveBeenCalledWith('clawd', 1, expect.any(AbortSignal));
  switchAccount(2); await syncDeskPetSelection();
  expect(getDeskPetSelection()).toBeNull(); expect(api.save).toHaveBeenCalledTimes(1);
});
it('keeps offline changes pending and retries them when online', async () => {
  api.fetch.mockRejectedValue(new Error('offline'));
  setDeskPetSelection('clawd'); await syncDeskPetSelection();
  expect(getDeskPetSelection()).toBe('clawd');
  api.fetch.mockResolvedValue('rootbeast');
  stop = subscribeDeskPetSelection(() => {}); await syncDeskPetSelection();
  expect(api.save).toHaveBeenCalledWith('clawd', 1, expect.any(AbortSignal));
  expect(JSON.parse(localStorage.getItem('clawd-deskpet-char:account:1')!).pending).toBe(false);
  api.fetch.mockResolvedValue('calico'); window.dispatchEvent(new Event('focus')); await syncDeskPetSelection();
  expect(getDeskPetSelection()).toBe('calico');
});
it('ignores an old account response after switching accounts', async () => {
  let resolve!: (value: string) => void;
  api.fetch.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue('calico');
  stop = subscribeDeskPetSelection(() => {});
  const old = syncDeskPetSelection();
  switchAccount(2); await syncDeskPetSelection();
  resolve('clawd'); await old;
  expect(getDeskPetSelection()).toBe('calico'); expect(api.save).not.toHaveBeenCalled();
});
it('saves the latest choice when the user changes it during an in-flight write', async () => {
  let resolve!: () => void;
  api.save.mockImplementationOnce(() => new Promise<void>(r => { resolve = r; }));
  setDeskPetSelection('clawd');
  await vi.waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  setDeskPetSelection('calico'); resolve(); await syncDeskPetSelection();
  expect(api.save.mock.calls.map(call => call[0])).toEqual(['clawd', 'calico']);
  expect(getDeskPetSelection()).toBe('calico');
});
it('does not send visitor choices to an account', async () => {
  auth.uid = 0; auth.token = '';
  setDeskPetSelection('clawd'); await syncDeskPetSelection();
  expect(getDeskPetSelection()).toBe('clawd'); expect(api.save).not.toHaveBeenCalled(); expect(api.fetch).not.toHaveBeenCalled();
});
