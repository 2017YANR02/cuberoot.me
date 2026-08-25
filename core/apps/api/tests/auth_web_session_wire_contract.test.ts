import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeWebSessionError,
  decodeWebSession,
  decodeWebSessionTicketEnvelope,
} from '@cuberoot/shared/auth/web-session';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  consumeWebSessionTicket: vi.fn(),
  exchangeWechatMiniProgramCode: vi.fn(),
  getUserById: vi.fn(),
  issueWebSessionTicket: vi.fn(),
  loginWithIdentity: vi.fn(),
  publicUser: vi.fn(),
  requireAppUserId: vi.fn(),
  signSession: vi.fn(),
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
  loginWithIdentity: mocks.loginWithIdentity,
  publicUser: mocks.publicUser,
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
vi.mock('../src/utils/web_session_ticket.js', () => ({
  consumeWebSessionTicket: mocks.consumeWebSessionTicket,
  issueWebSessionTicket: mocks.issueWebSessionTicket,
}));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: mocks.requireAppUserId }));

import { accountAuthRoutes } from '../src/routes/account_auth.js';
import { WechatMiniProgramError } from '../src/utils/wechat_miniprogram.js';

const account = {
  id: 42,
  wca_id: null,
  display_name: '',
  avatar_url: null,
};
const publicAccount = { uid: 42, wcaId: null, name: '', avatar: '' };
const token = 's'.repeat(20);
const ticket = 'A'.repeat(43);

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
