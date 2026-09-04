'use client';

// 内部账号 API 客户端(邮箱/手机验证码登录 + 绑定/解绑)。全走 apiUrl(),别硬编码 origin。
import { apiUrl } from './api-base';
import { getSessionToken } from './auth-store';
import { authHeaders, handleApi } from './admin-api';
import type { WebSession, WebSessionUser } from '@cuberoot/shared/auth/web-session';
import type { ClawdAvatarPresetId } from '@cuberoot/shared/account-avatar';
import type { AccountBasicProfile } from '@cuberoot/shared/account';

export type SessionUser = WebSessionUser;
export interface SessionResp extends WebSession {
  /** 这次是「注册」而非「登录」(登录/注册合流,只有服务端知道账号是不是刚建的)。
   *  新人才做「有 WCA ID 吗」的引导 —— 老用户每次登录都被问一遍会很烦。 */
  isNew?: boolean;
}
export interface Identity {
  provider: string;
  providerUid: string;
  createdAt: string;
}

async function post<T>(path: string, body: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const tok = getSessionToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
  }
  const res = await fetch(apiUrl(path), { method: 'POST', headers, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) || `HTTP ${res.status}`);
  return data as T;
}

// 登录/注册(合并流程)
export const sendEmailCode = (email: string) => post<{ ok: true }>('/v1/auth/email/send', { email });
export const verifyEmailCode = (email: string, code: string) => post<SessionResp>('/v1/auth/email/verify', { email, code });
// 邮箱 + 密码登录(账号已设密码即可,不依赖邮件服务)
export const loginPassword = (email: string, password: string) => post<SessionResp>('/v1/auth/email/password', { email, password });
// 设置 / 修改 / 重置密码(登录态)。改密要 currentPassword;刚验证邮箱,或通过专用短信找回流程时可免旧密码。
export const setPassword = (password: string, currentPassword?: string) =>
  post<{ ok: true; hasPassword: true }>('/v1/auth/password/set', { password, currentPassword }, true);
// 移除密码,退回纯验证码登录(同 Notion 的 Remove password)。凭据要求同上。
export const removePassword = (currentPassword?: string) =>
  post<{ ok: true; hasPassword: false }>('/v1/auth/password/remove', { currentPassword }, true);
/**
 * 注销账号(立即生效,不可恢复)。confirm 要与账号主标识一致(shared 的 primaryHandle:
 * 邮箱 > 手机 > WCA ID),设了密码的账号还要一并交当前密码 —— 两道闸都在服务端复核。
 */
export const deleteAccount = (confirm: string, password?: string) =>
  post<{ ok: true }>('/v1/auth/account/delete', { confirm, password }, true);
// 修改站内用户名后同时换发带新名字的 JWT,供本机登录态原子刷新。
export const updateDisplayName = (name: string) =>
  post<{ ok: true; token: string; user: SessionUser }>('/v1/auth/profile', { name }, true);
