'use client';

// 内部账号 API 客户端(邮箱/手机验证码登录 + 绑定/解绑)。全走 apiUrl(),别硬编码 origin。
import { apiUrl } from './api-base';
import { getSessionToken } from './auth-store';

export interface SessionUser {
  uid?: number;
  wcaId: string | null;
  name: string;
  avatar?: string;
}
export interface SessionResp {
  token: string;
  user: SessionUser;
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
// 设置 / 修改密码(登录态;改密时传 currentPassword)
export const setPassword = (password: string, currentPassword?: string) =>
  post<{ ok: true; hasPassword: true }>('/v1/auth/password/set', { password, currentPassword }, true);
export const sendPhoneCode = (phone: string) => post<{ ok: true }>('/v1/auth/phone/send', { phone });
export const verifyPhoneCode = (phone: string, code: string) => post<SessionResp>('/v1/auth/phone/verify', { phone, code });

// 绑定(登录态)
export const linkEmailSend = (email: string) => post<{ ok: true }>('/v1/auth/link/email/send', { email }, true);
export const linkEmailVerify = (email: string, code: string) => post<{ ok: true; identities: Identity[] }>('/v1/auth/link/email/verify', { email, code }, true);
export const linkPhoneSend = (phone: string) => post<{ ok: true }>('/v1/auth/link/phone/send', { phone }, true);
export const linkPhoneVerify = (phone: string, code: string) => post<{ ok: true; identities: Identity[] }>('/v1/auth/link/phone/verify', { phone, code }, true);
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

export async function fetchIdentities(): Promise<{ identities: Identity[]; hasPassword: boolean }> {
  const res = await fetch(apiUrl('/v1/auth/identities'), {
    headers: { Authorization: `Bearer ${getSessionToken()}` },
  });
  if (!res.ok) return { identities: [], hasPassword: false };
  const data = (await res.json().catch(() => ({}))) as { identities?: Identity[]; hasPassword?: boolean };
  return { identities: data.identities ?? [], hasPassword: !!data.hasPassword };
}
