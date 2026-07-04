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
export const sendPhoneCode = (phone: string) => post<{ ok: true }>('/v1/auth/phone/send', { phone });
export const verifyPhoneCode = (phone: string, code: string) => post<SessionResp>('/v1/auth/phone/verify', { phone, code });

// 绑定(登录态)
export const linkEmailSend = (email: string) => post<{ ok: true }>('/v1/auth/link/email/send', { email }, true);
export const linkEmailVerify = (email: string, code: string) => post<{ ok: true; identities: Identity[] }>('/v1/auth/link/email/verify', { email, code }, true);
export const linkPhoneSend = (phone: string) => post<{ ok: true }>('/v1/auth/link/phone/send', { phone }, true);
export const linkPhoneVerify = (phone: string, code: string) => post<{ ok: true; identities: Identity[] }>('/v1/auth/link/phone/verify', { phone, code }, true);
export const linkWca = (accessToken: string) => post<{ ok: true; token?: string; user?: SessionUser; identities: Identity[] }>('/v1/auth/link/wca', { accessToken }, true);
export const unlinkIdentity = (provider: string, providerUid?: string) => post<{ ok: true; token?: string; user?: SessionUser; identities: Identity[] }>('/v1/auth/unlink', { provider, providerUid }, true);

export async function fetchIdentities(): Promise<Identity[]> {
  const res = await fetch(apiUrl('/v1/auth/identities'), {
    headers: { Authorization: `Bearer ${getSessionToken()}` },
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as { identities?: Identity[] };
  return data.identities ?? [];
}
