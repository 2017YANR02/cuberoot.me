'use client';

// Apple 与国内三方(微信/QQ/支付宝)复用同一浏览器授权码重定向流。
// state 由服务端签名(内含 provider/intent/exp/签名),嵌进授权 URL、回调时原样回来,服务端验签做 CSRF。
// **不依赖 sessionStorage**:手机唤起支付宝 App 授权后,回调常落到另一浏览器上下文(系统浏览器 /
// App 内置浏览器),sessionStorage 会丢 → 校验必须无状态。returnUrl 同时存 sessionStorage 和
// localStorage；后者让系统浏览器经外部 OAuth App 回来时仍能继续 Mobile PKCE handoff。
// Apple 不用该跨浏览器降级：state/verifier 必须在发起浏览器 sessionStorage 中，服务端也验证 PKCE。

import { fetchSocialAuthorization, type RedirectAuthProvider } from './account-api';
import { createAuthPkcePair, isMobileAuthCodeVerifier } from '@cuberoot/shared/auth/web-session';
import { useAuthStore } from './auth-store';

// 回跳目标页(best-effort;跨浏览器上下文丢失时回调兜底回首页)。
export const SOCIAL_RETURN_KEY = 'social_oauth_return';
export const APPLE_STATE_KEY = 'apple_oauth_state';

type ReturnStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

/** The callback's canonical host must own the initiating sessionStorage too. */
export function appleCanonicalEntry(siteOrigin: string | undefined, currentHref: string): string | null {
  if (!siteOrigin) throw new Error('Invalid Apple authorization site');
  const origin = new URL(siteOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== siteOrigin || origin.username || origin.password) {
    throw new Error('Invalid Apple authorization site');
  }
  const current = new URL(currentHref);
  if (current.origin === siteOrigin) return null;
  // Assign URL fields, never resolve a path beginning with // as another host.
  origin.pathname = current.pathname;
  origin.search = current.search;
  origin.hash = current.hash;
  return origin.href;
}

/** Apple stays in the initiating browser. Fail closed if that browser cannot retain state. */
export function rememberAppleState(url: string, codeVerifier: string, session: ReturnStorage = window.sessionStorage): void {
  const target = new URL(url);
  const state = target.searchParams.get('state');
  if (target.origin !== 'https://appleid.apple.com' || !state || state.split('.')[1] !== 'apple'
    || !isMobileAuthCodeVerifier(codeVerifier)) {
    throw new Error('Invalid Apple authorization URL');
  }
  const pending = JSON.stringify({ state, codeVerifier });
  session.setItem(APPLE_STATE_KEY, pending);
  if (session.getItem(APPLE_STATE_KEY) !== pending) throw new Error('Apple sign-in requires browser storage');
}

export function consumeAppleState(state: string, session?: ReturnStorage): string | null {
  try {
    const storage = session ?? window.sessionStorage;
    const raw = storage.getItem(APPLE_STATE_KEY);
    storage.removeItem(APPLE_STATE_KEY);
    const expected = raw ? JSON.parse(raw) as { state?: unknown; codeVerifier?: unknown } : null;
    return state && expected?.state === state && isMobileAuthCodeVerifier(expected.codeVerifier) ? expected.codeVerifier : null;
  } catch { return null; }
}

export function rememberSocialReturnUrl(
  returnUrl: string,
  session: ReturnStorage = window.sessionStorage,
  local: ReturnStorage = window.localStorage,
): void {
  try { session.setItem(SOCIAL_RETURN_KEY, returnUrl); } catch { /* 隐私模式忽略 */ }
  try { local.setItem(SOCIAL_RETURN_KEY, returnUrl); } catch { /* 隐私模式忽略 */ }
}

export function takeSocialReturnUrl(
  session?: ReturnStorage,
  local?: ReturnStorage,
): string | null {
  let sessionValue: string | null = null;
  let localValue: string | null = null;
  try {
    const storage = session ?? window.sessionStorage;
    sessionValue = storage.getItem(SOCIAL_RETURN_KEY);
    storage.removeItem(SOCIAL_RETURN_KEY);
  } catch { /* 隐私模式忽略 */ }
  try {
    const storage = local ?? window.localStorage;
    localValue = storage.getItem(SOCIAL_RETURN_KEY);
    storage.removeItem(SOCIAL_RETURN_KEY);
  } catch { /* 隐私模式忽略 */ }
  return sessionValue || localValue;
}

