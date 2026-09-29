import { beforeEach, expect, it, vi } from 'vitest';
import type { WebSession } from '@cuberoot/shared/auth/web-session';
import type { AppleMembershipRequest } from '@cuberoot/shared/apple-membership';
const mocks = vi.hoisted(() => ({ restoreSession: vi.fn(), purchase: vi.fn(), products: vi.fn(), transactions: vi.fn(), restore: vi.fn(), finish: vi.fn(), manage: vi.fn(), fetch: vi.fn() }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => mocks }));
vi.mock('../src/mobile-auth', () => ({ nativeMobileAuth: { restore: mocks.restoreSession } }));
vi.mock('@cuberoot/app-ui', () => ({ mobileApiUrl: (path: string) => `https://api.example.test${path}` }));
import { handleAppleMembership } from '../src/apple-membership';
const session = { token: 'test-token', user: { uid: 7 } } as WebSession;
const request = (action: AppleMembershipRequest['action']): AppleMembershipRequest => ({ type: 'cuberoot:mobile:apple-membership', surface: 'account', expectedUid: 7, requestId: 'test', action, productId: 'me.cuberoot.app.membership.monthly' });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch);
  mocks.restoreSession.mockResolvedValue(session);
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ appAccountToken: 'test-account-token' }) });
  mocks.purchase.mockResolvedValue({ status: 'purchased', transactionId: '123', signedTransaction: 'signed' });
  mocks.finish.mockResolvedValue(undefined);
});
it('acknowledges a transaction only after server verification succeeds', async () => {
  expect(await handleAppleMembership(request('purchase'), session)).toEqual({ status: 'success' });
  expect(mocks.fetch.mock.calls[1][1].body).toBe(JSON.stringify({ signedTransaction: 'signed' }));
  expect(mocks.finish).toHaveBeenCalledWith({ transactionId: '123' });
  expect(mocks.finish.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.fetch.mock.invocationCallOrder[1]);
});
it('retains unfinished transactions when verification fails', async () => {
  mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ appAccountToken: 'token' }) }).mockResolvedValueOnce({ ok: false });
  await expect(handleAppleMembership(request('purchase'), session)).rejects.toThrow();
  expect(mocks.finish).not.toHaveBeenCalled();
});
it.each(['pending', 'cancelled'] as const)('does not grant or finish a %s purchase', async status => {
  mocks.purchase.mockResolvedValue({ status });
  expect(await handleAppleMembership(request('purchase'), session)).toEqual({ status });
  expect(mocks.fetch).toHaveBeenCalledTimes(1); expect(mocks.finish).not.toHaveBeenCalled();
});
it('rejects an account switch before opening StoreKit', async () => {
  mocks.restoreSession.mockResolvedValue({ ...session, user: { uid: 8 } });
  await expect(handleAppleMembership(request('purchase'), session)).rejects.toThrow('Account changed');
  expect(mocks.purchase).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
});
it('still reconciles a valid transaction after an unrelated account transaction fails', async () => {
  mocks.restore.mockResolvedValue({ transactions: [{ transactionId: '1', signedTransaction: 'other' }, { transactionId: '2', signedTransaction: 'ours' }] });
  mocks.fetch.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  await expect(handleAppleMembership(request('restore'), session)).rejects.toThrow();
  expect(mocks.finish).toHaveBeenCalledExactlyOnceWith({ transactionId: '2' });
});
