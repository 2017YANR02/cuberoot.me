import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeWebSessionError,
  decodeWebSession,
  decodeWebSessionTicketEnvelope,
} from '@cuberoot/shared/auth/web-session';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  consumeMobileSessionTicket: vi.fn(),
  consumeWebSessionTicket: vi.fn(),
  douyinMiniProgramConfigured: vi.fn(),
  exchangeDouyinMiniProgramCode: vi.fn(),
  exchangeWechatMiniProgramCode: vi.fn(),
  getAccountBasicProfile: vi.fn(),
  getUserById: vi.fn(),
  issueMobileSessionTicket: vi.fn(),
  issueWebSessionTicket: vi.fn(),
  loginWithIdentity: vi.fn(),
  publicUser: vi.fn(),
  requireAppUserId: vi.fn(),
  signSession: vi.fn(),
  updateClawdAvatar: vi.fn(),
  updateAccountBasicProfile: vi.fn(),
  wechatMiniProgramConfigured: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: () => '127.0.0.1' }));
vi.mock('../src/utils/recon_helpers.js', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('../src/utils/session.js', () => ({
  hasFreshEmailGrant: vi.fn(),
  signSession: mocks.signSession,
}));
vi.mock('../src/utils/account.js', () => ({
  getUserById: mocks.getUserById,
  getAccountBasicProfile: mocks.getAccountBasicProfile,
  loginWithIdentity: mocks.loginWithIdentity,
  publicUser: mocks.publicUser,
  updateClawdAvatar: mocks.updateClawdAvatar,
  updateAccountBasicProfile: mocks.updateAccountBasicProfile,
  isAccountGender: (value: unknown) => ['male', 'female', 'nonbinary', 'other', 'undisclosed'].includes(String(value)),
  isValidBirthDate: (value: unknown, today: string) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= today,
  normalizeCountryIso2: (value: string) => value.trim().toUpperCase(),
  isValidCountryIso2: (value: unknown) => typeof value === 'string' && /^[A-Z]{2}$/.test(value),
}));
vi.mock('../src/utils/wechat_miniprogram.js', () => ({
  exchangeWechatMiniProgramCode: mocks.exchangeWechatMiniProgramCode,
  WechatMiniProgramError: class WechatMiniProgramError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
      this.name = 'WechatMiniProgramError';
    }
  },
  wechatMiniProgramConfigured: mocks.wechatMiniProgramConfigured,
}));
vi.mock('../src/utils/douyin_miniprogram.js', () => ({
  douyinMiniProgramConfigured: mocks.douyinMiniProgramConfigured,
  exchangeDouyinMiniProgramCode: mocks.exchangeDouyinMiniProgramCode,
  DouyinMiniProgramError: class DouyinMiniProgramError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
      this.name = 'DouyinMiniProgramError';
    }
  },
}));
vi.mock('../src/utils/web_session_ticket.js', () => ({
  consumeMobileSessionTicket: mocks.consumeMobileSessionTicket,
  consumeWebSessionTicket: mocks.consumeWebSessionTicket,
  issueMobileSessionTicket: mocks.issueMobileSessionTicket,
  issueWebSessionTicket: mocks.issueWebSessionTicket,
}));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: mocks.requireAppUserId }));

import { accountAuthRoutes } from '../src/routes/account_auth.js';
import { DouyinMiniProgramError } from '../src/utils/douyin_miniprogram.js';
import { WechatMiniProgramError } from '../src/utils/wechat_miniprogram.js';

const account = {
  id: 42,
  wca_id: null,
  display_name: '',
  avatar_url: null,
};
const publicAccount = {
  uid: 42,
  wcaId: null,
  name: '',
  avatar: '',
  avatarSource: 'auto' as const,
  avatarPreset: null,
};
const token = 's'.repeat(20);
const ticket = 'A'.repeat(43);
const codeChallenge = 'C'.repeat(43);
const codeVerifier = 'V'.repeat(43);

