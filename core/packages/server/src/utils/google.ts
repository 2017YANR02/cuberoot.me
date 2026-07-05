/**
 * Google 登录/绑定 —— 客户端走 Google Identity Services 的隐式 token client(弹窗拿 access_token,
 * 不涉及 client secret,GOOGLE_CLIENT_ID 本就是前端 JS 里天然可见的公开值)。服务端只需拿这个
 * access_token 去 Google 官方 userinfo 端点验真 + 取 sub/email/name,与 `/auth/link/wca` 转发
 * WCA access_token 到 `/api/v0/me` 同一手法,无需引入 SDK。
 *
 * env 未配 GOOGLE_CLIENT_ID 时 googleConfigured() 返 false,路由据此返回 503,与 email/sms 同款降级。
 */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

export function googleConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID);
}

export function googleClientId(): string | null {
  return GOOGLE_CLIENT_ID || null;
}

export interface GoogleUserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

/** 用 access_token 换 Google 用户信息;token 无效/过期时抛异常。 */
export async function fetchGoogleUser(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error('invalid Google token');
  const data = (await res.json()) as GoogleUserInfo;
  if (!data.sub) throw new Error('missing Google sub');
  return data;
}
