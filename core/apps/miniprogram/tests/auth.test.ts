import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  clearStoredSession,
  createWebSessionTicket,
  getStoredSession,
  getStoredSessionSnapshot,
  loginErrorMessage,
  loginWithWechat,
  validateStoredSession,
} from '../src/lib/auth';

describe('mini program authentication', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('treats an absent session as logged out without mutating storage', () => {
    const removeStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => '',
      removeStorageSync,
    });

    expect(getStoredSession()).toBeNull();
    expect(removeStorageSync).not.toHaveBeenCalled();
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

  it('does not disguise a failed malformed-session cleanup as signed out', () => {
    vi.stubGlobal('wx', {
      getStorageSync: () => ({ token: 'short', user: { name: 'CubeRoot', wcaId: null } }),
      removeStorageSync() {
        throw new Error('storage unavailable');
      },
    });

    expect(getStoredSessionSnapshot()).toEqual({
      status: 'unavailable',
      session: null,
    });
  });

  it('rejects stored session tokens containing header control characters', () => {
    const removeStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: `${'t'.repeat(20)}\r\nInjected: true`,
        user: { name: 'CubeRoot', wcaId: null },
      }),
      removeStorageSync,
    });

    expect(getStoredSession()).toBeNull();
    expect(removeStorageSync).toHaveBeenCalledWith('cuberoot:session');
  });

  it('treats an unreadable storage area as logged out', () => {
    vi.stubGlobal('wx', {
      getStorageSync() {
        throw new Error('storage unavailable');
      },
    });

    expect(getStoredSession()).toBeNull();
    expect(getStoredSessionSnapshot()).toEqual({
      status: 'unavailable',
      session: null,
    });
  });

  it('reports whether a local session was actually removed', () => {
    vi.stubGlobal('wx', {
      removeStorageSync() {
        throw new Error('storage unavailable');
      },
    });

    expect(clearStoredSession()).toBe(false);
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
            user: { uid: 12, name: 'CubeRoot', wcaId: null, avatar: '' },
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
      user: { uid: 12, name: 'CubeRoot', wcaId: null, avatar: '' },
    });
  });

  it('accepts and persists the real first-time WeChat user response with an empty name', async () => {
    const setStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: 'login-code' });
      },
      request(options: { success(result: { statusCode: number; data: unknown }): void }) {
        options.success({
          statusCode: 200,
          data: {
            token: 't'.repeat(20),
            user: { uid: 12, name: '', wcaId: null, avatar: '' },
            isNew: true,
          },
        });
      },
      setStorageSync,
    });

    await expect(loginWithWechat()).resolves.toEqual({
      token: 't'.repeat(20),
      user: { uid: 12, name: '', wcaId: null, avatar: '' },
      isNew: true,
    });
    expect(setStorageSync).toHaveBeenCalledWith('cuberoot:session', {
      token: 't'.repeat(20),
      user: { uid: 12, name: '', wcaId: null, avatar: '' },
    });
  });

  it('rejects a new login response without the canonical account uid', async () => {
    const setStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: 'login-code' });
      },
      request(options: { success(result: { statusCode: number; data: unknown }): void }) {
        options.success({
          statusCode: 200,
          data: {
            token: 't'.repeat(20),
            user: { name: 'CubeRoot', wcaId: null },
          },
        });
      },
      setStorageSync,
    });

    await expect(loginWithWechat()).rejects.toMatchObject({
      message: 'invalid session response',
      status: 502,
    });
    expect(setStorageSync).not.toHaveBeenCalled();
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

  it('keeps an unnamed legacy stored identity valid', () => {
    const removeStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { name: '   ', wcaId: null },
      }),
      removeStorageSync,
    });

    expect(getStoredSession()).toEqual({
      token: 't'.repeat(20),
      user: { name: '', wcaId: null },
    });
    expect(removeStorageSync).not.toHaveBeenCalled();
  });

  it('rejects stored identity fields containing control characters', () => {
    const removeStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => ({
        token: 't'.repeat(20),
        user: { name: 'Cube\nRoot', wcaId: '2026ROOT01' },
      }),
      removeStorageSync,
    });

    expect(getStoredSession()).toBeNull();
    expect(removeStorageSync).toHaveBeenCalledWith('cuberoot:session');
  });

  it('maps actionable login failures to user-facing messages', () => {
    expect(loginErrorMessage(new ApiError(409, 'unionid'))).toContain('开放平台');
    expect(loginErrorMessage(new ApiError(503, 'secret'))).toContain('服务端');
    expect(loginErrorMessage(new ApiError(429, 'rate limited'))).toContain('过于频繁');
    expect(loginErrorMessage(new ApiError(403, 'blocked'))).toContain('无法为此账号');
    expect(loginErrorMessage(new ApiError(0, 'network'))).toContain('网络');
    expect(loginErrorMessage(new ApiError(-1, 'storage'))).toContain('设备存储');
    expect(loginErrorMessage(new Error('unknown'))).toBe('登录失败，请稍后重试');
  });

  it('prefers a stable wire auth code over a legacy HTTP-status mapping', async () => {
    vi.stubGlobal('wx', {
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: 'login-code' });
      },
      request(options: { success(result: { statusCode: number; data: unknown }): void }) {
        options.success({
          statusCode: 503,
          data: {
            code: 'INVALID_WECHAT_CODE',
            message: 'invalid wechat code',
            error: 'invalid wechat code',
          },
        });
      },
    });

    let caught: unknown;
    try {
      await loginWithWechat();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({
      status: 503,
      code: 'INVALID_WECHAT_CODE',
      message: 'invalid wechat code',
    });
    expect(loginErrorMessage(caught)).toContain('登录码已失效');
  });

  it('does not claim login succeeded when the session cannot be persisted', async () => {
    vi.stubGlobal('wx', {
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: 'login-code' });
      },
      request(options: { success(result: { statusCode: number; data: unknown }): void }) {
        options.success({
          statusCode: 200,
          data: {
            token: 't'.repeat(20),
            user: { uid: 12, name: 'CubeRoot', wcaId: null, avatar: '' },
          },
        });
      },
      setStorageSync() {
        throw new Error('storage unavailable');
      },
    });

    await expect(loginWithWechat()).rejects.toMatchObject({
      message: 'session storage unavailable',
      status: -1,
    });
  });

  it('rejects login tokens containing header control characters before storage', async () => {
    const setStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: 'login-code' });
      },
      request(options: { success(result: { statusCode: number; data: unknown }): void }) {
        options.success({
          statusCode: 200,
          data: {
            token: `${'t'.repeat(20)}\nInjected: true`,
            user: { uid: 12, name: 'CubeRoot', wcaId: null, avatar: '' },
          },
        });
      },
      setStorageSync,
    });

    await expect(loginWithWechat()).rejects.toMatchObject({
      message: 'invalid session response',
      status: 502,
    });
    expect(setStorageSync).not.toHaveBeenCalled();
  });

  it('rejects a login response without a visible display name before storage', async () => {
    const setStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: 'login-code' });
      },
      request(options: { success(result: { statusCode: number; data: unknown }): void }) {
        options.success({
          statusCode: 200,
          data: {
            token: 't'.repeat(20),
            user: { uid: 12, name: '\t', wcaId: null, avatar: '' },
          },
        });
      },
      setStorageSync,
    });

    await expect(loginWithWechat()).rejects.toMatchObject({
      message: 'invalid session response',
      status: 502,
    });
    expect(setStorageSync).not.toHaveBeenCalled();
  });

  it('rejects login identity fields containing control characters before storage', async () => {
    const setStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: 'login-code' });
      },
      request(options: { success(result: { statusCode: number; data: unknown }): void }) {
        options.success({
          statusCode: 200,
          data: {
            token: 't'.repeat(20),
            user: { uid: 12, name: 'CubeRoot', wcaId: '2026\tROOT01', avatar: '' },
          },
        });
      },
      setStorageSync,
    });

    await expect(loginWithWechat()).rejects.toMatchObject({
      message: 'invalid session response',
      status: 502,
    });
    expect(setStorageSync).not.toHaveBeenCalled();
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

  it('fails fast when the login timeout cannot be scheduled', async () => {
    const login = vi.fn();
    vi.stubGlobal('wx', { login });
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
      throw new Error('timer unavailable');
    });

    try {
      await expect(loginWithWechat()).rejects.toMatchObject({
        message: 'wx.login timeout unavailable',
        status: 0,
      });
      expect(login).not.toHaveBeenCalled();
    } finally {
      timer.mockRestore();
    }
  });

  it('does not start login after a synchronous timeout callback', async () => {
    const login = vi.fn();
    vi.stubGlobal('wx', { login });
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback) => {
      if (typeof callback === 'function') callback();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });

    try {
      await expect(loginWithWechat()).rejects.toMatchObject({
        message: 'wx.login timed out',
        status: 0,
      });
      expect(login).not.toHaveBeenCalled();
    } finally {
      timer.mockRestore();
    }
  });

  it('fails fast when the request timeout cannot be scheduled', async () => {
    const request = vi.fn();
    vi.stubGlobal('wx', { request });
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
      throw new Error('timer unavailable');
    });
    const session = {
      token: 't'.repeat(20),
      user: { name: 'CubeRoot', wcaId: null },
    };

    try {
      await expect(validateStoredSession(session)).rejects.toMatchObject({
        message: 'request timeout unavailable',
        status: 0,
      });
      expect(request).not.toHaveBeenCalled();
    } finally {
      timer.mockRestore();
    }
  });

  it('settles login when timer cleanup is unavailable', async () => {
    vi.useFakeTimers();
    const setStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      login(options: { success(result: { code: string }): void }) {
        options.success({ code: 'login-code' });
      },
      request(options: { success(result: { statusCode: number; data: unknown }): void }) {
        options.success({
          statusCode: 200,
          data: {
            token: 't'.repeat(20),
            user: { uid: 12, name: 'CubeRoot', wcaId: null, avatar: '' },
            isNew: false,
          },
        });
      },
      setStorageSync,
    });
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {
      throw new Error('timer cleanup unavailable');
    });

    try {
      await expect(loginWithWechat()).resolves.toMatchObject({
        token: 't'.repeat(20),
        user: { uid: 12, name: 'CubeRoot' },
      });
      expect(setStorageSync).toHaveBeenCalledOnce();
    } finally {
      clearTimer.mockRestore();
      await vi.runAllTimersAsync();
    }
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

  it('still settles a timed-out request when abort throws', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('wx', {
      request: vi.fn(() => ({
        abort() {
          throw new Error('abort unavailable');
        },
      })),
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
          data: { user: { uid: 12, name: 'New name', wcaId: '2026-ROOT01', avatar: '' } },
        });
      },
      setStorageSync,
    });

    const validated = await validateStoredSession(session);
    expect(validated.user.uid).toBe(12);
    expect(validated.user.name).toBe('New name');
    expect(setStorageSync).not.toHaveBeenCalled();
  });

  it('upgrades a legacy stored identity with the canonical account uid', async () => {
    const session = {
      token: 't'.repeat(20),
      user: { name: 'Old name', wcaId: null },
    };
    const setStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => session,
      request(options: {
        success(result: { statusCode: number; data: unknown }): void;
      }) {
        options.success({
          statusCode: 200,
          data: { user: { uid: 12, name: 'New name', wcaId: null, avatar: '' } },
        });
      },
      setStorageSync,
    });

    await expect(validateStoredSession(session)).resolves.toEqual({
      token: session.token,
      user: { uid: 12, name: 'New name', wcaId: null, avatar: '' },
    });
    expect(setStorageSync).toHaveBeenCalledWith('cuberoot:session', {
      token: session.token,
      user: { uid: 12, name: 'New name', wcaId: null, avatar: '' },
    });
  });

  it('rejects validation when the confirmed identity cannot be persisted', async () => {
    const session = {
      token: 't'.repeat(20),
      user: { name: 'Old name', wcaId: null },
    };
    vi.stubGlobal('wx', {
      getStorageSync: () => session,
      request(options: {
        success(result: { statusCode: number; data: unknown }): void;
      }) {
        options.success({
          statusCode: 200,
          data: { user: { uid: 12, name: 'New name', wcaId: null, avatar: '' } },
        });
      },
      setStorageSync() {
        throw new Error('storage unavailable');
      },
    });

    await expect(validateStoredSession(session)).rejects.toMatchObject({
      message: 'session storage unavailable',
      status: -1,
    });
  });

  it('rejects validation when the server returns a different account uid', async () => {
    const session = {
      token: 't'.repeat(20),
      user: { uid: 12, name: 'CubeRoot', wcaId: null },
    };
    const setStorageSync = vi.fn();
    vi.stubGlobal('wx', {
      getStorageSync: () => session,
      request(options: {
        success(result: { statusCode: number; data: unknown }): void;
      }) {
        options.success({
          statusCode: 200,
          data: { user: { uid: 13, name: 'Other account', wcaId: null, avatar: '' } },
        });
      },
      setStorageSync,
    });

    await expect(validateStoredSession(session)).rejects.toMatchObject({
      message: 'session identity mismatch',
      status: 401,
    });
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