describe('auth route wire contracts', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.signSession.mockReturnValue(token);
    mocks.publicUser.mockReturnValue(publicAccount);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the real first-time WeChat session shape with an empty display name', async () => {
    mocks.wechatMiniProgramConfigured.mockReturnValue(true);
    mocks.exchangeWechatMiniProgramCode.mockResolvedValue({
      openid: 'openid-1',
      unionid: 'unionid-1',
      sessionKey: 'session-key',
    });
    mocks.loginWithIdentity.mockResolvedValue({ user: account, isNew: true });

    const response = await accountAuthRoutes.request('/auth/wechat/miniprogram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'wx-code' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ token, user: publicAccount, isNew: true });
    expect(decodeWebSession(body)).toEqual({ token, user: publicAccount });
    expect(mocks.loginWithIdentity).toHaveBeenCalledWith('wechat', 'unionid-1', { name: '' });
  });

  it('uses only Douyin openid in the existing identity and session flow', async () => {
    mocks.douyinMiniProgramConfigured.mockReturnValue(true);
    mocks.exchangeDouyinMiniProgramCode.mockResolvedValue({ openid: 'douyin-openid-1' });
    mocks.loginWithIdentity.mockResolvedValue({ user: account, isNew: true });

    const response = await accountAuthRoutes.request('/auth/douyin/miniprogram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'douyin-code' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token, user: publicAccount, isNew: true });
    expect(mocks.loginWithIdentity).toHaveBeenCalledWith(
      'douyin',
      'douyin-openid-1',
      { name: '' },
    );
  });

  it('maps an expired Douyin code to the stable auth error envelope', async () => {
    mocks.douyinMiniProgramConfigured.mockReturnValue(true);
    mocks.exchangeDouyinMiniProgramCode.mockRejectedValue(
      new DouyinMiniProgramError('invalid-code', 'expired code'),
    );

    const response = await accountAuthRoutes.request('/auth/douyin/miniprogram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'douyin-code' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      code: 'INVALID_DOUYIN_CODE',
      message: 'invalid douyin code',
      error: 'invalid douyin code',
    });
  });

  it('returns a decodable short-lived ticket envelope', async () => {
    mocks.requireAppUserId.mockResolvedValue(42);
    mocks.issueWebSessionTicket.mockResolvedValue({ ticket, expiresIn: 90 });

    const response = await accountAuthRoutes.request('/auth/web-session/ticket', { method: 'POST' });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ticket, expiresIn: 90 });
    expect(decodeWebSessionTicketEnvelope(body)).toEqual(body);
  });

  it('returns a decodable canonical session after consuming a ticket', async () => {
    mocks.consumeWebSessionTicket.mockResolvedValue(42);
    mocks.getUserById.mockResolvedValue(account);

    const response = await accountAuthRoutes.request('/auth/web-session/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ token, user: publicAccount });
    expect(decodeWebSession(body)).toEqual(body);
    expect(mocks.consumeWebSessionTicket).toHaveBeenCalledWith(ticket);
  });

  it('issues a PKCE-bound mobile ticket from the canonical website session', async () => {
    mocks.requireAppUserId.mockResolvedValue(42);
    mocks.issueMobileSessionTicket.mockResolvedValue({ ticket, expiresIn: 90 });

    const response = await accountAuthRoutes.request('/auth/mobile-session/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeChallenge }),
    });

    expect(response.status).toBe(200);
    expect(decodeWebSessionTicketEnvelope(await response.json())).toEqual({ ticket, expiresIn: 90 });
    expect(mocks.issueMobileSessionTicket).toHaveBeenCalledWith(42, codeChallenge);
  });

  it('returns a canonical mobile session only after PKCE ticket consumption', async () => {
    mocks.consumeMobileSessionTicket.mockResolvedValue(42);
    mocks.getUserById.mockResolvedValue(account);

    const response = await accountAuthRoutes.request('/auth/mobile-session/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, codeVerifier }),
    });

    expect(response.status).toBe(200);
    expect(decodeWebSession(await response.json())).toEqual({ token, user: publicAccount });
    expect(mocks.consumeMobileSessionTicket).toHaveBeenCalledWith(ticket, codeVerifier);
  });

  it('rejects malformed mobile challenges before issuing a ticket', async () => {
    mocks.requireAppUserId.mockResolvedValue(42);

    const response = await accountAuthRoutes.request('/auth/mobile-session/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeChallenge: 'short' }),
    });

    expect(response.status).toBe(400);
    expect(mocks.issueMobileSessionTicket).not.toHaveBeenCalled();
    expect(decodeWebSessionError(await response.json())?.code).toBe('INVALID_REQUEST');
  });

  it('returns a stable error for a rejected mobile ticket or verifier', async () => {
    mocks.consumeMobileSessionTicket.mockResolvedValue(null);

    const response = await accountAuthRoutes.request('/auth/mobile-session/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, codeVerifier }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      code: 'INVALID_MOBILE_SESSION_TICKET',
      message: 'invalid mobile session ticket',
      error: 'invalid mobile session ticket',
    });
  });

  it('rejects an unknown Clawd preset before touching account storage', async () => {
    mocks.requireAppUserId.mockResolvedValue(42);

    const response = await accountAuthRoutes.request('/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: { kind: 'clawd', preset: 'invented' } }),
    });

    expect(response.status).toBe(400);
    expect(mocks.updateClawdAvatar).not.toHaveBeenCalled();
  });

  it('returns a refreshed canonical session after choosing a Clawd preset', async () => {
    const clawdUser = { ...account, avatar_source: 'clawd', avatar_preset: 'typing' };
    const clawdPublicAccount = {
      ...publicAccount,
      avatarSource: 'clawd' as const,
      avatarPreset: 'typing' as const,
    };
    mocks.requireAppUserId.mockResolvedValue(42);
    mocks.updateClawdAvatar.mockResolvedValue(clawdUser);
    mocks.publicUser.mockReturnValue(clawdPublicAccount);

    const response = await accountAuthRoutes.request('/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: { kind: 'clawd', preset: 'typing' } }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(decodeWebSession(body)).toEqual({ token, user: clawdPublicAccount });
    expect(mocks.updateClawdAvatar).toHaveBeenCalledWith(42, 'typing');
  });

  it('returns the authenticated account basic profile without adding it to the session', async () => {
    const profile = {
      birthDate: '2000-02-29',
      gender: 'nonbinary',
      countryIso2: 'CN',
      countrySource: 'self',
    };
    mocks.requireAppUserId.mockResolvedValue(42);
    mocks.getAccountBasicProfile.mockResolvedValue(profile);

    const response = await accountAuthRoutes.request('/auth/profile');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile });
    expect(mocks.getAccountBasicProfile).toHaveBeenCalledWith(42);
  });

  it('normalizes and saves a complete basic profile action', async () => {
    const profile = {
      birthDate: '2000-02-29',
      gender: 'female',
      countryIso2: 'CN',
      countrySource: 'self',
    };
    mocks.requireAppUserId.mockResolvedValue(42);
    mocks.updateAccountBasicProfile.mockResolvedValue(profile);

    const response = await accountAuthRoutes.request('/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        basic: { birthDate: '2000-02-29', gender: 'female', countryIso2: ' cn ' },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, profile });
    expect(mocks.updateAccountBasicProfile).toHaveBeenCalledWith(42, {
      birthDate: '2000-02-29',
      gender: 'female',
      countryIso2: 'CN',
    });
  });

  it('rejects an impossible or future birth date before storage', async () => {
    mocks.requireAppUserId.mockResolvedValue(42);

    const response = await accountAuthRoutes.request('/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        basic: { birthDate: '2099-02-29', gender: null, countryIso2: null },
      }),
    });

    expect(response.status).toBe(400);
    expect(mocks.updateAccountBasicProfile).not.toHaveBeenCalled();
  });

  it('returns a stable compatible WeChat configuration error', async () => {
    mocks.wechatMiniProgramConfigured.mockReturnValue(false);

    const response = await accountAuthRoutes.request('/auth/wechat/miniprogram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'wx-code' }),
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({
      code: 'WECHAT_NOT_CONFIGURED',
      message: 'wechat miniprogram not configured',
      error: 'wechat miniprogram not configured',
    });
    expect(decodeWebSessionError(body)).toEqual(body);
  });

  it.each([
    {
      label: 'an invalid request body',
      arrange: () => undefined,
      requestBody: '{',
      status: 400,
      code: 'INVALID_REQUEST',
      message: 'invalid code',
    },
    {
      label: 'an expired WeChat code',
      arrange: () => {
        mocks.exchangeWechatMiniProgramCode.mockRejectedValue(
          new WechatMiniProgramError('invalid-code', 'expired code'),
        );
      },
      requestBody: JSON.stringify({ code: 'wx-code' }),
      status: 401,
      code: 'INVALID_WECHAT_CODE',
      message: 'invalid wechat code',
    },
    {
      label: 'an upstream WeChat rate limit',
      arrange: () => {
        mocks.exchangeWechatMiniProgramCode.mockRejectedValue(
          new WechatMiniProgramError('rate-limited', 'upstream rate limit'),
        );
      },
      requestBody: JSON.stringify({ code: 'wx-code' }),
      status: 429,
      code: 'RATE_LIMITED',
      message: 'wechat login rate limited',
    },
    {
      label: 'a WeChat blocked user',
      arrange: () => {
        mocks.exchangeWechatMiniProgramCode.mockRejectedValue(
          new WechatMiniProgramError('blocked-user', 'blocked user'),
        );
      },
      requestBody: JSON.stringify({ code: 'wx-code' }),
      status: 403,
      code: 'ACCOUNT_BLOCKED',
      message: 'wechat login blocked',
    },
    {
      label: 'an unusable WeChat response',
      arrange: () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.exchangeWechatMiniProgramCode.mockRejectedValue(
          new WechatMiniProgramError('invalid-response', 'invalid response'),
        );
      },
      requestBody: JSON.stringify({ code: 'wx-code' }),
      status: 502,
      code: 'WECHAT_UNAVAILABLE',
      message: 'wechat service unavailable',
    },
    {
      label: 'a WeChat account without UnionID',
      arrange: () => {
        mocks.exchangeWechatMiniProgramCode.mockResolvedValue({
          openid: 'openid-1',
          unionid: null,
        });
      },
      requestBody: JSON.stringify({ code: 'wx-code' }),
      status: 409,
      code: 'WECHAT_UNIONID_REQUIRED',
      message: 'wechat unionid required',
    },
  ])('returns a stable compatible error for $label', async ({
    arrange,
    requestBody,
    status,
    code,
    message,
  }) => {
    mocks.wechatMiniProgramConfigured.mockReturnValue(true);
    arrange();

    const response = await accountAuthRoutes.request('/auth/wechat/miniprogram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });

    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body).toEqual({ code, message, error: message });
    expect(decodeWebSessionError(body)).toEqual(body);
  });

  it('returns a stable compatible error when a web session ticket requires authentication', async () => {
    mocks.requireAppUserId.mockRejectedValue(new Error('Authentication required'));

    const response = await accountAuthRoutes.request('/auth/web-session/ticket', { method: 'POST' });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
      error: 'Authentication required',
    });
    expect(decodeWebSessionError(body)).toEqual(body);
  });

  it('returns a stable compatible error for an invalid web session ticket', async () => {
    mocks.consumeWebSessionTicket.mockResolvedValue(null);

    const response = await accountAuthRoutes.request('/auth/web-session/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: 'invalid' }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      code: 'INVALID_WEB_SESSION_TICKET',
      message: 'invalid web session ticket',
      error: 'invalid web session ticket',
    });
    expect(decodeWebSessionError(body)).toEqual(body);
  });

  it.each([
    {
      label: 'a suspended ticket applicant',
      path: '/auth/web-session/ticket',
      requestBody: undefined,
      arrange: () => {
        mocks.requireAppUserId.mockRejectedValue(new Error('Your account has been suspended'));
      },
      status: 403,
      code: 'ACCOUNT_BLOCKED',
      message: 'Your account has been suspended',
    },
    {
      label: 'a consumed ticket whose account no longer exists',
      path: '/auth/web-session/exchange',
      requestBody: JSON.stringify({ ticket }),
      arrange: () => {
        mocks.consumeWebSessionTicket.mockResolvedValue(42);
        mocks.getUserById.mockResolvedValue(null);
      },
      status: 401,
      code: 'INVALID_WEB_SESSION_TICKET',
      message: 'invalid web session ticket',
    },
  ])('returns a stable compatible error for $label', async ({
    arrange,
    path,
    requestBody,
    status,
    code,
    message,
  }) => {
    arrange();
    const init: RequestInit = { method: 'POST' };
    if (requestBody !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = requestBody;
    }

    const response = await accountAuthRoutes.request(path, init);

    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body).toEqual({ code, message, error: message });
    expect(decodeWebSessionError(body)).toEqual(body);
  });

  it('retains Retry-After on stable rate-limit errors', async () => {
    mocks.checkRateLimit.mockImplementation(() => { throw new Error('Rate limit exceeded'); });

    const response = await accountAuthRoutes.request('/auth/web-session/exchange', { method: 'POST' });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('5');
    expect(await response.json()).toEqual({
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded',
      error: 'Rate limit exceeded',
    });
  });
});
