import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  getStoredSession,
  loginErrorMessage,
  loginWithWechat,
  validateStoredSession,
} from '../src/lib/auth';

describe('mini program authentication', () => {
  afterEach(() => {
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
          },
        });
      },
      setStorageSync,
    });

    const session = await loginWithWechat();
    expect(session.user.name).toBe('CubeRoot');
    expect(setStorageSync).toHaveBeenCalledWith('cuberoot:session', session);
  });

  it('maps actionable login failures to user-facing messages', () => {
    expect(loginErrorMessage(new ApiError(409, 'unionid'))).toContain('开放平台');
    expect(loginErrorMessage(new ApiError(503, 'secret'))).toContain('服务端');
    expect(loginErrorMessage(new ApiError(0, 'network'))).toContain('网络');
    expect(loginErrorMessage(new Error('unknown'))).toBe('登录失败，请稍后重试');
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
});
