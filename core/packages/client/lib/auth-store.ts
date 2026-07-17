/**
 * WCA OAuth (Implicit Grant) auth state — ported from packages/client-vite/src/stores/auth_store.ts.
 * No Capacitor branch here; web only. Redirect URI is window.location.origin + '/auth/callback'.
 */
'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { ADMIN_WCA_IDS, isAdminWcaId } from '@cuberoot/shared/admin';
import { ownerKey as computeOwnerKey } from '@cuberoot/shared/account';
import { apiUrl } from './api-base';
import { persistItem } from './safe-storage';

export { ADMIN_WCA_IDS };

export interface WcaUser {
  /** 真实 WCA id;纯邮箱/手机账号为空串(用 uid 区分身份)。 */
  wcaId: string;
  name: string;
  avatar: string;
  country: string;
  /** 内部账号 id(邮箱/手机账号必有;老的纯 WCA 会话可能没有,续签后补上)。 */
  uid?: number;
}

interface AuthState {
  user: WcaUser | null;
  /** 登录 / 账号弹层是否打开。 */
  loginOpen: boolean;
}

interface AuthActions {
  /** 打开登录 / 账号弹层(全站 9 处「登录」入口都走这里)。 */
  login: () => void;
  openLogin: () => void;
  closeLogin: () => void;
  /** 直接跳 WCA OAuth(弹层里「用 WCA 登录」按钮用)。 */
  loginWithWca: () => void;
  logout: () => void;
  refresh: () => void;
}

const WCA_CLIENT_ID = 'mPeg5FiAn7l0CcyQ9CdiSEn3XlBrcA7IMw6Vd9AOsz4';
const WCA_AUTHORIZE_URL = 'https://www.worldcubeassociation.org/oauth/authorize';

const SESSION_KEY = 'wca_user';
const TOKEN_KEY = 'wca_access_token';
const STATE_KEY = 'wca_oauth_state';
const RETURN_URL_KEY = 'wca_return_url';

function readUser(): WcaUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Persist an auth key, surviving a (near-)full localStorage. On a quota error
 * (common on iOS Safari when timer backups fill the ~5MB budget), evict
 * regenerable caches once and retry. Returns false if the value still couldn't
 * be stored (e.g. Safari private browsing, 0 quota).
 */
export const persistAuthItem = persistItem;

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: readUser(),
  loginOpen: false,

  // 「登录」入口统一打开弹层(邮箱 / 手机 / WCA 多方式选择);已登录则打开账号面板。
  login: () => set({ loginOpen: true }),
  openLogin: () => set({ loginOpen: true }),
  closeLogin: () => set({ loginOpen: false }),

  loginWithWca: () => {
    if (typeof window === 'undefined') return;
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_URL_KEY, window.location.href);

    const redirectUri = window.location.origin + '/auth/callback';
    const params = [
      `client_id=${encodeURIComponent(WCA_CLIENT_ID)}`,
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
      'response_type=token',
      'scope=public',
      `state=${encodeURIComponent(state)}`,
    ].join('&');

    window.location.href = `${WCA_AUTHORIZE_URL}?${params}`;
  },

  logout: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('cuberoot_jwt');
    set({ user: null, loginOpen: false });
  },

  refresh: () => {
    set({ user: readUser() });
  },
}));

/**
 * 把「邮箱/手机验证码」或「绑定后重签」返回的 { token, user } 落地为登录态:
 * 写 cuberoot_jwt + wca_user(复用同一 key,全站据此判定已登录),再刷新内存 store。
 */
export function applySession(
  token: string,
  user: { uid?: number; wcaId: string | null; name: string; avatar?: string },
): void {
  if (typeof window === 'undefined') return;
  persistAuthItem('cuberoot_jwt', token);
  const wu: WcaUser = {
    wcaId: user.wcaId ?? '',
    name: user.name,
    avatar: user.avatar ?? '',
    country: '',
    uid: user.uid,
  };
  persistAuthItem(SESSION_KEY, JSON.stringify(wu));
  useAuthStore.getState().refresh();
}

/** 当前会话的 cuberoot_jwt(账号 API 的 Bearer)。 */
export function getSessionToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('cuberoot_jwt') || '';
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SESSION_KEY || e.key === TOKEN_KEY) {
      useAuthStore.getState().refresh();
    }
  });
}

export function getWcaToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getWcaId(): string {
  return useAuthStore.getState().user?.wcaId || '';
}

/**
 * 当前会话的「所有权键」——与服务端 requireAuth 的 ownerKey 完全同源:绑了 WCA = 真实
 * wca_id,纯邮箱/手机账号 = 合成 u<uid>,未登录 = ''。业务内容「是不是我的 / 能不能管」
 * 一律用它比对(非 WCA 用户 wcaId 为空,用 wcaId 会全判 false)。链接 /person、admin
 * 判定、WCA 选手页 isSelf 仍用 wcaId(那些语义就是真实 WCA id)。
 */
export function getOwnerKey(): string {
  const u = useAuthStore.getState().user;
  return computeOwnerKey(u?.uid, u?.wcaId);
}

export function isAdmin(): boolean {
  return isAdminWcaId(useAuthStore.getState().user?.wcaId);
}

// ── Hydration-safe 读取 ──
// store 在模块初始化时 user: readUser() 同步读 localStorage:server 端为 null,
// client 首帧已是真实登录态。任何「按登录态分叉渲染」的组件必须用下面两个 hook
// (而非裸 useAuthStore(s => s.user) / isAdmin()),否则 SSG 页 hydration 错配
// (server 渲染未登录分支,client 首帧渲染已登录分支)。mount 后才暴露真实态。
export function useAuthUser(): WcaUser | null {
  const user = useAuthStore((s) => s.user);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  return hydrated ? user : null;
}

export function useIsAdmin(): boolean {
  return isAdminWcaId(useAuthUser()?.wcaId);
}

/** Hydration-safe 版 getOwnerKey(SSG 页按登录态分叉渲染必用,理由同 useAuthUser)。 */
export function useOwnerKey(): string {
  const user = useAuthUser();
  return computeOwnerKey(user?.uid, user?.wcaId);
}

// ── 长效 JWT 滑动续签 ──
// callback 用 WCA token 换的 cuberoot_jwt 有效期 365 天。临近过期时静默用旧 jwt 换新 jwt
// (POST /v1/auth/refresh),只要一年内活跃过就不掉线;整年不开站才需重新 WCA 登录。
const JWT_KEY = 'cuberoot_jwt';
const REFRESH_BEFORE_MS = 30 * 24 * 3600 * 1000; // 剩余 < 30 天才续,避免每次启动都打后端

/** 解析 JWT payload 的 exp(毫秒),不验签;非法/无 exp 返 null。 */
function jwtExpMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** 启动时调用:cuberoot_jwt 临近过期则静默续签。best-effort,失败不影响现有登录态。 */
export async function ensureFreshToken(): Promise<void> {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem(JWT_KEY);
  if (!token) return;
  const expMs = jwtExpMs(token);
  // 无 exp(永久 token)无需续;剩余还很多也不续。
  if (expMs == null || expMs - Date.now() > REFRESH_BEFORE_MS) return;
  try {
    const r = await fetch(apiUrl('/v1/auth/refresh'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const data = (await r.json()) as { token?: string };
    if (data.token) localStorage.setItem(JWT_KEY, data.token);
  } catch {
    // 网络/后端不可用 — 保留旧 token,下次启动再试。
  }
}
