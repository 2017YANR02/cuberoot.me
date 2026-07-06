'use client';

// Google 登录/绑定的浏览器端授权 —— Google Identity Services(GIS)的隐式 token client:
// 弹窗走 Google 官方同意页,直接在浏览器拿到 access_token(不涉及 client secret)。
//
// 自有云服务器出网到 Google 被墙,不能自己验 access_token,故浏览器再把 access_token POST 到
// 墙外 Vercel 中继(relayUrl,GET /v1/auth/providers 下发)换一个「后端可离线验签的短期断言」,
// 最终交给 /v1/auth/google | /link/google。见 app/api/google-verify/route.ts。
// 脚本按需懒加载(只有真去点「用 Google 登录/绑定」才拉,不拖慢首屏)。

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}
interface GoogleTokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}
interface GoogleAccounts {
  oauth2: {
    initTokenClient: (config: {
      client_id: string;
      scope: string;
      callback: (resp: GoogleTokenResponse) => void;
      error_callback?: (err: { type?: string }) => void;
    }) => GoogleTokenClient;
  };
}
declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

let gisLoad: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts) return Promise.resolve();
  if (gisLoad) return gisLoad;
  gisLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('failed to load Google sign-in script'));
    document.head.appendChild(script);
  });
  return gisLoad;
}

/** 弹 Google 授权窗,返回 access_token。用户关闭弹窗 / 拒绝授权时 reject。 */
async function requestGoogleAccessToken(clientId: string): Promise<string> {
  await loadGis();
  const accounts = window.google?.accounts;
  if (!accounts) throw new Error('Google sign-in unavailable');
  return new Promise<string>((resolve, reject) => {
    const client = accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error(resp.error || 'Google sign-in failed'));
      },
      error_callback: (err) => reject(new Error(err?.type || 'Google sign-in failed')),
    });
    client.requestAccessToken();
  });
}

/**
 * 完整浏览器端流程:弹 Google 窗拿 access_token → POST 墙外中继换后端可离线验签的断言。
 * 返回断言字符串,交给 /v1/auth/google | /link/google。中途任一步失败即 reject。
 */
export async function requestGoogleAssertion(clientId: string, relayUrl: string): Promise<string> {
  const accessToken = await requestGoogleAccessToken(clientId);
  const res = await fetch(relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  });
  const data = (await res.json().catch(() => ({}))) as { assertion?: string; error?: string };
  if (!res.ok || !data.assertion) throw new Error(data.error || 'Google sign-in failed');
  return data.assertion;
}
