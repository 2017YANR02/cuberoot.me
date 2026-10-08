/**
 * WCA OAuth (Implicit Grant) auth state — ported from packages/client-vite/src/stores/auth_store.ts.
 * No Capacitor branch here; web only. Redirect URI is window.location.origin + '/auth/callback'.
 */
'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { ADMIN_WCA_IDS, isAdminWcaId } from '@cuberoot/shared/admin';
import { ownerKey as computeOwnerKey } from '@cuberoot/shared/account';
import type { AvatarSource, ClawdAvatarPresetId } from '@cuberoot/shared/account-avatar';
import {
  decodeWebSessionUserEnvelope,
  type WebSessionUser,
} from '@cuberoot/shared/auth/web-session';
import { apiUrl } from './api-base';
import { sessionFetch } from './session-fetch';
import { clearWebSession, establishWebSession, getWebAccessToken, getWebSessionMarker, subscribeWebSession, WEB_SESSION_MARKER_KEY } from './web-session';
import { persistItem } from './safe-storage';
import { resolveAccountAvatar } from './account-avatar';
import { isMiniProgramWebView, openMiniProgramWcaLink } from './miniprogram-bridge';

export { ADMIN_WCA_IDS };
export { safeNext } from './safe-next';

export interface WcaUser {
  /** 真实 WCA id;纯邮箱/手机账号为空串(用 uid 区分身份)。 */
  wcaId: string;
  name: string;
  avatar: string;
  avatarSource: AvatarSource;
  avatarPreset: ClawdAvatarPresetId | null;
  country: string;
  /** 内部账号 id(邮箱/手机账号必有;老的纯 WCA 会话可能没有,续签后补上)。 */
  uid?: number;
  /** 服务端账号角色；站主 WCA ID 仍由共享兜底名单保证。 */
  isAdmin: boolean;
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
const STATE_KEY = 'wca_oauth_state';
const RETURN_URL_KEY = 'wca_return_url';
const PREVIEW_KEY = 'cuberoot_role_preview';
export type TestRole = 'admin' | 'member' | 'user' | 'user-complete' | 'guest';
export type PreviewRole = TestRole | 'impersonation';
export interface RolePreview { id: string; role: PreviewRole; token: string; user: WcaUser | null }

export function getRolePreview(): RolePreview | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(sessionStorage.getItem(PREVIEW_KEY) || 'null') as RolePreview | null; }
  catch { return null; }
}

export function canTestRoles(): boolean {
  if (typeof window === 'undefined') return false;
  try { return isAdminWcaId(JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.wcaId); }
  catch { return false; }
}

