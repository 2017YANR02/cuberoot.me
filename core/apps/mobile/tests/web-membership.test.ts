import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WebSession } from '@cuberoot/shared/auth/web-session';
import type { WebMembershipRequest } from '@cuberoot/shared/mobile-embed';

const mocks = vi.hoisted(() => ({ direct: true, restore: vi.fn(), open: vi.fn(), remove: vi.fn(), callbacks: new Map<string, (value?: unknown) => void>() }));
vi.mock('../src/distribution', () => ({ usesDirectPayments: () => mocks.direct }));
vi.mock('../src/mobile-auth', () => ({ nativeMobileAuth: { restore: mocks.restore } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: async (event: string, listener: (value?: unknown) => void) => {
  mocks.callbacks.set(event, listener); return { remove: mocks.remove };
} } }));
vi.mock('@capacitor/browser', () => ({ Browser: { open: mocks.open, addListener: async (event: string, listener: (value?: unknown) => void) => {
  mocks.callbacks.set(event, listener); return { remove: mocks.remove };
} } }));
import { handleWebMembership } from '../src/web-membership';

const session = { token: 'secret-session', user: { uid: 7 } } as WebSession;
const request: WebMembershipRequest = { type: 'cuberoot:mobile:web-membership', surface: 'account', expectedUid: 7,
  requestId: 'test-request', language: 'zh', href: 'https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=test' };
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); mocks.callbacks.clear(); mocks.direct = true;
  mocks.restore.mockResolvedValue(session); mocks.open.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

it('opens the merchant relay without transferring auth and treats returning only as a query hint', async () => {
  const result = handleWebMembership(request, session); await flush();
  const url = new URL(mocks.open.mock.calls[0][0].url);
  expect(url.origin + url.pathname).toBe('https://cuberoot.me/zh/membership/checkout');
  expect(url.href).not.toContain(session.token);
  expect(new URLSearchParams(url.hash.slice(1)).get('checkout')).toBe(request.href);
  mocks.callbacks.get('appStateChange')!({ isActive: true });
  expect(await result).toEqual({ status: 'returned' });
  expect(mocks.remove).toHaveBeenCalledTimes(2);
});
it('cancellation never reports a successful payment', async () => {
  const result = handleWebMembership(request, session); await flush();
  mocks.callbacks.get('browserFinished')!();
  expect(await result).toEqual({ status: 'returned' });
});
it('releases listeners on a bounded timeout', async () => {
  const result = handleWebMembership(request, session); await flush();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(await result).toEqual({ status: 'opened' });
  expect(mocks.remove).toHaveBeenCalledTimes(2);
});
it('rejects Play, arbitrary URLs and an account change before opening', async () => {
  mocks.direct = false;
  await expect(handleWebMembership(request, session)).rejects.toThrow();
  mocks.direct = true;
  await expect(handleWebMembership({ ...request, href: 'https://evil.test' }, session)).rejects.toThrow();
  mocks.restore.mockResolvedValue({ user: { uid: 8 } });
  await expect(handleWebMembership(request, session)).rejects.toThrow('account changed');
  expect(mocks.open).not.toHaveBeenCalled();
});
it('rechecks the account after returning and rejects concurrent cashiers', async () => {
  const result = handleWebMembership(request, session); await flush();
  await expect(handleWebMembership(request, session)).rejects.toThrow();
  mocks.restore.mockResolvedValue({ user: { uid: 8 } });
  const rejected = expect(result).rejects.toThrow('account changed');
  mocks.callbacks.get('browserFinished')!(); await rejected;
});
it('cleans up after a browser launch failure', async () => {
  mocks.open.mockRejectedValue(new Error('no browser'));
  await expect(handleWebMembership(request, session)).rejects.toThrow('no browser');
  expect(mocks.remove).toHaveBeenCalledTimes(2);
});
