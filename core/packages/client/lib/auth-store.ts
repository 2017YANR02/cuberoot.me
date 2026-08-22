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
export { safeNext } from './safe-next';

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
}

interface AuthActions {
  /** 去登录页 /account —— 全站 20 余处「需要登录」入口都走这里。没有弹层形态。 */
  login: () => void;
  /** 直接跳 WCA OAuth(登录页「用 WCA 登录」按钮用)。
   *  returnTo:授权完成后要落到的站内地址,省略则回当前页。新人引导里绑完 WCA 要直接把人
   *  送回 ?next= 的来处,而不是在账号页再停一站。 */
  loginWithWca: (returnTo?: string) => void;
  logout: () => void;
  refresh: () => void;
}

const WCA_CLIENT_ID = 'mPeg5FiAn7l0CcyQ9CdiSEn3XlBrcA7IMw6Vd9AOsz4';
const WCA_AUTHORIZE_URL = 'https://www.worldcubeassociation.org/oauth/authorize';

const SESSION_KEY = 'wca_user';
const TOKEN_KEY = 'wca_access_token';
const JWT_KEY = 'cuberoot_jwt';
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

// 「去登录」是导航,不是开弹层 —— store 不在 React 树里拿不到 router,由 AuthRouteBridge
// (挂 app/layout.tsx)注册一次。没注册时退化成整页跳转:能用,只是丢 SPA 状态。
let navigate: ((href: string) => void) | null = null;
export function setAuthNavigate(fn: ((href: string) => void) | null): void {
  navigate = fn;
}

/**
 * 登录页 href 的 ?next= 部分:记住来处供登录后回跳。已经在登录页时为空 —— 否则登录完
 * 又跳回登录页。给 <AppLink href={`/account${nextQuery(pathname)}`}> 和 loginHref 共用。
 *
 * 先把内部路径归一成对外形式:Pattern B 下英文是裸 URL,但 usePathname() 在英文路由上
 * 回的是 rewrite 后的 `/en/...`。直接拿它当 next,登录后会把人扔到非规范的 /en/*。
 */
export function nextQuery(path: string): string {
  const p = path === '/en' ? '/' : path.startsWith('/en/') ? path.slice(3) : path;
  return /^(\/zh)?\/account$/.test(p) ? '' : `?next=${encodeURIComponent(p)}`;
}

/** 登录页完整地址(带 lang 前缀,Pattern B:英文裸路径,中文 /zh)。imperative 跳转用。 */
export function loginHref(): string {
  if (typeof window === 'undefined') return '/account';
  const path = window.location.pathname;
  const prefix = path === '/zh' || path.startsWith('/zh/') ? '/zh' : '';
  return `${prefix}/account` + nextQuery(path);
}

/**
 * 校验 ?next= 回跳目标的兼容导出；实现集中在 safe-next.ts，供不依赖账号状态的代码复用。
 */
export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: readUser(),

  login: () => {
    if (typeof window === 'undefined') return;
    const href = loginHref();
    if (navigate) navigate(href);
    else window.location.assign(href);
  },

  loginWithWca: (returnTo?: string) => {
    if (typeof window === 'undefined') return;
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_URL_KEY, returnTo || window.location.href);

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
    set({ user: null });
  },

  refresh: () => {
    set({ user: readUser() });
  },
}));

/**
 * 把 { token, user } 作为一个完整登录态落地。任一项写入或回读失败时恢复
 * 旧会话，避免出现「有 token 没用户」或「有用户没 token」的半登录状态。
 */
export function applySession(
  token: string,
  user: { uid?: number; wcaId: string | null; name: string; avatar?: string },
): boolean {
  if (typeof window === 'undefined') return false;

  let previousToken: string | null;
  let previousUser: string | null;
  try {
    previousToken = localStorage.getItem(JWT_KEY);
    previousUser = localStorage.getItem(SESSION_KEY);
  } catch {
    return false;
  }

  const wu: WcaUser = {
    wcaId: user.wcaId ?? '',
    name: user.name,
    avatar: user.avatar ?? '',
    country: '',
    uid: user.uid,
  };
  const serializedUser = JSON.stringify(wu);

  const restoreItem = (key: string, value: string | null) => {
    if (value === null) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Best effort: the false return still prevents navigation as logged in.
      }
      return;
    }
    persistAuthItem(key, value);
  };

  const persisted =
    persistAuthItem(SESSION_KEY, serializedUser) &&
    persistAuthItem(JWT_KEY, token);
  let verified = false;
  if (persisted) {
    try {
      verified =
        localStorage.getItem(SESSION_KEY) === serializedUser &&
        localStorage.getItem(JWT_KEY) === token;
    } catch {
      verified = false;
    }
  }

  if (!verified) {
    restoreItem(SESSION_KEY, previousUser);
    restoreItem(JWT_KEY, previousToken);
    useAuthStore.getState().refresh();
    return false;
  }

  useAuthStore.getState().refresh();
  return true;
}

// ── 新人「绑定 WCA」引导的待办标记 ──
// 注册成功那一刻打标,进 /account 时消费掉(只引导一次)。存在的理由是三方登录那条路:
// 微信/QQ/支付宝的授权是整页跳走再回来的,回来时人已不在登录表单里,只能靠这个标记把引导接上。
// sessionStorage:关标签页即失效;手机唤起支付宝 App 时可能跨浏览器上下文而丢 —— 丢了就不
// 引导,账号页的「绑定 WCA」入口一直在,这一步从来不是必经环节。
const WCA_PROMPT_KEY = 'wca_link_prompt_at';
const WCA_PROMPT_TTL_MS = 10 * 60 * 1000; // 注册完先去逛了十分钟,再回账号页就别突然发问了

/** 记下「这个账号是刚注册的,还没绑 WCA」。 */
export function markWcaLinkPrompt(): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(WCA_PROMPT_KEY, String(Date.now())); } catch { /* 隐私模式忽略 */ }
}

/** 读一次并清除:是否该给这个新账号做 WCA 绑定引导。 */
export function takeWcaLinkPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(WCA_PROMPT_KEY);
    sessionStorage.removeItem(WCA_PROMPT_KEY);
    return !!raw && Date.now() - Number(raw) < WCA_PROMPT_TTL_MS;
  } catch {
    return false;
  }
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

/** 启动时调用:旧会话缺 uid 或 cuberoot_jwt 临近过期时静默续签。best-effort,失败不影响现有登录态。 */
export async function ensureFreshToken(): Promise<void> {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem(JWT_KEY);
  if (!token) return;
  const expMs = jwtExpMs(token);
  const storedUser = readUser();
  const needsUserId = storedUser != null && !Number.isSafeInteger(storedUser.uid);
  // 老会话缺 uid 时立即升级;否则无 exp(永久 token)无需续,剩余还很多也不续。
  if (!needsUserId && (expMs == null || expMs - Date.now() > REFRESH_BEFORE_MS)) return;
  try {
    const r = await fetch(apiUrl('/v1/auth/refresh'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const data = (await r.json()) as { token?: string; user?: WcaUser };
    if (data.token && data.user) {
      applySession(data.token, data.user);
    } else if (data.token) {
      persistItem(JWT_KEY, data.token);
    }
  } catch {
    // 网络/后端不可用 — 保留旧 token,下次启动再试。
  }
}
