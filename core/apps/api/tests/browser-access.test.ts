import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({ getUserById: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ sql: vi.fn(), query: vi.fn() }));
vi.mock('../src/utils/account.js', () => ({
  getUserById: mocks.getUserById,
  findUserByWcaId: vi.fn(), findUserForLegacyWcaSession: vi.fn(),
  publicUser: (user: unknown) => user,
  isValidCountryIso2: vi.fn(), normalizeCountryIso2: vi.fn(),
}));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: vi.fn() }));
vi.mock('../src/utils/account_device.js', () => ({ captureAccountDevice: vi.fn() }));
vi.mock('../src/utils/identity_choice.js', () => ({ beginIdentityLogin: vi.fn() }));

import {
  signSession, signBrowserAccessSession, verifySession,
  hasFreshEmailGrant, hasFreshPhonePasswordResetGrant,
} from '../src/utils/session.js';
import { authRoutes, browserSessionGuard } from '../src/routes/auth.js';

describe('browser access session bounds', () => {
  const start = new Date('2026-10-07T12:00:00Z');
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(start); mocks.getUserById.mockReset(); });
  afterEach(() => vi.useRealTimers());

  it('issues a 15 minute token and cannot exchange that token again', () => {
    const durable = verifySession(signSession({ uid: 42, name: 'A' }));
    const access = verifySession(signBrowserAccessSession(durable));
    expect(access.browserAccess).toBe(true);
    expect(access.uid).toBe(42);
    expect(access.exp).toBe(start.getTime() / 1000 + 900);
    expect(() => signBrowserAccessSession(access)).toThrow('durable');
  });

  it('never exceeds the durable expiry and rejects the token once expired', () => {
    const durable = verifySession(signSession({ uid: 42 }));
    const token = signBrowserAccessSession({ ...durable, exp: start.getTime() / 1000 + 30 });
    expect(verifySession(token).exp).toBe(start.getTime() / 1000 + 30);
    vi.advanceTimersByTime(30_000);
    expect(() => verifySession(token)).toThrow('expired');
  });

  it('does not reopen the email password-reset grant when renewing browser access', () => {
    const durable = verifySession(signSession({ uid: 42, amr: 'email_code' }));
    vi.advanceTimersByTime(899_000);
    const before = signBrowserAccessSession(durable);
    expect(hasFreshEmailGrant(before)).toBe(true);
    vi.advanceTimersByTime(1_000);
    const after = signBrowserAccessSession(durable);
    expect(verifySession(after).iat).toBe(durable.iat);
    expect(verifySession(after).amr).toBe('email_code');
    expect(hasFreshEmailGrant(after)).toBe(false);
  });

  it('does not reopen the phone password-reset grant or grant it to normal phone login', () => {
    const durable = verifySession(signSession({ uid: 42, amr: 'phone_password_reset' }));
    vi.advanceTimersByTime(600_000);
    expect(hasFreshPhonePasswordResetGrant(signBrowserAccessSession(durable))).toBe(false);
    const normal = verifySession(signSession({ uid: 42, amr: 'phone_code' }));
    expect(hasFreshPhonePasswordResetGrant(signBrowserAccessSession(normal))).toBe(false);
  });

  it('refuses incomplete durable payloads', () => {
    expect(() => signBrowserAccessSession({ uid: 42 })).toThrow('durable');
    expect(() => signBrowserAccessSession({ uid: 42, iat: NaN, exp: Infinity })).toThrow('durable');
  });

  it('refuses browser tokens at both credential exchange endpoints before account lookup', async () => {
    const access = signBrowserAccessSession(verifySession(signSession({ uid: 42 })));
    for (const path of ['/auth/refresh', '/auth/browser-access']) {
      const response = await authRoutes.request(path, { method: 'POST', headers: { Authorization: `Bearer ${access}` } });
      expect(response.status).toBe(401);
    }
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it('refuses a deleted or merged account when exchanging a valid durable session', async () => {
    const durable = signSession({ uid: 42 });
    for (const user of [null, { id: 99 }]) {
      mocks.getUserById.mockResolvedValue(user);
      const response = await authRoutes.request('/auth/browser-access', {
        method: 'POST', headers: { Authorization: `Bearer ${durable}` },
      });
      expect(response.status).toBe(401);
    }
  });

  it('does not return a replacement session after durable expiry', async () => {
    const durable = signSession({ uid: 42 });
    vi.advanceTimersByTime(365 * 86400_000);
    const response = await authRoutes.request('/auth/browser-access', {
      method: 'POST', headers: { Authorization: `Bearer ${durable}` },
    });
    expect(response.status).toBe(401);
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it('returns current account data with a private, short-lived browser token', async () => {
    const durable = signSession({ uid: 42, name: 'Old' });
    mocks.getUserById.mockResolvedValue({ id: 42, wca_id: null, display_name: 'Current' });
    const response = await authRoutes.request('/auth/browser-access', {
      method: 'POST', headers: { Authorization: `Bearer ${durable}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.json();
    expect(verifySession(body.token)).toMatchObject({ uid: 42, name: 'Current', browserAccess: true });
    expect(body.sessionExpiresAt).toBe(verifySession(durable).exp! * 1000);
  });

  it('blocks all browser credential-minting and account mutation routes at the shared guard', async () => {
    const app = new Hono();
    app.use('/v1/*', browserSessionGuard);
    app.all('*', c => c.body(null, 204));
    const durable = signSession({ uid: 42 });
    const access = signBrowserAccessSession(verifySession(durable));
    for (const path of ['web-session/ticket', 'mobile-session/ticket', 'wechat/browser-session/approve', 'refresh', 'profile', 'unlink', 'account/merge']) {
      const url = `/v1/auth/${path}`;
      const browser = await app.request(url, { method: 'POST', headers: { Authorization: `Bearer ${access}` } });
      expect(browser.status, path).toBe(401);
      const native = await app.request(url, { method: 'POST', headers: { Authorization: `Bearer ${durable}` } });
      expect(native.status, path).toBe(204);
    }
  });

  it('allows the read-only account allowlist and normal business data operations', async () => {
    const app = new Hono();
    app.use('/v1/*', browserSessionGuard);
    app.all('*', c => c.body(null, 204));
    const access = signBrowserAccessSession(verifySession(signSession({ uid: 42 })));
    for (const path of ['me', 'profile', 'providers', 'identities']) {
      expect((await app.request(`/v1/auth/${path}`, { headers: { Authorization: `Bearer ${access}` } })).status).toBe(204);
    }
    expect((await app.request('/v1/recon', { method: 'POST', headers: { Authorization: `Bearer ${access}` } })).status).toBe(204);
    expect((await app.request('/v1/auth/unknown', { headers: { Authorization: `Bearer ${access}` } })).status).toBe(401);
    vi.advanceTimersByTime(900_000);
    expect((await app.request('/v1/auth/me', { headers: { Authorization: `Bearer ${access}` } })).status).toBe(401);
  });
});