export async function fetchAccountBasicProfile(): Promise<AccountBasicProfile> {
  const response = await fetch(apiUrl('/v1/auth/profile'), {
    headers: { Authorization: `Bearer ${getSessionToken()}` },
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as {
    profile?: AccountBasicProfile;
    error?: string;
  };
  if (!response.ok || !data.profile) throw new Error(data.error || `HTTP ${response.status}`);
  return data.profile;
}
export const updateAccountBasicProfile = (
  basic: Pick<AccountBasicProfile, 'fullName' | 'birthDate' | 'gender' | 'countryIso2' | 'regionCode' | 'cityName'>,
) => post<{ ok: true; profile: AccountBasicProfile }>('/v1/auth/profile', { basic }, true);
export async function fetchAdminUser(userId: number): Promise<SessionUser> {
  const response = await fetch(apiUrl(`/v1/auth/admin/users/${userId}`), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  return (await handleApi<{ user: SessionUser }>(response)).user;
}
export interface AdminUserIdentity {
  provider: string;
  providerUid: string;
  verifiedAt: string | null;
  createdAt: string;
}
export interface AdminUserRecord {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  wcaId: string | null;
  isAdmin: boolean;
  isRootAdmin: boolean;
  birthDate: string | null;
  gender: string | null;
  countryIso2: string | null;
  regionCode: string | null;
  cityName: string | null;
  createdAt: string;
  updatedAt: string;
  passwordUpdatedAt: string | null;
  hasPassword: boolean;
  emailNotify: boolean;
  lang: string | null;
  lastDevice: {
    deviceType: 'phone' | 'tablet' | 'desktop' | 'other';
    osFamily: 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';
    osMajor: number | null;
    browserFamily: 'chrome' | 'edge' | 'firefox' | 'safari' | 'wechat' | 'webview' | 'other';
    browserMajor: number | null;
    container: 'wechat' | 'webview' | 'browser';
    lastSeenAt: string;
  } | null;
  identities: AdminUserIdentity[];
}
export interface AdminUsersResponse {
  canManageAdmins: boolean;
  summary: {
    totalUsers: number;
    registeredToday: number;
    registeredLast7Days: number;
    wcaUsers: number;
    passwordUsers: number;
    completedProfiles: number;
    usersWithoutIdentity: number;
  };
  membershipSummary?: {
    activePersonal: number;
    activeEnterprise: number;
  };
  activity?: {
    from: string;
    to: string;
    timeZone: 'UTC';
    registrations: Array<{ date: string; count: number }>;
    memberships: Array<{ date: string; personal: number; enterprise: number }>;
  };
  daily: Array<{ date: string; count: number }>;
  providerCounts: Array<{ provider: string; count: number }>;
  users: AdminUserRecord[];
  pagination: { page: number; pageSize: number; total: number };
}
export async function fetchAdminUsers(params: {
  q?: string;
  provider?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  from?: string;
  to?: string;
}): Promise<AdminUsersResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.provider && params.provider !== 'all') search.set('provider', params.provider);
  if (params.page && params.page !== 1) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.sort) search.set('sort', params.sort);
  if (params.direction) search.set('direction', params.direction);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  const response = await fetch(apiUrl(`/v1/auth/admin/users?${search}`), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  return handleApi<AdminUsersResponse>(response);
}
export async function updateAdminDisplayName(userId: number, name: string): Promise<SessionUser> {
  const response = await fetch(apiUrl(`/v1/auth/admin/users/${userId}/profile`), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ name }),
  });
  return (await handleApi<{ ok: true; user: SessionUser }>(response)).user;
}
export async function updateAdminRole(
  userId: number,
  isAdmin: boolean,
): Promise<{ isAdmin: boolean; isRootAdmin: boolean }> {
  const response = await fetch(apiUrl(`/v1/auth/admin/users/${userId}/admin`), {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify({ isAdmin }),
  });
  return handleApi<{ ok: true; isAdmin: boolean; isRootAdmin: boolean }>(response);
}
export type AvatarChoice =
  | { kind: 'clawd'; preset: ClawdAvatarPresetId }
  | { kind: 'upload'; imageId: number }
  | { kind: 'wca' };
export const updateAvatar = (avatar: AvatarChoice) =>
  post<{ ok: true; token: string; user: SessionUser }>('/v1/auth/profile', { avatar }, true);
export const sendPhoneCode = (phone: string) => post<{ ok: true }>('/v1/auth/phone/send', { phone });
export const verifyPhoneCode = (phone: string, code: string) => post<SessionResp>('/v1/auth/phone/verify', { phone, code });
export const sendPhonePasswordResetCode = (phone: string) =>
  post<{ ok: true }>('/v1/auth/phone/send', { phone, purpose: 'password_reset' });
export const verifyPhonePasswordResetCode = (phone: string, code: string) =>
  post<SessionResp>('/v1/auth/phone/verify', { phone, code, purpose: 'password_reset' });

// 绑定(登录态)
export const linkEmailSend = (email: string) => post<{ ok: true }>('/v1/auth/link/email/send', { email }, true);
export const linkEmailVerify = (email: string, code: string) => post<{ ok: true; identities: Identity[] }>('/v1/auth/link/email/verify', { email, code }, true);
// 换绑邮箱:发码复用 linkEmailSend(同一个 'link' 用途的码),只有最后一步落库不同 ——
// 原地改那条 email 身份。一个账号只能一个邮箱,而唯一的登录方式又不许解绑,所以「先解绑
// 再绑定」对只有邮箱的账号是死路。
export const replaceEmailVerify = (email: string, code: string) => post<{ ok: true; identities: Identity[] }>('/v1/auth/email/replace', { email, code }, true);
export const linkPhoneSend = (phone: string) => post<{ ok: true }>('/v1/auth/link/phone/send', { phone }, true);
export const linkPhoneVerify = (phone: string, code: string) => post<{ ok: true; identities: Identity[] }>('/v1/auth/link/phone/verify', { phone, code }, true);
// 换绑手机号:同 replaceEmailVerify,理由一样(0103 起手机也是一个账号一条)。
export const replacePhoneVerify = (phone: string, code: string) => post<{ ok: true; identities: Identity[] }>('/v1/auth/phone/replace', { phone, code }, true);
export const linkWca = (accessToken: string) => post<{ ok: true; token?: string; user?: SessionUser; identities: Identity[] }>('/v1/auth/link/wca', { accessToken }, true);
export const unlinkIdentity = (provider: string, providerUid?: string) => post<{ ok: true; token?: string; user?: SessionUser; identities: Identity[] }>('/v1/auth/unlink', { provider, providerUid }, true);