export async function startRolePreview(role: TestRole): Promise<void> {
  const current = getRolePreview();
  if (current) await revokeRolePreview(current.id);
  const response = await sessionFetch(apiUrl('/v1/auth/role-preview'), {
    method: 'POST', headers: { Authorization: `Bearer ${getWebSessionMarker()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error('Could not start role test.');
  const result = await response.json();
  const user = result.user ? decodeWebSessionUserEnvelope({ user: result.user })?.user : null;
  if (typeof result.id !== 'string' || result.role !== role || typeof result.token !== 'string'
    || (role !== 'guest' && !user)) throw new Error('Invalid role test response.');
  const preview: RolePreview = {
    id: result.id, role, token: result.token,
    user: user ? { ...user, wcaId: user.wcaId ?? '', country: '' } : null,
  };
  sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(preview));
  // Reload clears queries, open files and owner-scoped state from the previous identity.
  window.location.reload();
}

export async function startUserImpersonation(
  userId: number,
  reason: string,
  targetWindow: Pick<Window, 'sessionStorage'>,
): Promise<void> {
  const normalizedReason = reason.trim();
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Invalid user id.');
  if (normalizedReason.length < 5 || normalizedReason.length > 200) throw new Error('Invalid viewing reason.');
  const response = await sessionFetch(apiUrl(`/v1/auth/admin/users/${userId}/impersonation`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${getWebSessionMarker()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: normalizedReason }),
  });
  if (!response.ok) throw new Error('Could not start user viewing session.');
  const result = await response.json();
  const user = result.user ? decodeWebSessionUserEnvelope({ user: result.user })?.user : null;
  if (typeof result.id !== 'string' || result.role !== 'impersonation' || typeof result.token !== 'string'
    || !user || !Number.isSafeInteger(user.uid)) throw new Error('Invalid user viewing response.');
  const preview: RolePreview = {
    id: result.id,
    role: 'impersonation',
    token: result.token,
    user: { ...user, wcaId: user.wcaId ?? '', country: '' },
  };
  try {
    targetWindow.sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(preview));
  } catch {
    await revokeRolePreview(preview.id).catch(() => undefined);
    throw new Error('Could not store user viewing session.');
  }
  // Deliberately do not change the page-session cookie: cookies are shared by tabs.
  // The child tab reads this tab-scoped session before making authenticated API calls.
}

async function revokeRolePreview(id: string): Promise<void> {
  const response = await sessionFetch(apiUrl(`/v1/auth/role-preview/${encodeURIComponent(id)}`), {
    method: 'DELETE', headers: { Authorization: `Bearer ${getWebSessionMarker()}` },
  });
  if (!response.ok) throw new Error('Could not end role test. Please retry.');
}

export async function endRolePreview(): Promise<void> {
  const preview = getRolePreview();
  if (!preview) return;
  await revokeRolePreview(preview.id);
  sessionStorage.removeItem(PREVIEW_KEY);
  window.location.reload();
}

function readUser(): WcaUser | null {
  if (typeof window === 'undefined') return null;
  const preview = getRolePreview();
  if (preview) return preview.user;
  if (!getWebSessionMarker()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as WcaUser;
    const avatarSource = user.avatarSource ?? 'auto';
    const avatarPreset = user.avatarPreset ?? null;
    return {
      ...user,
      avatar: resolveAccountAvatar(user.avatar, avatarPreset, avatarSource).src,
      avatarSource,
      avatarPreset,
      isAdmin: user.isAdmin === true,
    };
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
    let intent = '';
    try { intent = sessionStorage.getItem('wca_oauth_intent') ?? ''; } catch { /* private mode */ }
    if (intent === 'link' && isMiniProgramWebView()) {
      void getWebAccessToken(getSessionToken()).then(openMiniProgramWcaLink).then(() => {
        try { sessionStorage.removeItem('wca_oauth_intent'); } catch { /* private mode */ }
      });
      return;
    }
    const state = crypto.randomUUID();
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
    if (getRolePreview()) { void endRolePreview(); return; }
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    void clearWebSession().catch(() => undefined);
    set({ user: null });
  },

  refresh: () => {
    set({ user: readUser() });
  },
}));

/** The server owns persistent credentials; only user metadata and a marker are stored. */
function persistSessionUser(user: WebSessionUser | null): void {
  if (!user) {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* unavailable storage */ }
    useAuthStore.setState({ user: null });
    return;
  }
  const avatar = resolveAccountAvatar(user.avatar, user.avatarPreset, user.avatarSource);
  const wu: WcaUser = {
    wcaId: user.wcaId ?? '', name: user.name, avatar: avatar.src,
    avatarSource: user.avatarSource, avatarPreset: user.avatarPreset,
    country: '', uid: user.uid, isAdmin: user.isAdmin,
  };
  if (!persistAuthItem(SESSION_KEY, JSON.stringify(wu))) {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* avoid displaying the previous identity after reload */ }
  }
  useAuthStore.setState({ user: wu });
}

export async function applySession(token: string, _user: WebSessionUser, isCurrent?: () => boolean): Promise<boolean> {
  if (typeof window === 'undefined' || getRolePreview()) return false;
  try {
    await establishWebSession(token, isCurrent);
    return true;
  } catch { return false; }
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

/** Primary session marker, or the tab-scoped temporary role-preview credential. */
export function getSessionToken(): string {
  if (typeof window === 'undefined') return '';
  const preview = getRolePreview();
  if (preview) return preview.token;
  return getWebSessionMarker();
}

if (typeof window !== 'undefined') {
  subscribeWebSession(user => { if (!getRolePreview()) persistSessionUser(user); });
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === WEB_SESSION_MARKER_KEY || e.key === SESSION_KEY) {
      useAuthStore.getState().refresh();
    }
  });
}

/** WCA assertions are exchanged in memory during OAuth and never persisted. */
export function getWcaToken(): string { return ''; }

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
  return hasAdminAccess(useAuthStore.getState().user);
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

export function hasAdminAccess(user: Pick<WcaUser, 'wcaId' | 'isAdmin'> | null | undefined): boolean {
  return !!user && (user.isAdmin || isAdminWcaId(user.wcaId));
}

export function useIsAdmin(): boolean {
  return hasAdminAccess(useAuthUser());
}

/**
 * 用现有 JWT 拉取账号最新态。管理员升降级不改 JWT，因此刷新页面即可同步角色，
 * 不要求用户退出再登录；失败时保留当前会话。
 */
export async function refreshSessionUser(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (getRolePreview()) return;
  const token = getWebSessionMarker();
  if (!token) return;
  try {
    const response = await sessionFetch(apiUrl('/v1/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return;
    const envelope = decodeWebSessionUserEnvelope(await response.json());
    if (envelope && getWebSessionMarker() === token) persistSessionUser(envelope.user);
  } catch {
    // 网络或后端暂不可用：保留已有登录态，下次页面加载再同步。
  }
}

/** Hydration-safe 版 getOwnerKey(SSG 页按登录态分叉渲染必用,理由同 useAuthUser)。 */
export function useOwnerKey(): string {
  const user = useAuthUser();
  return computeOwnerKey(user?.uid, user?.wcaId);
}

/** Startup migration/restore. Failures never fall back to a persisted bearer token. */
export async function ensureFreshToken(): Promise<void> {
  if (typeof window === 'undefined' || getRolePreview()) return;
  const marker = getWebSessionMarker();
  if (!marker) return;
  try { await getWebAccessToken(marker); } catch { /* allow a later network retry */ }
}
