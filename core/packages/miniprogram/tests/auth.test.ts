import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  createWebSessionTicket,
  getStoredSession,
  loginErrorMessage,
  loginWithWechat,
  validateStoredSession,
} from '../src/lib/auth';

describe('mini program authentication', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rejects malformed persisted sessions', () => {
    const removeStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => ({ token: 'short', user: { name: 'CubeRoot', wcaId: null } }),
      removeStorageSync,
    });

    expect(getStoredSession()).toBeNull();
    expect(removeStorageSync).toHaveBeenCalledWith('cuberoot:session');
  });

  it('exchanges a WeChat code through the canonical API endpoint', async () => {
    const setStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: '  login-code  ' });
      },
      request(options: {
        data: { code: string };
        success(result: { statusCode: number; data: unknown }): void;
        url: string;
      }) {
        expect(options.url).toBe('https://api.cuberoot.me/v1/auth/wechat/miniprogram');
        expect(options.data).toEqual({ code: 'login-code' });
        options.success({
          statusCode: 200,
          data: {
            token: 't'.repeat(20),
            user: { name: 'CubeRoot', wcaId: null },
            isNew: true,
          },
        });
      },
      setStorageSync,
    });

    const session = await loginWithWechat();
    expect(session.user.name).toBe('CubeRoot');
    expect(session.isNew).toBe(true);
    expect(setStorageSync).toHaveBeenCalledWith('cuberoot:session', {
      token: 't'.repeat(20),
      user: { name: 'CubeRoot', wcaId: null },
    });
  });

  it('normalizes persisted identity fields and drops transient login metadata', () => {
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: `  ${'t'.repeat(20)}  `,
        user: { uid: 12, name: '  CubeRoot  ', wcaId: '  2026ROOT01  ' },
        isNew: true,
      }),
      removeStorageSync: vi.fn(),
    });

    expect(getStoredSession()).toEqual({
      token: 't'.repeat(20),
      user: { uid: 12, name: 'CubeRoot', wcaId: '2026ROOT01' },
    });
  });

  it('rejects impossible local identity values', () => {
    const removeStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { uid: 0, name: 'CubeRoot', wcaId: null },
      }),
      removeStorageSync,
    });

    expect(getStoredSession()).toBeNull();
    expect(removeStorageSync).toHaveBeenCalledWith('cuberoot:session');
  });

  it('maps actionable login failures to user-facing messages', () => {
    expect(loginErrorMessage(new ApiError(409, 'unionid'))).toContain('开放平台');
    expect(loginErrorMessage(new ApiError(503, 'secret'))).toContain('服务端');
    expect(loginErrorMessage(new ApiError(0, 'network'))).toContain('网络');
    expect(loginErrorMessage(new Error('unknown'))).toBe('登录失败，请稍后重试');
  });

  it('finishes login when wx.login never calls back', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('wx', {
      login: vi.fn(),
    });

    const login = expect(loginWithWechat()).rejects.toMatchObject({
      message: 'wx.login timed out',
      status: 0,
    });
    await vi.advanceTimersByTimeAsync(11_000);

    await login;
  });

  it('aborts an API request when the platform timeout callback never arrives', async () => {
    vi.useFakeTimers();
    const abort = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => null,
      request: vi.fn(() => ({ abort })),
    });
    const session = {
      token: 't'.repeat(20),
      user: { name: 'CubeRoot', wcaId: null },
    };

    const validation = expect(validateStoredSession(session)).rejects.toMatchObject({
      message: 'request timed out',
      status: 0,
    });
    await vi.advanceTimersByTimeAsync(13_000);

    await validation;
    expect(abort).toHaveBeenCalledOnce();
  });

  it('requests a short-lived web session ticket with the Mini Program JWT', async () => {
    const token = 't'.repeat(20);
    vi.stubGlobal('wx', {
      request(options: {
        header: Record<string, string>;
        success(result: { statusCode: number; data: unknown }): void;
        url: string;
      }) {
        expect(options.url).toBe('https://api.cuberoot.me/v1/auth/web-session/ticket');
        expect(options.header.Authorization).toBe(`Bearer ${token}`);
        options.success({
          statusCode: 200,
          data: { ticket: 'A'.repeat(43), expiresIn: 90 },
        });
      },
    });

    await expect(createWebSessionTicket({
      token,
      user: { name: 'CubeRoot', wcaId: null },
    })).resolves.toEqual({ ticket: 'A'.repeat(43), expiresIn: 90 });
  });

  it('does not restore a session that was cleared during validation', async () => {
    const session = {
      token: 't'.repeat(20),
      user: { name: 'Old name', wcaId: null },
    };
    const setStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => null,
      request(options: {
        success(result: { statusCode: number; data: unknown }): void;
      }) {
        options.success({
          statusCode: 200,
          data: { user: { name: 'New name', wcaId: '2026-ROOT01' } },
        });
      },
      setStorageSync,
    });

    const validated = await validateStoredSession(session);
    expect(validated.user.name).toBe('New name');
    expect(setStorageSync).not.toHaveBeenCalled();
  });

  it('turns malformed successful validation responses into a controlled API error', async () => {
    const session = {
      token: 't'.repeat(20),
      user: { name: 'CubeRoot', wcaId: null },
    };
    vi.stubGlobal('wx', {
      request(options: {
        success(result: { statusCode: number; data: unknown }): void;
      }) {
        options.success({ statusCode: 200, data: null });
      },
    });

    await expect(validateStoredSession(session)).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
    });
  });
});