// Google(浏览器经墙外中继换来的断言 → 后端离线验签;登录/绑定各一条,同 email/phone 的两段式)
export const loginGoogle = (assertion: string) => post<SessionResp>('/v1/auth/google', { assertion });
export const linkGoogle = (assertion: string) => post<{ ok: true; identities: Identity[] }>('/v1/auth/link/google', { assertion }, true);

// 国内三方(微信/QQ/支付宝):授权码重定向流。浏览器跳授权页 → 回调拿 code → 交后端换身份。
export type SocialProvider = 'wechat' | 'qq' | 'alipay';
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = ['wechat', 'qq', 'alipay'];
// state 为服务端签名的自包含 token(从回调 URL 读回),服务端验签做 CSRF,不依赖 sessionStorage。
export const loginSocial = (provider: SocialProvider, code: string, state: string) => post<SessionResp>(`/v1/auth/social/${provider}`, { code, state });
export const linkSocial = (provider: SocialProvider, code: string, state: string) => post<{ ok: true; identities: Identity[] }>(`/v1/auth/link/social/${provider}`, { code, state }, true);
/** 服务端下发的授权页 URL(redirect_uri + 签名 state 均由服务端固定,保证与换 code 时一致)。 */
export async function fetchSocialAuthorizeUrl(provider: SocialProvider, intent: 'login' | 'link'): Promise<string> {
  const res = await fetch(apiUrl(`/v1/auth/social/authorize?provider=${provider}&intent=${intent}`));
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || `HTTP ${res.status}`);
  return data.url;
}

export interface WechatBrowserLoginStart {
  expiresIn: number;
  ticket: string;
  urlLink: string;
}

export const startWechatBrowserLogin = () => post<WechatBrowserLoginStart>(
  '/v1/auth/wechat/browser-session/start',
  {},
);

export async function exchangeWechatBrowserLogin(ticket: string): Promise<SessionResp | null> {
  const res = await fetch(apiUrl('/v1/auth/wechat/browser-session/exchange'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 202 && data.status === 'pending') return null;
  if (!res.ok) throw new Error((data.error as string) || `HTTP ${res.status}`);
  return data as unknown as SessionResp;
}

export interface AuthProviders {
  email: boolean; phone: boolean; wca: boolean;
  googleClientId: string | null; googleRelayUrl: string | null;
  social: Record<SocialProvider, string | null>;
}
let providersCache: AuthProviders | null = null;
/** 服务端已配置的登录方式(env 未配 email/sms/google 则对应关闭)。成功结果进模块缓存;
 *  拿不到就乐观全开 email/phone/wca(退化成旧行为:点未配的方式走 503 + 友好文案),
 *  但 google 拿不到 clientId/relayUrl 就是 null(没有它俩发不起弹窗/验不了真,不能乐观)。 */
const NO_SOCIAL: Record<SocialProvider, string | null> = { wechat: null, qq: null, alipay: null };
function normSocial(raw: unknown): Record<SocialProvider, string | null> {
  const s = (raw ?? {}) as Record<string, unknown>;
  const out = { ...NO_SOCIAL };
  for (const p of SOCIAL_PROVIDERS) out[p] = typeof s[p] === 'string' && s[p] ? (s[p] as string) : null;
  return out;
}
export async function fetchAuthProviders(): Promise<AuthProviders> {
  if (providersCache) return providersCache;
  try {
    const res = await fetch(apiUrl('/v1/auth/providers'));
    if (res.ok) {
      const d = (await res.json()) as Partial<AuthProviders>;
      providersCache = { email: !!d.email, phone: !!d.phone, wca: d.wca !== false, googleClientId: d.googleClientId ?? null, googleRelayUrl: d.googleRelayUrl ?? null, social: normSocial(d.social) };
      return providersCache;
    }
  } catch { /* ignore */ }
  return { email: true, phone: true, wca: true, googleClientId: null, googleRelayUrl: null, social: { ...NO_SOCIAL } };
}

/** canResetPassword:本次会话刚用邮箱验证码登录 → 改 / 移除密码时无需当前密码。 */
export async function fetchIdentities(): Promise<{ identities: Identity[]; hasPassword: boolean; canResetPassword: boolean }> {
  const res = await fetch(apiUrl('/v1/auth/identities'), {
    headers: { Authorization: `Bearer ${getSessionToken()}` },
  });
  if (!res.ok) return { identities: [], hasPassword: false, canResetPassword: false };
  const data = (await res.json().catch(() => ({}))) as { identities?: Identity[]; hasPassword?: boolean; canResetPassword?: boolean };
  return { identities: data.identities ?? [], hasPassword: !!data.hasPassword, canResetPassword: !!data.canResetPassword };
}
