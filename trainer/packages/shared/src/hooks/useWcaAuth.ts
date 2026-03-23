// NOTE: WCA OAuth 认证 hook — 从 wca_auth.js 改写为 React + TypeScript
// 使用 Implicit Grant 流程 → 获取 WCA 用户身份（ID、姓名、头像）

import { useState, useCallback, useMemo } from 'react';
import type { WcaAuthUser } from '../types';

// NOTE: WCA OAuth 配置（implicit grant 不需要 client_secret）
const CONFIG = {
  clientId: 'mPeg5FiAn7l0CcyQ9CdiSEn3XlBrcA7IMw6Vd9AOsz4',
  authorizeUrl: 'https://www.worldcubeassociation.org/oauth/authorize',
  meUrl: 'https://www.worldcubeassociation.org/api/v0/me',
  scope: 'public',
};

const SESSION_KEY = 'wca_user';
const STATE_KEY = 'wca_oauth_state';
const TOKEN_KEY = 'wca_access_token';

// NOTE: 管理员 WCA ID 列表（前端硬编码，仅控制 UI 显示）
const ADMIN_WCA_IDS = ['2017YANR02'];

// NOTE: 黑名单 WCA ID 列表 — 这些用户无法登录（前后端同步）
const BANNED_WCA_IDS: string[] = [];

// ── 非 hook 版本（纯函数，供非组件场景使用） ──

/** NOTE: 从 localStorage 读取已登录用户，黑名单用户返回 null */
function readUser(): WcaAuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const user = raw ? (JSON.parse(raw) as WcaAuthUser) : null;
    if (user && BANNED_WCA_IDS.includes(user.wcaId)) {
      clearSession();
      return null;
    }
    return user;
  } catch { return null; }
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

/** NOTE: 非 hook 导出 — 方便纯逻辑场景（如 Axios interceptor）直接使用 */
export const WcaAuth = {
  getUser: readUser,
  isLoggedIn: () => readUser() !== null,
  isAdmin: () => {
    const u = readUser();
    return u !== null && ADMIN_WCA_IDS.includes(u.wcaId);
  },
  getAccessToken: () => localStorage.getItem(TOKEN_KEY) || '',
  logout: clearSession,
};

// ── React Hook 版本 ──

export function useWcaAuth() {
  const [user, setUser] = useState<WcaAuthUser | null>(() => readUser());

  const isLoggedIn = user !== null;

  const isAdmin = useMemo(
    () => user !== null && ADMIN_WCA_IDS.includes(user.wcaId),
    [user]
  );

  /** NOTE: 跳转到 WCA 授权页（implicit grant） */
  const login = useCallback(() => {
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem(STATE_KEY, state);
    // NOTE: 记录登录前的页面 URL，回调后跳回
    sessionStorage.setItem('wca_return_url', window.location.href);

    const redirectUri = window.location.origin + '/callback.html';
    const params = [
      'client_id=' + encodeURIComponent(CONFIG.clientId),
      'redirect_uri=' + encodeURIComponent(redirectUri),
      'response_type=token',
      'scope=' + encodeURIComponent(CONFIG.scope),
      'state=' + encodeURIComponent(state),
    ].join('&');

    window.location.href = CONFIG.authorizeUrl + '?' + params;
  }, []);

  /** NOTE: 登出 — 清除本地凭证 */
  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  /**
   * NOTE: 切换账号 — 清除 session → 新标签打开 WCA 官网让用户登出 → 刷新本页
   * WCA OAuth (Doorkeeper) 无 prompt=login，已登录的 session 会自动授权同一账号
   */
  const switchAccount = useCallback(() => {
    clearSession();
    setUser(null);
    window.open('https://www.worldcubeassociation.org', '_blank');
    location.reload();
  }, []);

  /**
   * NOTE: OAuth 回调处理 — 从 URL hash 解析 access_token，获取用户信息
   * 返回 WcaAuthUser 或抛异常
   */
  const handleCallback = useCallback(async (): Promise<WcaAuthUser> => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');

    // NOTE: 验证 state 防 CSRF
    const savedState = sessionStorage.getItem(STATE_KEY);
    if (!savedState || savedState !== state) {
      throw new Error('OAuth state mismatch');
    }
    sessionStorage.removeItem(STATE_KEY);

    if (!accessToken) {
      throw new Error('No access_token in callback');
    }

    localStorage.setItem(TOKEN_KEY, accessToken);

    // NOTE: 调用 /me 获取用户信息
    const resp = await fetch(CONFIG.meUrl, {
      headers: { Authorization: 'Bearer ' + accessToken },
      cache: 'no-store',
    });
    if (!resp.ok) throw new Error('WCA /me failed: ' + resp.status);

    const data = await resp.json();
    const me = data.me;
    const authUser: WcaAuthUser = {
      wcaId: me.wca_id,
      name: me.name,
      avatar: me.avatar?.thumb_url || '',
      country: me.country_iso2 || '',
    };

    if (BANNED_WCA_IDS.includes(authUser.wcaId)) {
      clearSession();
      throw new Error('Your account has been suspended');
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
    setUser(authUser);
    return authUser;
  }, []);

  const getAccessToken = useCallback(() => {
    return localStorage.getItem(TOKEN_KEY) || '';
  }, []);

  return {
    user,
    isLoggedIn,
    isAdmin,
    login,
    logout,
    switchAccount,
    handleCallback,
    getAccessToken,
  };
}