/** Router destinations must stay local, including after a malformed // path. */
export function socialCallbackReturnPath(returnUrl: string | null, currentHref: string): string {
  try {
    const current = new URL(currentHref);
    const target = new URL(returnUrl || '/', current);
    if (target.origin !== current.origin || target.pathname.startsWith('//') || target.pathname.startsWith('/auth/')) return '/';
    return target.pathname + target.search + target.hash;
  } catch { return '/'; }
}

/** startSocialLogin 结果:navigated=true 整页已跳授权页(页面即将卸载,spinner 保持到离开);
 *  navigated=false 只是用 `alipays://` scheme 唤起了 App,**当前页不卸载**,调用方须收起 spinner
 *  改提示「已打开支付宝,授权完返回本页」。 */
export interface StartSocialResult { navigated: boolean }

/** iPhone/iPad desktop-site mode reports a macOS UA, so use touch + CSS screen size. */
export function prefersWechatMiniProgramLogin(): boolean {
  if (typeof navigator === 'undefined' || typeof screen === 'undefined') return false;
  return navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) <= 1024;
}

/** 发起三方登录/绑定。intent='login' 未登录时登录;'link' 已登录时把该身份加到当前账号。
 *  先拿 URL(失败即抛,给调用方在弹层里显错),成功再跳转。 */
export async function startSocialLogin(provider: RedirectAuthProvider, intent: 'login' | 'link', expectedUid?: number, signal?: AbortSignal): Promise<StartSocialResult> {
  if (typeof window === 'undefined') return { navigated: false };
  signal?.throwIfAborted();
  if (provider === 'apple' && window.parent !== window) {
    throw new Error('Apple authorization requires system browser');
  }
  if (provider === 'wechat' && intent === 'login' && prefersWechatMiniProgramLogin()) {
    rememberSocialReturnUrl(window.location.href);
    window.location.href = '/auth/wechat/mobile';
    return { navigated: true };
  }
  const pkce = provider === 'apple' ? await createAuthPkcePair(
    (length) => crypto.getRandomValues(new Uint8Array(length)),
    async (value) => new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(value))),
  ) : null;
  const checkAccount = () => {
    signal?.throwIfAborted();
    if (expectedUid !== undefined && useAuthStore.getState().user?.uid !== expectedUid) {
      throw new Error('account changed');
    }
  };
  checkAccount();
  const { url, siteOrigin } = await fetchSocialAuthorization(provider, intent, pkce?.codeChallenge, signal);
  checkAccount();
  if (provider === 'apple') {
    const canonicalEntry = appleCanonicalEntry(siteOrigin, window.location.href);
    if (canonicalEntry) {
      // A link must not silently become a new login after crossing cookie/storage origins.
      if (intent === 'link') throw new Error(`Apple linking requires canonical site: ${canonicalEntry}`);
      window.location.href = canonicalEntry;
      return { navigated: true };
    }
    rememberAppleState(url, pkce!.codeVerifier);
  }
  rememberSocialReturnUrl(window.location.href);
  const target = alipayMobileWakeUrl(provider, url);
  const navigated = target === url; // 被包成 alipays:// scheme 时页面不卸载(只唤起 App)
  window.location.href = target;
  return { navigated };
}

/** 是否在微信/QQ 等 App 内置浏览器里。这些 webview 里发起支付宝授权,回调会落到系统浏览器
 *  (另一个 App 的独立 localStorage),原页面收不到登录态 → 只能引导用户「在浏览器中打开」。 */
export function isBlockedWebview(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger|\bQQ\/|QQBrowser|DingTalk|Weibo/i.test(navigator.userAgent || '');
}

/** 手机端把支付宝授权页包进 `alipays://` scheme,直接唤起支付宝 App 授权(而非 PC 扫码页)。
 *  appId=20000067 是支付宝内置 H5 容器;授权完成后仍按 redirect_uri 回跳。
 *  - 非支付宝 provider:原样返回(微信/QQ 唤起机制不同)。
 *  - 桌面端:保留 https 授权页(扫码是 PC 正解)。
 *  - 已在支付宝 App 内置浏览器(AlipayClient):直接用 https,容器自身能处理,避免 scheme 套娃。 */
export function alipayMobileWakeUrl(provider: RedirectAuthProvider, url: string): string {
  if (provider !== 'alipay') return url;
  const ua = navigator.userAgent || '';
  if (/AlipayClient/i.test(ua)) return url;
  const isMobile = /android|iphone|ipad|ipod|harmony|mobile/i.test(ua);
  if (!isMobile) return url;
  return `alipays://platformapi/startapp?appId=20000067&url=${encodeURIComponent(url)}`;
}
