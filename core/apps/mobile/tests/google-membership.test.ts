import { beforeEach, expect, it, vi } from 'vitest';
import type { WebSession } from '@cuberoot/shared/auth/web-session';
import type { GoogleMembershipRequest } from '@cuberoot/shared/google-membership';
const mocks = vi.hoisted(() => ({ restoreSession: vi.fn(), purchase: vi.fn(), products: vi.fn(), purchases: vi.fn(), manage: vi.fn(), fetch: vi.fn() }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => mocks }));
vi.mock('../src/mobile-auth', () => ({ nativeMobileAuth: { restore: mocks.restoreSession } }));
vi.mock('@cuberoot/app-ui', () => ({ mobileApiUrl: (path: string) => `https://api.example.test${path}` }));
import { handleGoogleMembership } from '../src/google-membership';
const session = { token: 'fixture', user: { uid: 7 } } as WebSession;
const request = (action: GoogleMembershipRequest['action']): GoogleMembershipRequest => ({ type: 'cuberoot:mobile:google-membership', surface: 'account', expectedUid: 7, requestId: 'fixture-request', action, productId: 'me.cuberoot.app.membership.monthly' });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch);
  mocks.restoreSession.mockResolvedValue(session);
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ obfuscatedAccountId: 'fixture-account' }) });
  mocks.purchase.mockResolvedValue({ status: 'purchased', purchaseToken: 'fixture-purchase-token' });
  mocks.purchases.mockResolvedValue({ purchases: [] });
});
it('only sends the token to the authenticated server, never to the website', async () => {
  expect(await handleGoogleMembership(request('purchase'), session)).toEqual({ status: 'success' });
  expect(mocks.fetch.mock.calls[1][1].body).toBe(JSON.stringify({ purchaseToken: 'fixture-purchase-token' }));
});
it.each(['pending', 'cancelled'] as const)('%s never verifies or grants', async status => {
  mocks.purchase.mockResolvedValue({ status });
  expect(await handleGoogleMembership(request('purchase'), session)).toEqual({ status });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});
it('rejects a queued request after an account switch', async () => {
  mocks.restoreSession.mockResolvedValue({ ...session, user: { uid: 8 } });
  await expect(handleGoogleMembership(request('purchase'), session)).rejects.toThrow('Account changed');
  expect(mocks.purchase).not.toHaveBeenCalled();
});
it('verification failure does not report success', async () => {
  mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ obfuscatedAccountId: 'fixture-account' }) }).mockResolvedValueOnce({ ok: false });
  await expect(handleGoogleMembership(request('purchase'), session)).rejects.toThrow();
});
it('rechecks the account after the server preflight before opening payment', async () => {
  mocks.restoreSession.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...session, user: { uid: 8 } });
  await expect(handleGoogleMembership(request('purchase'), session)).rejects.toThrow('Account changed');
  expect(mocks.purchase).not.toHaveBeenCalled();
});
it('an empty device purchase query still reconciles persisted refunds', async () => {
  await handleGoogleMembership(request('restore'), session);
  expect(mocks.fetch.mock.calls.at(-1)![0]).toContain('/google/sync');
});
