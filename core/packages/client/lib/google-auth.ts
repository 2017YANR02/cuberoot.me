'use client';

// Google 登录/绑定的浏览器端授权 —— Google Identity Services(GIS)的隐式 token client:
// 弹窗走 Google 官方同意页,直接在浏览器拿到 access_token(不涉及 client secret),
// 拿到的 token 交给服务端 /v1/auth/google 或 /v1/auth/link/google 转发校验。
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
export async function requestGoogleAccessToken(clientId: string): Promise<string> {
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
