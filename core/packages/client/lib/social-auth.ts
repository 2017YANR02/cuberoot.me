'use client';

// 国内三方登录(微信/QQ/支付宝)浏览器端:授权码重定向流。
// 生成 state(CSRF)存 sessionStorage → 向服务端要授权页 URL(redirect_uri 服务端固定)→ 整页跳转。
// 回来落到 app/auth/social/callback,凭 state + provider + intent 决定登录/绑定。
// sessionStorage 跨整页跳转(离站再回)同标签同源仍在,与 WCA 流程同一套机制。

import { fetchSocialAuthorizeUrl, type SocialProvider } from './account-api';

export const SOCIAL_STATE_KEY = 'social_oauth_state';
export const SOCIAL_PROVIDER_KEY = 'social_oauth_provider';
export const SOCIAL_INTENT_KEY = 'social_oauth_intent';
export const SOCIAL_RETURN_KEY = 'social_oauth_return';

/** 发起三方登录/绑定。intent='login' 未登录时登录;'link' 已登录时把该身份加到当前账号。
 *  先拿 URL(失败即抛,给调用方在弹层里显错),成功再写 session + 跳转。 */
export async function startSocialLogin(provider: SocialProvider, intent: 'login' | 'link'): Promise<void> {
  if (typeof window === 'undefined') return;
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const url = await fetchSocialAuthorizeUrl(provider, state);
  sessionStorage.setItem(SOCIAL_STATE_KEY, state);
  sessionStorage.setItem(SOCIAL_PROVIDER_KEY, provider);
  sessionStorage.setItem(SOCIAL_INTENT_KEY, intent);
  sessionStorage.setItem(SOCIAL_RETURN_KEY, window.location.href);
  window.location.href = alipayMobileWakeUrl(provider, url);
}

/** 手机端把支付宝授权页包进 `alipays://` scheme,直接唤起支付宝 App 授权(而非 PC 扫码页)。
 *  appId=20000067 是支付宝内置 H5 容器;授权完成后仍按 redirect_uri 回跳。
 *  - 非支付宝 provider:原样返回(微信/QQ 唤起机制不同)。
 *  - 桌面端:保留 https 授权页(扫码是 PC 正解)。
 *  - 已在支付宝 App 内置浏览器(AlipayClient):直接用 https,容器自身能处理,避免 scheme 套娃。 */
export function alipayMobileWakeUrl(provider: SocialProvider, url: string): string {
  if (provider !== 'alipay') return url;
  const ua = navigator.userAgent || '';
  if (/AlipayClient/i.test(ua)) return url;
  const isMobile = /android|iphone|ipad|ipod|harmony|mobile/i.test(ua);
  if (!isMobile) return url;
  return `alipays://platformapi/startapp?appId=20000067&url=${encodeURIComponent(url)}`;
}
