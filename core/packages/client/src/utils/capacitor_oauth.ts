/**
 * Capacitor 原生 app 的 OAuth 流程胶水。
 *
 * 浏览器端:`window.location.href = authorizeUrl` 跳到 WCA,WCA 完成后 redirect 回
 *   `https://cuberoot.me/auth/callback#access_token=...`, AuthCallbackPage 接管。
 *
 * Capacitor 端:不能直接 redirect 回 `https://localhost/...` (系统浏览器解析不出去),
 *   走 custom scheme deep link `me.cuberoot.app://auth-callback`:
 *   1. Browser.open 在 in-app browser (SFSafariViewController / Custom Tab) 打 WCA 授权页
 *   2. 用户登录,WCA redirect 到 me.cuberoot.app://auth-callback#token=...
 *   3. OS 看到 scheme 注册到本 app → 触发 App.appUrlOpen 事件
 *   4. 监听器关闭 in-app browser + pushState 到 /auth/callback#hash,
 *      让 AuthCallbackPage 走原有逻辑处理 token
 *
 * 需要在 WCA developer console 给 OAuth app 加 redirect_uri=me.cuberoot.app://auth-callback
 * (除了已有的 https://cuberoot.me/auth/callback)。
 */

export const NATIVE_REDIRECT_URI = 'me.cuberoot.app://auth-callback';

export function isCapacitorNative(): boolean {
  return !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}

/** 原生端:用 Capacitor Browser plugin 打开 WCA 授权 URL */
export async function openNativeOAuth(authorizeUrl: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: authorizeUrl });
}

/** main.tsx 启动时调一次。监听 deep link,把 token 喂回 SPA。 */
export async function installNativeOAuthHandler(): Promise<void> {
  if (!isCapacitorNative()) return;
  const { App } = await import('@capacitor/app');
  const { Browser } = await import('@capacitor/browser');

  await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_REDIRECT_URI)) return;
    // iOS SFSafariViewController 走完会自动关,Android Custom Tab 手动关
    try { await Browser.close(); } catch { /* ignore */ }

    const hashIdx = url.indexOf('#');
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';

    // 用 pushState + popstate 让 React Router 路由到 AuthCallbackPage,
    // 不能 window.location.href= (Capacitor webview 对 /auth/callback 文件名 404 fallback)
    window.history.pushState(null, '', '/auth/callback' + hash);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}
